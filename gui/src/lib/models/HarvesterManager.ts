/* eslint-disable max-classes-per-file */
import { Captcha, CaptchaResponse } from './captcha';
import Queue from './Queue';
import Stack from './Stack';

/**
 * captchas make a request for a token from the harvester manager
 * harvester manager stores the captcha and a promise made to the captcha
 */
export interface TokenRequest {
    /**
     * captcha that a token is needed for
     */
    captcha: Captcha;

    /**
     * function called to send Captcha Response back to task
     */
    resolve: (captchaResponse: CaptchaResponse) => void;

    /**
     * function called when token request was unsuccessful
     */
    reject: () => void;
}

/**
 * harvesters make a request for a captcha from the harvester manager
 * harvester manager stores the promise made to the harvester
 */
export interface CaptchaRequest {
    /**
     * id of the harvester requesting a captcha
     */
    harvesterId: string;

    /**
     * function called to send a captcha to a harvester
     */
    resolve: (captcha: Captcha) => void;

    /**
     * function called when a captcha could not be send to a harvester
     */
    reject: () => void;
}

/**
 * data structure to hold the requests for captchas made by harvesters
 */
class CaptchaRequests {
    /**
     * store the captcha requests made by harvesters in a stack, LIFO
     * causes the most recently available harvester to recieve the next captcha
     */
    private requests: Stack<CaptchaRequest>;

    constructor() {
        this.requests = new Stack();
    }

    /**
     *
     * @param request for a captcha to store
     */
    add(request: CaptchaRequest) {
        this.requests.add(request);
    }

    /**
     * get an available harvester to send a captcha to
     */
    get(): CaptchaRequest | undefined {
        return this.requests.remove();
    }

    size() {
        return this.requests.size();
    }

    remove(harvesterId: string) {
        this.requests.filter((currentValue: CaptchaRequest, index, arr) => currentValue.harvesterId !== harvesterId);
    }
}

/**
 * data structure to hold the requests made by tasks for a Captcha Response
 */
class TokenRequests {
    /**
     * store the token requests made by tasks in a queue, FIFO
     * causes the first request to be solved first
     */
    private requests: Queue<TokenRequest>;

    constructor() {
        this.requests = new Queue<TokenRequest>();
    }

    /**
     * @param request to store
     */
    add(request: TokenRequest) {
        this.requests.add(request);
    }

    /**
     * get a token request from the data structure
     */
    get(): TokenRequest | undefined {
        return this.requests.remove();
    }

    size() {
        return this.requests.size();
    }
}

/**
 * handles pairing of captchas to harvesters
 */
export default class HarvesterManager {
    private static instance: HarvesterManager;

    /**
     * store the requests made by harvesters for a captcha to solve
     */
    private captchaRequests: CaptchaRequests;

    /**
     * store the requests made by captchas for a token
     */
    private tokenRequests: TokenRequests;

    /**
     * store the captcha taskid being solved,
     * and promise callbacks (resolve and reject) for harvesters
     * currently solving a captcha
     */
    private inProgressHarvesters: Map<string, TokenRequest>;

    private constructor() {
        this.captchaRequests = new CaptchaRequests();
        this.tokenRequests = new TokenRequests();
        this.inProgressHarvesters = new Map();
    }

    public static getInstance() {
        if (this.instance === undefined) this.instance = new this();
        return this.instance;
    }

    /**
     * attempts to match a captcha request with a token request
     */
    private onRequest() {
        // while there are items to be paired
        while (this.captchaRequests.size() > 0 && this.tokenRequests.size() > 0) {
            const captchaRequest = this.captchaRequests.get();
            const tokenRequest = this.tokenRequests.get();
            // match a captcha with a harvester
            if (captchaRequest !== undefined && tokenRequest !== undefined) {
                this.inProgressHarvesters.set(tokenRequest.captcha.taskId, tokenRequest);
                captchaRequest.resolve(tokenRequest.captcha);
            } else {
                captchaRequest?.reject();
            }
        }
    }

    /**
     * sends the captcha response back to the task
     *
     * since we cannot send functions via electron ipc,
     * save the tokenRequest, including the promise's resolve and reject
     * functions in the inProgressHarvesters map to be called here
     *
     * @param captchaResponse the response from the harvester
     */
    sendResult(captchaResponse: CaptchaResponse | undefined) {
        const tokenRequest = captchaResponse ? this.inProgressHarvesters.get(captchaResponse?.taskId) : undefined;
        if (captchaResponse) {
            tokenRequest?.resolve(captchaResponse);
            this.inProgressHarvesters.delete(captchaResponse.taskId);
        } else {
            tokenRequest?.reject();
        }
    }

    /**
     * called to request a token for a captcha
     * @param captcha to be solved
     * @returns a promise of a captcha response containing the token
     */
    requestToken(captcha: Captcha): Promise<CaptchaResponse> {
        return new Promise((resolve, reject) => {
            this.tokenRequests.add({
                captcha,
                resolve,
                reject,
            });

            this.onRequest();
        });
    }

    /**
     * called to request a captcha for a harvester
     * @returns a promise of a captcha
     */
    requestCaptcha(harvesterId: string): Promise<Captcha> {
        return new Promise((resolve: (c: Captcha) => void, reject) => {
            this.captchaRequests.add({
                harvesterId,
                resolve,
                reject,
            });
            this.onRequest();
        });
    }

    /**
     * removes the request made by a harvester for a captcha
     * @param harvesterId of the captcha request to be removed
     */
    removeCaptchaRequest(harvesterId: string) {
        this.captchaRequests.remove(harvesterId);
        // TODO do we remove from inProgress Harvesters?
    }
}
