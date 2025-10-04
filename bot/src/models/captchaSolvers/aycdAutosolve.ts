// /**
//  * documentation: https://docs.aycd.io/docs/getting-started/
//  */
import CaptchaSolver, { CaptchaResponse, CaptchaTask, CaptchaType, GeeTestResponse } from './captchaSolver';
import { JSONParseSafely, deleteUndefinedProperties } from '../../../../lib/helpers';
const Autosolve = require('autosolve-client');

class AYCDError extends Error {
    discrimitator: string;
    constructor(message?: string) {
        super(message);
        this.discrimitator = 'aycd';
    }
}

interface AutosolveTask {
    taskId: string;
    url: string;
    siteKey: string;
    version: number;
    action?: string;
    minScore?: number;
    proxy?: string;
    proxyRequired?: boolean;
    userAgent?: string;
    renderParameters?: any;
}
interface AutosolveResponse {
    taskId: string;

    token: string;

    createdAt: number;

    request: any;
}

type ResolveRejectObj = {
    captchaType: CaptchaType;
    resolve: (token: CaptchaResponse) => void;
    reject: () => void;
};
type TaskID = string;

export default class AYCDAutosolve extends CaptchaSolver {
    private solver: any;

    private initialized?: Promise<any>;

    private promises: Map<TaskID, ResolveRejectObj>;

    private connectionErrors = 0;

    constructor(apiKey: string, token: string) {
        super({ apiKey, token });
        this.solver = Autosolve.getInstance({
            accessToken: token,
            apiKey,
            clientKey: 'Ignite-91a8fa72-3166-41e6-844a-5a95ec95b78c',
            shouldAlertOnCancel: true,
            debug: false,
        });
        this.promises = new Map();
        this.initialize();
    }

    /**
     * intialize event listeners
     */
    private async initialize() {
        this.initialized = new Promise<void>((resolveInit, rejectInit) => {
            this.solver
                .init(this.token, this.apiKey)
                .then(() => {
                    resolveInit();
                    this.solver.ee.on('AutoSolveResponse', (message: string) => {
                        let jsonmessage = JSON.parse(message) as AutosolveResponse;
                        const promiseObj = this.promises.get(jsonmessage.taskId);
                        let response: CaptchaResponse;
                        switch (promiseObj?.captchaType) {
                            case CaptchaType.GeeTest:
                                response = JSON.parse(jsonmessage.token) as GeeTestResponse;
                                break;
                            default:
                                response = jsonmessage.token as string;
                        }

                        promiseObj!.resolve(response);
                    });

                    this.solver.ee.on('AutoSolveResponse_Cancel', (message) => {
                        const json = JSONParseSafely(message);
                        if (json?.requests) {
                            for (const captchaRequst of json?.requests) {
                                this.promises.get(captchaRequst.taskId)?.reject();
                            }
                        }
                    });

                    this.solver.ee.on('AutoSolveError', (e) => {
                        throw new AYCDError(e);
                    });
                })
                .catch((e) => {
                    if (e instanceof AYCDError) {
                        throw new Error(e.message);
                    }
                    this.connectionErrors += 1;
                    if (this.connectionErrors > 5) {
                        throw new Error('Failed to connect to AYCD.');
                    }
                    this.initialize();
                });
        });
    }

    async solve(captchaTask: CaptchaTask): Promise<CaptchaResponse> {
        await this.initialized;

        const aycdCaptchaTask: AutosolveTask = {
            taskId: captchaTask.taskID,
            url: captchaTask.URL,
            siteKey: captchaTask.siteKey || '',
            version: 0,
            action: captchaTask.pageAction,
            minScore: captchaTask.minScore,
            proxy: captchaTask.proxy?.toString(),
            userAgent: captchaTask.userAgent,
            proxyRequired: false,
            renderParameters: undefined,
        };

        switch (captchaTask.type) {
            case CaptchaType.RecaptchaV2:
                aycdCaptchaTask.version = 0;
                break;
            case CaptchaType.RecaptchaV2Invisible:
                aycdCaptchaTask.version = 1;
                break;
            case CaptchaType.RecaptchaV3:
                aycdCaptchaTask.version = 2;
                break;
            // case CaptchaType.HCaptcha:
            // version = 3;
            // case CaptchaType.HCaptchaInvisible:
            // version = 4
            case CaptchaType.GeeTest:
                aycdCaptchaTask.renderParameters = {};
                aycdCaptchaTask.version = 5;
                aycdCaptchaTask.siteKey = captchaTask!.geeTestParams!.gt;
                aycdCaptchaTask.renderParameters = {
                    challenge: captchaTask!.geeTestParams!.challenge,
                    api_server: captchaTask!.geeTestParams!.api_server,
                    product: captchaTask!.geeTestParams?.product,
                    lang: captchaTask!.geeTestParams?.lang,
                    new_captcha: captchaTask!.geeTestParams?.new_captcha,
                    offline: captchaTask!.geeTestParams?.offline,
                };
                deleteUndefinedProperties(aycdCaptchaTask.renderParameters);
                break;
            // case CaptchaType.RecaptcahEnterprise
            // version = 6
            default:
                throw new Error('Captcha type not yet implemented in AYCD.');
        }
        deleteUndefinedProperties(aycdCaptchaTask);

        return new Promise<CaptchaResponse>((resolve, reject) => {
            this.solver.sendTokenRequest(aycdCaptchaTask);
            this.promises.set(captchaTask.taskID, {
                captchaType: captchaTask.type,
                resolve,
                reject,
            });
        });
    }
}
