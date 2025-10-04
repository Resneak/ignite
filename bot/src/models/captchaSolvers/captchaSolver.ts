import Proxy from '../../../../lib/models/proxy';
import got, { CancelableRequest, Got, Options, Response } from 'got';
import Queue from 'promise-queue';
import { sleep } from '../../../../lib/helpers';

export interface CaptchaTask {
    taskID: string;
    type: CaptchaType;
    URL: string;
    siteKey?: string;
    minScore?: number;
    pageAction?: string;
    proxy?: Proxy;
    invisible?: boolean;
    enterprise?: boolean;
    userAgent?: string;
    renderParameters?: string;
    geeTestParams?: GeeTestParams;
    // format: cookiename1=cookievalue1; cookiename2=cookievalue2
    cookies?: string;
}

export interface GeeTestParams {
    gt: string;
    challenge: string;
    api_server?: string;
    product?: string;
    offline?: string;
    new_captcha?: string;
    lang?: string;
    http?: string;
}

export interface GeeTestResponse {
    challenge: string;
    validate: string;
    seccode: string;
}

export enum CaptchaSolverType {
    TwoCaptcha = '2Captcha',
    CapMonster = 'CapMonster',
    AYCDAutosolve = 'AYCD Autosolve',
    None = 'None',
}

export enum CaptchaType {
    RecaptchaV2 = 'recaptchaV2',
    RecaptchaV2Invisible = 'recaptchaV2Invisible',
    RecaptchaV3 = 'recaptchaV3',
    HCaptcha = 'hcaptcha',
    HCaptchaInvisible = 'hcaptchaInvisible',
    GeeTest = 'geeTest',
}

export interface CaptchaSolverProps {
    type: CaptchaSolverType;

    apiKey: string;

    token: string;
}

type Token = string;
export type CaptchaResponse = Token | GeeTestResponse;

interface Props {
    /**
     * solver api key
     */
    apiKey: string;

    /**
     * solver access token
     */
    token?: string;

    /**
     * options to extend the http client
     */
    gotOptions?: Options;

    /**
     * used to specify the rate limit of the api you are connecting to
     * intervalCap is the total number of requests that will be made during the interval
     */
    rateLimit?: {
        interval: number;
        intervalCap: number;
    };

    /**
     * maximum number of requests to make at once
     * default: infinity but this is upper bounded by the rate limit
     */
    concurrency?: number;

    /**
     * if true pending promises will be included in the concurrency count
     */
    carryOverConcurrencryCount?: boolean;

    /**
     * Per-operation timeout in milliseconds. Operations fulfill once timeout elapses if they haven't already.
     */
    timeout?: number;
}

export default abstract class CaptchaSolver {
    protected apiKey: string;

    protected httpClient: Got;

    protected token?: string;

    private queue: Queue;

    protected blockedUntil = 0;

    protected oneDay = 86_400_000;

    protected errorMessages = {
        contact: 'Ignite Suggestion: please report this to Ignite support/devs',
        apiKey: 'Invalid Key',
        zeroBalanace: 'Low Balance',
    };

    constructor(props: Props) {
        this.apiKey = props.apiKey;
        this.token = props.token;
        this.httpClient = props.gotOptions ? got.extend(props.gotOptions) : got;

        // create a queue that makes at most 60 requsests every 3 seconds (rate limit set by 2Captcha)
        this.queue = new Queue({
            interval: props?.rateLimit?.interval,
            intervalCap: props?.rateLimit?.intervalCap,
        });
    }

    abstract solve(captchaTask: CaptchaTask): Promise<CaptchaResponse>;

    public getIsBlocked() {
        return this.blockedUntil > Date.now();
    }

    public getBlockedFor() {
        const now = Date.now();
        return this.blockedUntil - now > 0 ? this.blockedUntil - now : 0;
    }

    /**
     *
     * @param thunkedRequest to add to the queue
     * @returns a promise of the request object
     */
    protected async enqueue(thunkedRequest: () => CancelableRequest<Response<string>>): Promise<CancelableRequest<Response<string>>> {
        return new Promise((resolve, reject) => {
            sleep(this.getBlockedFor()).then(() => {
                resolve(this.queue.add(thunkedRequest));
            });
        });
    }

    /**
     *
     * @param duration to block the solver from making requests for for
     */
    protected blockFor(duration: number) {
        const blockedUntil = Date.now() + duration;
        if (blockedUntil > this.blockedUntil) {
            this.blockedUntil = blockedUntil;
        }
    }
}
