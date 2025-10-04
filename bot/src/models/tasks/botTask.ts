import got, {
    CacheError,
    CancelError,
    Got,
    MaxRedirectsError,
    Options,
    ParseError,
    ReadError,
    RequestError,
    Response,
    TimeoutError,
    UnsupportedProtocolError,
    UploadError,
} from 'got';
import { Cookie, CookieJar } from 'tough-cookie';
import Profile from '../../../../lib/models/profile';
import { stopRequestHook } from '../../utils/hooks';
import Task from '../../../../lib/models/task';
import { sleep } from '../../../../lib/helpers';
import BotTaskError from '../../../../lib/errors/taskError';
import Proxy from '../../../../lib/models/proxy';
// eslint-disable-next-line import/no-cycle
import Website from '../../../../lib/models/website';
import { CompleteTask, CompletionType, RetryExecutor, StopTask } from '../../../../lib/errors';
import { ErrorCode, StopTaskType } from '../../../../lib/errors/errorCodes';
import ProxyGroupCollection from '../../../../lib/models/proxyGroupCollection';
import Logger from '../../../../cli/src/utils/logger';
import TaskUpdate, { TaskEvent, TaskStatusColor } from '../../../../lib/models/taskUpdate';
import ProxyGroup from '../../../../lib/models/proxyGroup';
import { CaptchaResponse, CaptchaTask, GeeTestResponse } from '../captchaSolvers/captchaSolver';
import Env from '../../env';

export interface BotTaskType {
    new (props: BotTaskProperties): BotTask;
}

export interface BotTaskProperties {
    website: Website;
    profile: Profile;
    task: Task;
    devices: Array<Object>;
    solveCaptcha: (captchaTask: CaptchaTask) => Promise<CaptchaResponse>;
    /**
     * callback that will be called to update the current bot status
     *
     * this should be a method that updates the client's view
     */
    setStatus: (taskUpdate: TaskUpdate) => void;
}

// HTTP(S) bot task
export default abstract class BotTask {
    /**
     * target website
     */
    website: Website;

    /**
     * profile to use
     */
    profile: Profile;

    /**
     * proxies to use
     */
    proxies: ProxyGroup;

    /**
     * task details
     */
    task: Task;

    /**
     * device data array
     */
    devices: Array<Object>;

    /**
     * current ip address
     */
    ip?: string;

    shouldStopTask = false;

    isComplete = false;

    proxy?: Proxy;

    protected retryDelay: number;

    protected monitorDelay: number;

    public isPaused: boolean = false;

    solveCaptcha: (captchaTask: CaptchaTask) => Promise<string | GeeTestResponse>;

    setStatus: (status: string, color?: TaskStatusColor, event?: TaskEvent) => void;

    /**
     * call to update the task status
     */
    protected updateStatus(status: string, color?: TaskStatusColor) {
        if (status.trim() === '') return;

        this.setStatus(status, color);
    }

    protected httpClient: Got;

    protected cookieJar!: CookieJar;

    protected initNewCookieJar() {
        this.cookieJar = new CookieJar(undefined, { rejectPublicSuffixes: false });
        // we have to bind these methods to the right context
        // in order for the 'cookieJar: ' option of the http client below to work
        this.cookieJar.getCookieString = this.cookieJar.getCookieString.bind(this.cookieJar);
        this.cookieJar.setCookie = this.cookieJar.setCookie.bind(this.cookieJar);

        const originalSetCookie = this.cookieJar.setCookie;
        this.cookieJar.setCookie = (...args: any) => {
            // @ts-expect-error idk
            return originalSetCookie(...args, {
                ignoreError: true,
            });
        };
        this.updateHttpOptions({ cookieJar: this.cookieJar });
        return this.cookieJar;
    }

    constructor(props: BotTaskProperties) {
        this.website = props.website;
        this.profile = props.profile;
        this.task = props.task;

        this.retryDelay = this.task.retryDelay || 3000;
        this.monitorDelay = this.task.monitorDelay || 3000;

        this.devices = props.devices;

        this.proxies = ProxyGroupCollection.getInstance().getProxyGroup(this.task.proxyGroupId);
        this.proxy = this.proxies.getItem();

        this.setStatus = (status: string, color?: TaskStatusColor, event?: TaskEvent) => {
            props.setStatus({ id: this.task.id, pid: this.task.product.id, color: color || TaskStatusColor.Neutral, event, message: status });
        };

        this.solveCaptcha = props.solveCaptcha;

        this.httpClient = got.extend({
            timeout: 20000,
            cache: false,
            mutableDefaults: true,
            throwHttpErrors: false,
            https: {
                rejectUnauthorized: !Env.isDev,
                checkServerIdentity: (hostname, certificate) => {
                    return;
                },
            },
            http2: false,
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Safari/537.36',
            },
            followRedirect: false,
            decompress: true,
            hooks: {
                beforeRequest: [
                    () => stopRequestHook(this.shouldStopTask),
                    // NOTE: normally got deals with cookies automatically,
                    // but it seems broken and I can't figure out why so let's set them manually ¯\_(ツ)_/¯
                    async (options) => {
                        const cookieString: string = await this.cookieJar.getCookieString(options.url.toString());
                        if (cookieString) options.headers.cookie = cookieString;
                    },
                ],
            },
        });

        this.initNewCookieJar();
    }

    setHTTP2(enabled: boolean) {
        this.updateHttpOptions({
            http2: enabled,
        });
    }

    async sendRequest(method: 'POST' | 'GET' | 'PUT' | 'HEAD', url: string, options: Options = {}): Promise<Response<any>> {
        const response = await this.httpClient({
            url,
            method,
            ...options,
        });
        return response as Response<any>;
    }

    /**
     * pauses a task after its next retry executor is thrown
     * or it's next executor is called
     *
     * @param force the task to pause even if it hasn't reached point where it should pause for a watchdog task
     */
    public pause(force: boolean = false) {
        if (this.readyToWaitForWatchdog === true || force) {
            this.isPaused = true;
        }
    }

    /**
     * stores the resolve fucntion created in pause
     * clients can unpause a task by calling start again
     */
    private unpause?: () => void;

    public isRunnning() {
        return !this.isPaused && this.didStart();
    }

    /**
     * @returns a boolean indicating if this task has been started
     */
    private didStart() {
        return this.executor !== undefined;
    }

    private promiseToStop?: { promise: Promise<void>; resolve: () => void };

    /**
     * stops this task
     *
     * note: this call doesn't take effect immediately.
     * the task will only be truly cancelled after the current asynchronous function has been resolved
     *
     * @param force force when set to true, it will force the view to show that the task as stopped before it is actually stopped
     */
    stop(force = false, type?: StopTaskType) {
        this.shouldStopTask = true;
        if (!this.promiseToStop) {
            let res: any;
            const promise = new Promise<void>((resolve) => {
                res = resolve;
            });

            this.promiseToStop = { promise, resolve: res };
        }

        if (type === StopTaskType.SingleCheckout) {
            this.handleError(new StopTask(undefined, undefined, StopTaskType.SingleCheckout));
            this.isComplete = true;
            return;
        }
        if (force) this.handleError(new StopTask());

        return this.promiseToStop?.promise;
    }

    public readyToWaitForWatchdog = false;
    protected async setWatchdog() {
        this.readyToWaitForWatchdog = true;
        this.setStatus('', undefined, TaskEvent.Watch);
        return;
    }

    protected async monitor() {
        throw new Error('Watchdog tasks are currently not supported by this site.');
    }

    private isWatchdog = false;
    public async startMonitor() {
        this.isWatchdog = true;
        this.updateStatus('Starting Watchdog...', TaskStatusColor.Info);
        await this.handleExecutor(this.monitor.bind(this));
        this.isWatchdog = false;
        this.start();
    }

    protected executor?: Promise<void>;
    protected iterator;

    protected abstract execute(): Generator<Promise<void> | any>;
    /**
     * starts or unpauses this task
     *
     * executes the 'execute' method and handles errors
     */
    async start(): Promise<void> {
        if (this.isRunnning()) {
            return;
        } else if (this.isPaused) {
            this.isPaused = false;
            this.unpause?.();
            return;
        }

        this.promiseToStop = undefined;
        this.iterator = this.execute();

        // eslint-disable-next-line no-restricted-syntax
        for (const executor of this.iterator) {
            this.executor = executor;
            const shouldContinue = await this.handleExecutor(executor);
            // stop executing other executors when task was manually stopped by user
            if (!shouldContinue) {
                this.stop();
                this.completeTask();
                break;
            }
            if (this.isPaused) {
                await this.handlePause();
            }
        }
        this.stop();
    }

    /**
     * pauses the task until start is called again
     */
    private async handlePause() {
        if (!this.isWatchdog) this.setStatus('Paused.', TaskStatusColor.Info, TaskEvent.Paused);
        await new Promise<void>((resolve, reject) => {
            this.unpause = resolve;
        });
        this.setStatus('Starting up...', TaskStatusColor.Info, TaskEvent.UnPaused);
    }

    /**
     * handles a task executor
     *
     * returns whether or not the task should continue executing
     * @param executor
     */
    private async handleExecutor(executor: Promise<void> | (() => Promise<void>)): Promise<boolean> {
        let shouldContinue = true;

        try {
            if (this.shouldStopTask) throw new StopTask();
            await (typeof executor === 'function' ? (executor as Function)() : executor);
        } catch (err) {
            if (this.isComplete) {
                return false;
            }
            shouldContinue = await this.handleError(err);
        }

        return shouldContinue;
    }

    completeTask(completionType = CompletionType.None) {
        this.handleError(new CompleteTask(completionType));
        this.promiseToStop?.resolve?.();
    }

    /**
     * handles task executor errors & returns whether or not the task should continue
     * @param err
     * @returns whether or not this task should continue after handling the error
     */
    protected async handleError(err: Error | any) {
        let shouldContinue = true;
        if (err instanceof BotTaskError) {
            switch (err.code) {
                case ErrorCode.Stop:
                    this.setStatus(err.message, TaskStatusColor.Error, TaskEvent.Stopped);
                    shouldContinue = false;
                    break;
                case ErrorCode.SingleCheckout:
                    this.setStatus(err.message, TaskStatusColor.Info);
                    shouldContinue = false;
                    return shouldContinue;
                case ErrorCode.Retry:
                    this.setStatus(err.message, TaskStatusColor.Warning);
                    Logger.warn(err.logMessage);
                    await this.waitRetry();
                    shouldContinue = true;
                    break;
                case ErrorCode.Monitor:
                    this.setStatus(err.message, TaskStatusColor.Info);
                    await this.waitMonitor();
                    shouldContinue = true;
                    break;
                case ErrorCode.Completed:
                    // eslint-disable-next-line no-case-declarations
                    const error = err as CompleteTask;
                    if (error.type === CompletionType.PaymentSuccess) {
                        this.setStatus(err.message || 'Payment Success', TaskStatusColor.Success, TaskEvent.CheckoutSuccess);
                    } else if (error.type === CompletionType.PaymentDeclined) {
                        this.setStatus(err.message || 'Payment Declined', TaskStatusColor.Error, TaskEvent.CheckoutDecline);
                    }
                    shouldContinue = false;
                    break;
                default:
                    Logger.error(`unhandled error: ${err}`, true);
                    throw err;
            }
            // check if we should pause
            if (this.isPaused) {
                await this.handlePause();
            }
            // re-execute failed task (untill it works)
            if (err.retryExecutor) shouldContinue = await this.handleExecutor(err.retryExecutor());
        }
        // unexpected error
        else {
            this.updateStatus(`Task error (${err.message})`, TaskStatusColor.Error);
            throw err;
        }

        return shouldContinue;
    }

    /** //TODO test this. It apparently doesn't work
     * add a cookie to the default cookie jar
     * @param key cookie key
     * @param value cookie value
     * @param subdomain wether or not to set this cookie on subdomains as well
     * @param sameSite samesite attribute (see https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
     */
    // protected setCookie(key: string, value: string, subdomain = false, sameSite: 'Strict' | 'Lax' | 'None' = 'None') {
    //     const cookie = new Cookie({
    //         key,
    //         value,
    //         domain: subdomain ? this.website.url.hostname : undefined,
    //         sameSite,
    //     });

    //     return this.cookieJar.setCookie(cookie, this.website.url.toString());
    // }

    /**
     * updates the default http client options
     */
    protected updateHttpOptions(options: Options) {
        this.httpClient.defaults.options = got.mergeOptions(this.httpClient.defaults.options, options);
    }

    /**
     * updates the default http client HTTP headers
     * @param headers headers object to merge with current headers
     */
    protected updateHeaders(headers: Record<string, string | string[] | undefined> | undefined) {
        this.updateHttpOptions({ headers });
    }

    /**
     * waits for configured retry delay (on error)
     */
    protected waitRetry() {
        return sleep(this.retryDelay);
    }

    /**
     * waits for configured monitor delay
     */
    protected waitMonitor() {
        return sleep(this.monitorDelay);
    }

    protected debugHttpResponse(response: Response) {
        console.dir(response.statusCode);
        console.dir(response.headers);
        console.dir(response.body);
    }

    protected rotateProxy() {
        const proxy = this.proxies.getItem();
        if (proxy) {
            this.proxy = proxy;
            this.updateHttpOptions({
                agent: proxy.getAgents({ rejectUnauthorized: !Env.isDev }),
            });
        }
    }

    protected async solveCaptchaTask(captchaTask: CaptchaTask) {
        let attempts = 0;
        while (true) {
            try {
                const solution = await this.solveCaptcha(captchaTask);
                return solution;
            } catch (e) {
                ++attempts;
                if (e?.code === ErrorCode.Stop || attempts > 10) {
                    throw e;
                }
                this.updateStatus('Retrying to solve captcha. ' + e, TaskStatusColor.Warning);
            }
        }
    }

    protected async getIP() {
        this.updateStatus('Getting IP address', TaskStatusColor.Neutral);
        try {
            const res: any = await this.httpClient.get('https://api.ipify.org/?format=json', {
                responseType: 'json',
            });
            this.ip = res.body.ip;
            this.updateStatus(`IP Address = ${res.body.ip}`, TaskStatusColor.Info);
        } catch (e) {
            throw new RetryExecutor(this.getIP.bind(this), `Failed to get IP address. Error: ${e}`);
        }
    }

    /**
     *
     * @param Error to handle
     * @param retry method called when a retry is valid (not yet bound).
     * @returns a boolen
     *
     * intended use using retry executors:
     * try {
     *      Some http request with throw http errors set to false
     * }
     * catch (e) {
     *      this.handleConnectionError(e, this.getSensor);
     * })
     *
     *
     * intended use in a while loop:
     * try {
     *      Some http request with throw http errors set to false
     * }
     * catch (e) {
     *      const wasProxyError = this.handleConnectionError(e, this.getSensor);
     *      if(!wasProxyError) {
     *          // possibly return to stop trying this method
     *      }
     *      continue;
     * })
     * @param currentStep to display in status
     */
    protected handleConnectionError(
        error:
            | RequestError
            | CacheError
            | ReadError
            | ParseError
            | UploadError
            | MaxRedirectsError
            | UnsupportedProtocolError
            | TimeoutError
            | CancelError,
        retry?: () => Promise<void>,
        currentStep?: string
    ) {
        if (Env.isDev) {
        }
        let errorType;
        let errorMsg;
        let shouldRotateProxy = false;
        let shouldRetry = false;
        if (error instanceof CacheError) {
            errorType = 'Cache Error';
            shouldRetry = true;
        } else if (error instanceof ReadError) {
            errorType = 'Read Error';
            errorMsg = 'Error occurred while reading stream';
            shouldRetry = true;
        } else if (error instanceof ParseError) {
            errorType = 'Parse Error';
            errorMsg = 'Unable to parse response';
            shouldRetry = true;
        } else if (error instanceof UploadError) {
            errorType = 'Upload Error';
            shouldRetry = true;
        } else if (error instanceof MaxRedirectsError) {
            errorType = 'Max Redirect Error';
            errorMsg = `Exceeded ${error.request.options.maxRedirects} redirects`;
            shouldRetry = true;
        } else if (error instanceof UnsupportedProtocolError) {
            errorType = `Unsupported Protocol Error`;
            shouldRetry = true;
        } else if (error instanceof TimeoutError) {
            errorType = 'Request Timeout Error';
            shouldRetry = true;
        } else if (error instanceof CancelError) {
            errorMsg = 'Request was cancelled';
        } else if (error instanceof RequestError) {
            errorType = 'Request Error';
            errorMsg = Env.isDev
                ? `Failed to connect to proxy/server. Error Code: ${error.code} ${
                      this.proxy ? 'Proxy: ' + this.proxy.ip + ':' + this.proxy.port : ''
                  }`
                : 'Proxy Banned, Rotating...';
            shouldRotateProxy = true;
            shouldRetry = true;
        }

        if (shouldRotateProxy) this.rotateProxy();

        const errorDescripton = `${errorType}${errorMsg ? ': ' + errorMsg : ''}.`;
        if (shouldRetry && retry) {
            if (Env.isDev) {
                const retryMessage = shouldRotateProxy
                    ? `Retrying ${currentStep && currentStep + ' '}with new proxy...`
                    : `Retrying ${currentStep && currentStep}...`;

                throw new RetryExecutor(retry, `${errorDescripton}. ${retryMessage}`);
            } else {
                const retryMessage = 'Proxy banned. Rotating.';
                throw new RetryExecutor(retry, `${errorDescripton}. ${retryMessage}`);
            }
        }
        if (Env.isDev) {
            this.updateStatus(`${errorDescripton} at ${currentStep}`, TaskStatusColor.Warning);
        } else {
            // this.updateStatus('Server Error. Retrying', TaskStatusColor.Warning);
            this.updateStatus(`${currentStep} failed, retrying...`);
        }
        return shouldRotateProxy;
    }
}
