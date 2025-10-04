/**
 * Docs:
 * https://2captcha.com/2captcha-api
 * can use proxies with 
 * 
    reCAPTCHA V2
    reCAPTCHA Enterpise V2
    Arkose Labs FunCaptcha
    GeeTest
    hCaptcha
    TikTok

 */
import CaptchaSolver, { CaptchaResponse, CaptchaTask, CaptchaType, GeeTestResponse } from './captchaSolver';
import { JSONParseSafely, sleep } from '../../../../lib/helpers';
import Proxy from '../../../../lib/models/proxy';
interface TwoCaptchaTask {
    key: string;
    soft_id?: number;
    pingback?: string;
    json: 0 | 1;
    /**
     * If enabled in.php will include Access-Control-Allow-Origin:* header in the response.
     */
    header_acao?: number;
}

interface TwoCaptchaGeeTestTask extends TwoCaptchaTask {
    method: string;
    gt: string;
    challenge: string;
    api_server: string;
    pageurl: string;
    proxy?: string; //user:pass@ip:port
    proxytype?: 'HTTP' | 'HTTPS' | 'SOCKS4' | 'SOCKS5';
    userAgent?: string;
}

interface TwoCapchaReCaptchaV2Task extends TwoCaptchaTask {
    method: string;
    googlekey?: string;
    pageurl?: string;
    invisible?: 0 | 1;
    proxy?: string; //user:pass@ip:port
    proxytype?: 'HTTP' | 'HTTPS' | 'SOCKS4' | 'SOCKS5';
}

enum Status {
    FAIL = 0,
    SUCCESS = 1,
}

enum SubmitError {
    WRONG_USER_KEY = 'ERROR_WRONG_USER_KEY',
    KEY_DOES_NOT_EXIST = 'ERROR_KEY_DOES_NOT_EXIST',
    ZERO_BALANCE = 'ERROR_ZERO_BALANCE',
    PAGEURL = 'ERROR_PAGEURL',
    NO_SLOT_AVAILABLE = 'ERROR_NO_SLOT_AVAILABLE',
    ZERO_CAPTCHA_FILESIZE = 'ERROR_ZERO_CAPTCHA_FILESIZE',
    TOO_BIG_CAPTCHA_FILESIZE = 'ERROR_TOO_BIG_CAPTCHA_FILESIZE',
    WRONG_FILE_EXTENSION = 'ERROR_WRONG_FILE_EXTENSION',
    IMAGE_TYPE_NOT_SUPPORTED = 'ERROR_IMAGE_TYPE_NOT_SUPPORTED',
    UPLOAD = 'ERROR_UPLOAD',
    IP_NOT_ALLOWED = 'ERROR_IP_NOT_ALLOWED',
    IP_BANNED = 'IP_BANNED',
    BAD_TOKEN_OR_PAGEURL = 'ERROR_BAD_TOKEN_OR_PAGEURL',
    GOOGLEKEY = 'ERROR_GOOGLEKEY',
    WRONG_GOOGLEKEY = 'ERROR_WRONG_GOOGLEKEY',
    CAPTCHAIMAGE_BLOCKED = 'ERROR_CAPTCHAIMAGE_BLOCKED',
    TOO_MANY_BAD_IMAGES = 'TOO_MANY_BAD_IMAGES',
    MAX_USER_TURN = 'MAX_USER_TURN',
    BAD_PARAMETERS = 'ERROR_BAD_PARAMETERS',
    BAD_PROXY = 'ERROR_BAD_PROXY',
    EXCEEDED_REQUEST_LIMIT = `ERROR:`, // ERROR: NNNN where NNNN is times exceeded request limit
}

enum RequestLimit {
    LOW_BID = '1001', // 10min block
    BALANCE_OUT = '1002', // 5min block
    LONG_QUEUE = '1003', // 30sec block
    IP_BLOCKED = '1004', // 10 min block
    TOO_MANY_REQUESTS = '1005', // R > C * 20 + 1200
}

enum PollError {
    WRONG_USER_KEY = 'ERROR_WRONG_USER_KEY',
    KEY_DOES_NOT_EXIST = 'ERROR_KEY_DOES_NOT_EXIST',
    NOT_READY = 'CAPCHA_NOT_READY', // yes, this spelling error is intnetional
    CAPTCHA_UNSOLVABLE = 'ERROR_CAPTCHA_UNSOLVABLE',
    WRONG_ID_FORMAT = 'ERROR_WRONG_ID_FORMAT',
    WRONG_CAPTCHA_ID = 'ERROR_WRONG_CAPTCHA_ID',
    BAD_DUPLICATES = 'ERROR_BAD_DUPLICATES',
    REPORT_NOT_RECORDED = 'REPORT_NOT_RECORDED',
    DUPLICATE_REPORT = 'ERROR_DUPLICATE_REPORT',
    IP_ADDRESS = 'ERROR_IP_ADDRES', // yes, this spelling error is also intentionalå
    TOKEN_EXPIRED = 'ERROR_TOKEN_EXPIRED',
    EMPTY_ACTION = 'ERROR_EMPTY_ACTION',
    PROXY_CONNECTION_FAILED = 'ERROR_PROXY_CONNECTION_FAILED',
    EXCEEDED_REQUEST_LIMIT = `ERROR:`, // ERROR: NNNN where NNNN is times exceeded request limit
}

export default class TwoCaptcha extends CaptchaSolver {
    private baseTask: TwoCaptchaTask;

    private pollingTimeout = 5000;

    constructor(apiKey: string) {
        super({
            apiKey,
            gotOptions: {
                prefixUrl: 'http://2captcha.com/',
            },
            rateLimit: {
                // 60 requests / 3 seconds
                interval: 3000,
                intervalCap: 60,
            },
        });

        this.baseTask = {
            key: this.apiKey,
            soft_id: 3070, //ignite software id
            json: 1,
        };
    }

    /**
     *
     * @param captchaTask to solve
     * @returns a promise for a token
     */
    solve(captchaTask: CaptchaTask): Promise<CaptchaResponse> {
        /**
         * 20_000 for recaptcha, 5_000 for all other captcha types
         */
        let pollTimeout = 5_000;

        let task: TwoCaptchaTask;

        switch (captchaTask.type) {
            case CaptchaType.RecaptchaV2Invisible:
            case CaptchaType.RecaptchaV2:
                pollTimeout = 20_000;
                task = this.getRecaptchaV2Task(captchaTask);
                break;
            case CaptchaType.GeeTest:
                pollTimeout = 15_000;
                task = this.getGeeTestTask(captchaTask);
                break;
            default:
                throw new Error(`${captchaTask.type} not supported by 2Captcha`);
        }

        return new Promise((resolve, reject) => {
            this.sendCaptchaRequest(task)
                .then((requestID) => {
                    return this.pollToken(requestID, pollTimeout);
                })
                .then((pollResponse: any) => {
                    resolve(this.convertResponse(pollResponse, captchaTask.type));
                })
                .catch((e) => {
                    reject(e);
                });
        });
    }

    private getRecaptchaV2Task(captchaTask: CaptchaTask): TwoCapchaReCaptchaV2Task {
        const options: TwoCapchaReCaptchaV2Task = {
            ...this.baseTask,
            method: 'userrecaptcha',
            googlekey: captchaTask.siteKey,
            pageurl: captchaTask.URL,
            invisible: captchaTask.invisible ? 1 : 0,
            ...this.getProxyOptions(captchaTask.proxy),
        } as TwoCapchaReCaptchaV2Task;

        return options;
    }

    private getGeeTestTask(captchaTask: CaptchaTask): TwoCaptchaGeeTestTask {
        if (!captchaTask?.geeTestParams?.gt || !captchaTask?.geeTestParams?.api_server || !captchaTask?.geeTestParams?.challenge) {
            throw new Error(`2Captcha: GeeTest Task Error. Missing Parameters. \n${this.errorMessages.contact}`);
        }
        const options: TwoCaptchaGeeTestTask = {
            ...this.baseTask,
            method: 'geetest',
            gt: captchaTask.geeTestParams.gt,
            challenge: captchaTask.geeTestParams.challenge,
            api_server: captchaTask.geeTestParams.api_server,
            pageurl: captchaTask.URL,
            userAgent: captchaTask.userAgent,
            ...this.getProxyOptions(captchaTask.proxy),
        } as TwoCaptchaGeeTestTask;

        return options;
    }

    /**
     *
     * @param proxy
     * @returns proxy formatted to 2 captcha specs
     */
    private getProxyOptions(proxy?: Proxy) {
        return proxy
            ? {
                  proxy: proxy.format(),
                  proxytype: 'HTTPS',
              }
            : {};
    }

    private convertResponse(pollResponse: any, captchaType: CaptchaType) {
        let response: CaptchaResponse;
        switch (captchaType) {
            case CaptchaType.GeeTest:
                response = {
                    challenge: pollResponse.geetest_challenge,
                    validate: pollResponse.geetest_validate,
                    seccode: pollResponse.geetest_seccode,
                };
                break;
            default:
                response = pollResponse as string;
        }
        return response;
    }

    /**
     *
     * @param twoCaptchaTask to start solving
     * @returns a captcha id used to poll for
     */
    private async sendCaptchaRequest(twoCaptchaTask: TwoCaptchaTask) {
        let response;
        let fatal: boolean | string = false; // stops the captcha solver
        let warning: boolean | string = false; //stops the current captcha but not the solver

        let unknownErrorsEncountered = 0;
        while (true) {
            try {
                response = await this.enqueue(() =>
                    this.httpClient.post('in.php', {
                        form: twoCaptchaTask,
                    })
                );
            } catch (e) {
                if (e?.response?.statusCode == 500) {
                    throw new Error(`2Captcha: Server error. Ignite suggestion: ${this.errorMessages.apiKey}`);
                }
                throw new Error(`2Captcha: Server error, status code: ${e?.response?.statusCode}`);
            }
            const body = JSONParseSafely(response.body);

            if (!body || !body.request) {
                if (++unknownErrorsEncountered > 3) {
                    warning = '2Captcha: 3 unknown errors occurred';
                }
            } else if (body?.status == Status.SUCCESS) {
                return body.request;
            } else {
                switch (body.request) {
                    case SubmitError.WRONG_USER_KEY:
                        fatal = `2Captcha: ${this.errorMessages.apiKey}`;
                        break;
                    case SubmitError.KEY_DOES_NOT_EXIST:
                        fatal = `2Captcha: ${this.errorMessages.apiKey}`;
                        break;
                    case SubmitError.ZERO_BALANCE:
                        fatal = `2Captcha: ${this.errorMessages.zeroBalanace}. Solver blocked for 1 min`;
                        this.blockFor(60_000);
                        break;
                    case SubmitError.PAGEURL:
                        warning = `2Captcha: Missing page url. \n${this.errorMessages.contact}`;
                        break;
                    case SubmitError.NO_SLOT_AVAILABLE:
                        this.blockFor(5000);
                        break;
                    case SubmitError.ZERO_CAPTCHA_FILESIZE:
                        warning = `2Captcha: Invalid file size. \n${this.errorMessages.contact}`;
                        break;
                    case SubmitError.TOO_BIG_CAPTCHA_FILESIZE:
                        warning = `2Captcha: Invalid file size. \n${this.errorMessages.contact}`;
                        break;
                    case SubmitError.WRONG_FILE_EXTENSION:
                        warning = `2Captcha: Incorrect file extension. \n${this.errorMessages.contact}`;
                        break;
                    case SubmitError.IMAGE_TYPE_NOT_SUPPORTED:
                        warning = `2Captcha: cannot recognize image file type. \n${this.errorMessages.contact}`;
                        break;
                    case SubmitError.UPLOAD:
                        warning = `2Captcha: Malformed request. \n${this.errorMessages.contact}`;
                        break;
                    case SubmitError.IP_NOT_ALLOWED:
                        warning =
                            '2Captcha: Request sent from IP address that is not in your list of allowed IPs. \nIgnite Suggestion: check your 2Captcha account settings';
                        break;
                    case SubmitError.IP_BANNED:
                        warning =
                            '2Captcha: IP banned for 5min. \nIgnite Suggestion: check that your 2Captcha key is correct.\n If you are running multiple instances, create a 2Captcha account for each instance.';
                        const fiveMin = 300_000;
                        this.blockFor(fiveMin);
                        break;
                    case SubmitError.BAD_TOKEN_OR_PAGEURL:
                        warning = `2Captcha: Invalid pair of googlekey and pageurl. ReCAPTCHA is likely being loaded inside an iframe hosted on another domain/subdomain. \n${this.errorMessages.contact}`;
                        break;
                    case SubmitError.GOOGLEKEY:
                        warning = `2Captcha: Sitekey provided is incorrect: blank or malformed. \n${this.errorMessages.contact}`;
                        break;
                    case SubmitError.WRONG_GOOGLEKEY:
                        warning = '2Captcha: Googlekey parameter missing in request. \nIgnite Suggestion: please report this to Ignite support';
                        break;
                    case SubmitError.CAPTCHAIMAGE_BLOCKED:
                        warning = `2Captcha: Image unrecognizable. \n${this.errorMessages.contact}`;
                        break;

                    case SubmitError.TOO_MANY_BAD_IMAGES:
                        warning = `2Captcha: Too many unrecognizable images. \n${this.errorMessages.contact}`;
                        break;
                    case SubmitError.MAX_USER_TURN:
                        warning =
                            '2Captcha: Too many requests within 3 sec. Account banned for 10 sec. \nIgnite Suggestion: create a 2Captcha account for each instance you are running.';
                        this.blockFor(10000);
                        break;
                    case SubmitError.BAD_PARAMETERS:
                        warning = `2Captcha: Bad parameters. \n${this.errorMessages.contact}`;
                        break;
                    case SubmitError.BAD_PROXY:
                        warning =
                            '2Captcha: your proxy server has been marked as bad. \nIgnite Suggestion: use different proxies or a different captcha solving service';
                        break;
                    default:
                        const requestLimit = this.getRequestLimit(body.request);
                        if (requestLimit) {
                            warning = this.handleRequestLimit(`${requestLimit}`);
                        } else if (++unknownErrorsEncountered > 3) {
                            warning = `2Captcha: 3 unknown errors occurred \n${this.errorMessages.contact}`;
                        }
                }
            }
            this.handleErrors(warning, fatal);
            await sleep(1000);
        }
    }

    private async pollToken(id: string, initialTimeout: number) {
        await sleep(initialTimeout);
        let unknownErrorsEncountered = 0;
        let response;
        let fatal: boolean | string = false; // stops the captcha solver
        let warning: boolean | string = false; //stops the current captcha but not the solver
        while (true) {
            response = await this.enqueue(() =>
                this.httpClient.get('res.php', {
                    searchParams: {
                        key: this.apiKey,
                        action: 'get',
                        id,
                        json: 1,
                    },
                })
            );
            const body = JSONParseSafely(response.body);

            if (!body || !body.request) {
                if (++unknownErrorsEncountered > 3) {
                    warning = '2Captcha: 3 unknown errors occurred';
                }
            } else if (body?.status == Status.SUCCESS) {
                return body.request;
            } else {
                switch (body.request) {
                    case PollError.NOT_READY:
                        break;
                    case PollError.WRONG_USER_KEY:
                        fatal = `2Captcha: ${this.errorMessages.apiKey}`;
                        break;
                    case PollError.KEY_DOES_NOT_EXIST:
                        fatal = `2Captcha: ${this.errorMessages.apiKey}`;
                        break;
                    case PollError.CAPTCHA_UNSOLVABLE:
                        warning = '2Captcha: Captcha could not be solved';
                        break;
                    case PollError.WRONG_ID_FORMAT:
                    case PollError.WRONG_CAPTCHA_ID:
                        warning = `2Captcha: Captcha key provided in wrong format. \n${this.errorMessages.contact}`;
                        break;
                    case PollError.BAD_DUPLICATES:
                        warning = '2Captcha: max numbers of tries is reached but min number of matches not found';
                        break;
                    case PollError.REPORT_NOT_RECORDED:
                        warning = `2Catpcha: Report not recorded \n${this.errorMessages.contact}`;
                        break;
                    case PollError.DUPLICATE_REPORT:
                        warning = `2Captcha: Attempted to report same captcha more than once. \n${this.errorMessages.contact}`;
                        break;
                    case PollError.IP_ADDRESS:
                        warning = `2Captcha: IP address that does not match pingback IP. \n${this.errorMessages.contact}`;
                        break;
                    case PollError.TOKEN_EXPIRED:
                        warning = `2Captcha: Captcha challenge expired. \n${this.errorMessages.contact}.`;
                        break;

                    case PollError.EMPTY_ACTION:
                        warning = `2Captcha: Action parameter is missing. \n${this.errorMessages.contact}.`;
                        break;
                    case PollError.PROXY_CONNECTION_FAILED:
                        warning = '2Captcha: Unable to load a captcha through your proxy server';
                        break;

                    default:
                        const requestLimit = body.request.match(/ERROR:\s?(\d{1,4})/)?.[1] || '';
                        if (requestLimit) {
                            warning = this.handleRequestLimit(`${requestLimit}`);
                        } else if (++unknownErrorsEncountered > 3) {
                            warning = `2Captcha: 3 unknown errors occurred \n${this.errorMessages.contact}`;
                        }
                }
            }
            this.handleErrors(warning, fatal);
            await sleep(this.pollingTimeout);
        }
    }

    /**
     *
     * @param request parameter send by 2Captcha to check for a request limit
     * @returns the request limit or undefined
     */
    private getRequestLimit(request: string) {
        return request.match(/ERROR:\s?(\d{1,4})/)?.[1];
    }

    /**
     * https://2captcha.com/2captcha-api#limits
     * @param requestLimit to parse
     * @returns an error message
     */
    private handleRequestLimit(requestLimit: string) {
        let message: string;
        switch (requestLimit) {
            case RequestLimit.LOW_BID:
                message = "2Captcha: Your current bid is too low. You've been blocked for 10min";
                const tenMin = 600_000;
                this.blockFor(tenMin);
                break;
            case RequestLimit.BALANCE_OUT:
                message = "2Captcha: Zero balance in account. You've been blocked for 5min";
                const fiveMin = 300_000;
                this.blockFor(fiveMin);
                break;
            case RequestLimit.LONG_QUEUE:
                message = "2Captcha: Not enough workers. Ignite Suggestion: adjusting timeout accordingly; however, you've been blocked for 30sec";
                this.blockFor(30_000);
                this.pollingTimeout += 100;
                break;
            case RequestLimit.IP_BLOCKED:
                message = `2Captcha: Your IP address is blocked. Ignite Suggestion: ${this.errorMessages.apiKey}`;
                this.blockFor(this.oneDay);
                break;
            case RequestLimit.TOO_MANY_REQUESTS:
                message = '2Captcha: Too many requests. Ignite Suggestion: create a 2Captcha account for each instance you are running';
                break;
            default:
                message = `2Captcha: Exceeded request limit by ${requestLimit}. \nIgnite Suggestion: create a 2Captcha account for each instance you are running`;
        }
        return message;
    }

    /**
     *
     * @param warning message that gets thrown as an error if it exists
     * @param fatal message that blocks the solver from making future requests and throws an error
     */
    private handleErrors(warning, fatal) {
        if (fatal) {
            this.blockFor(this.oneDay);
            throw new Error(fatal);
        } else if (warning) throw new Error(warning);
    }
}
