/**
 * documentation: https://zennolab.atlassian.net/wiki/spaces/APIS/pages/491575/English%2BDocumentation
 */
import CaptchaSolver, { CaptchaTask, CaptchaType } from './captchaSolver';
import { JSONParseSafely, sleep } from '../../../../lib/helpers';
import Proxy from '../../../../lib/models/proxy';

enum ErrorID {
    SUCCESS = 0,
    FAIL = 1,
}

enum ErrorCode {
    KEY_DOES_NOT_EXIST = 'ERROR_KEY_DOES_NOT_EXIST',

    ZERO_CAPTCHA_FILESIZE = 'ERROR_ZERO_CAPTCHA_FILESIZE',

    TOO_BIG_CAPTCHA_FILESIZE = 'ERROR_TOO_BIG_CAPTCHA_FILESIZE',

    ZERO_BALANCE = 'ERROR_ZERO_BALANCE',

    IP_NOT_ALLOWED = 'ERROR_IP_NOT_ALLOWED',

    CAPTCHA_UNSOLVABLE = 'ERROR_CAPTCHA_UNSOLVABLE',

    NO_SUCH_CAPCHA_ID = 'ERROR_NO_SUCH_CAPCHA_ID',
    WRONG_CAPTCHA_ID = 'WRONG_CAPTCHA_ID',

    CAPTCHA_NOT_READY = 'CAPTCHA_NOT_READY',

    IP_BANNED = 'ERROR_IP_BANNED',

    NO_SUCH_METHOD = 'ERROR_NO_SUCH_METHOD',

    TOO_MUCH_REQUESTS = 'ERROR_TOO_MUCH_REQUESTS',
}

interface CreateTaskResponse {
    errorId: number;

    errorCode: string; //https://zennolab.atlassian.net/wiki/spaces/APIS/pages/295396/Error+Types

    taskId: number;
}

interface recaptchaSolution {
    gRecaptchaResponse: string;
}

interface getTaskResultResponse {
    errorId: number;

    errorCode: string;

    status: 'processing' | 'ready';

    solution: recaptchaSolution;
}

interface CapMonsterTask {
    type: string;

    websiteURL: string;

    websiteKey: string;
}

interface CapMonRecaptchaV2Task extends CapMonsterTask {
    type: 'NoCaptchaTask' | 'NoCaptchaTaskProxyless';

    /**
     * Some custom implementations may contain additional "data-s" parameter in ReCaptcha2 div,
     * which is in fact a one-time token and must be grabbed every time you want to solve a ReCaptcha2.
     */
    recaptchaDataSValue?: string;

    userAgent?: string;

    // format: cookiename1=cookievalue1; cookiename2=cookievalue2
    cookies?: string;

    proxyType?: 'HTTP' | 'HTTPS';

    proxyAddress?: string;
    proxyPort?: string;
    proxyLogin?: string;
    proxyPassword?: string;
}

interface CapMonRecaptchaV3Task extends CapMonsterTask {
    type: 'RecaptchaV3TaskProxyless';

    minScore: number;

    pageAction?: string;
}

interface CapMonHCaptchaTask extends CapMonsterTask {
    type: 'HCaptchaTaskProxyless' | 'HcaptchaTask';

    userAgent?: string;

    // format: cookiename1=cookievalue1; cookiename2=cookievalue2
    cookies?: string;

    proxyType?: 'HTTP' | 'HTTPS';

    proxyAddress?: string;
    proxyPort?: string;
    proxyLogin?: string;
    proxyPassword?: string;
}

export default class CaptchaMonster extends CaptchaSolver {
    constructor(apiKey: string) {
        super({
            apiKey,
            gotOptions: {
                prefixUrl: 'https://api.capmonster.cloud',
            },
        });
    }

    solve(captchaTask: CaptchaTask): Promise<string> {
        let captchaMonsterTask: CapMonsterTask;
        switch (captchaTask.type) {
            case CaptchaType.RecaptchaV2:
                captchaMonsterTask = this.getRecaptchaV2Task(captchaTask);
                break;
            case CaptchaType.RecaptchaV3:
                captchaMonsterTask = this.getRecaptchaV3Task(captchaTask);
                break;
            case CaptchaType.HCaptcha:
                captchaMonsterTask = this.getHCapchaTask(captchaTask);
                break;
            case CaptchaType.GeeTest:
                throw new Error('Captcha monster cannot solve this type of captcha. Please try a different solver.');
            default:
                throw new Error('Not yet implemented.');
        }

        return new Promise((resolve, reject) => {
            this.createTask(captchaMonsterTask)
                .then((taskId) => {
                    return this.getTaskResult(taskId);
                })
                .then((solution) => {
                    resolve(solution);
                })
                .catch((err) => {
                    reject(err);
                });
        });
    }

    private getRecaptchaV2Task(captchaTask: CaptchaTask): CapMonRecaptchaV2Task | CapMonRecaptchaV2Task {
        return {
            type: captchaTask.proxy ? 'NoCaptchaTask' : 'NoCaptchaTaskProxyless',
            websiteURL: captchaTask.URL,
            websiteKey: captchaTask.siteKey,
            userAgent: captchaTask.userAgent,
            cookies: captchaTask.cookies,
            ...this.getProxyObj(captchaTask.proxy),
        } as CapMonRecaptchaV2Task;
    }

    private getRecaptchaV3Task(captchaTask: CaptchaTask): CapMonRecaptchaV3Task {
        return {
            type: 'RecaptchaV3TaskProxyless',
            websiteURL: captchaTask.URL,
            websiteKey: captchaTask.siteKey,
            minScore: captchaTask.minScore || 0.7,
            pageAction: captchaTask.pageAction,
        } as CapMonRecaptchaV3Task;
    }

    private getHCapchaTask(captchaTask: CaptchaTask): CapMonHCaptchaTask {
        return {
            type: captchaTask.proxy ? 'HCaptchaTask' : 'HCaptchaTaskProxyless',
            websiteURL: captchaTask.URL,
            websiteKey: captchaTask.siteKey,
            userAgent: captchaTask.userAgent,
            cookies: captchaTask.cookies,
            ...this.getProxyObj(captchaTask.proxy),
        } as CapMonHCaptchaTask;
    }
    private getProxyObj(proxy?: Proxy) {
        return proxy
            ? {
                  proxyType: 'HTTPS',
                  proxyAddress: proxy.ip,
                  proxyPort: proxy.port,
                  proxyLogin: proxy.username,
                  proxyPassword: proxy.password,
              }
            : {};
    }

    private async createTask(capTask: CapMonsterTask) {
        let response;
        let unknownErrorsEncountered = 0;
        while (true) {
            try {
                // no rate limit in the documentation
                response = await this.httpClient.post(`createTask`, {
                    json: {
                        clientKey: this.apiKey,
                        task: capTask,
                    },
                });
            } catch (e) {
                throw new Error(`CapMonster: Server error, status code: ${e?.response?.statusCode}`);
            }

            const json = JSONParseSafely(response.body);
            if (!json) {
                if (++unknownErrorsEncountered > 3) {
                    throw new Error('CapMonster: Failed to solve 3 times due to unknown errors');
                }
                continue;
            }

            const { errorId, errorCode, taskId }: CreateTaskResponse = json;

            if (errorId == ErrorID.SUCCESS && taskId) {
                return taskId;
            }

            const { message, abandonCaptcha, disableSolver } = this.handleErrorCode(errorCode);
            if (disableSolver) {
                this.blockFor(this.oneDay);
                throw new Error(message);
            } else if (abandonCaptcha) {
                throw new Error(message);
            }
        }
    }

    private async getTaskResult(taskId: number) {
        await sleep(8_000);
        let unknownErrorsEncountered = 0;
        while (true) {
            let response;
            try {
                // rate limited by 120 getTaskResult requests / captcha
                response = await this.httpClient.post(`getTaskResult`, {
                    json: {
                        clientKey: this.apiKey,
                        taskId: taskId,
                    },
                });
            } catch (e) {
                throw new Error(`CapMonster: Server error, status code: ${e?.response?.statusCode}`);
            }

            const json = JSONParseSafely(response.body);
            if (!json) {
                if (++unknownErrorsEncountered > 3) {
                    throw new Error('CapMonster: Failed to solve 3 times due to unknown errors');
                }
                continue;
            }

            const { errorId, errorCode, solution } = json;

            if (errorId == ErrorID.SUCCESS && solution?.gRecaptchaResponse) {
                return solution?.gRecaptchaResponse;
            }

            const { message, abandonCaptcha, disableSolver } = this.handleErrorCode(errorCode);
            if (disableSolver) {
                this.blockFor(this.oneDay);
                throw new Error(message);
            } else if (abandonCaptcha) {
                throw new Error(message);
            }

            await sleep(600);
        }
    }

    public async getBalance() {
        return new Promise((resolve, reject) => {
            this.httpClient
                .post('getBalance')
                .then((response) => {
                    const body: { errorId: number; balance: number; errorCode?: string } | undefined = JSONParseSafely(response?.body);
                    if (!body) throw new Error('Failed to get balance');
                    resolve(body.balance);
                })
                .catch((e) => {
                    reject(e);
                });
        });
    }

    private handleErrorCode(errorCode: string | undefined) {
        let result = {
            message: '',
            abandonCaptcha: false,
            disableSolver: false,
        };

        switch (errorCode) {
            case ErrorCode.CAPTCHA_NOT_READY:
                break;
            case ErrorCode.KEY_DOES_NOT_EXIST:
                result.message = `CapMonster: ${this.errorMessages.apiKey}`;
                result.disableSolver = true;
                break;
            case ErrorCode.ZERO_CAPTCHA_FILESIZE:
            case ErrorCode.TOO_BIG_CAPTCHA_FILESIZE:
                result.message = `CapMonster: Invalid file size. \n${this.errorMessages.contact}`;
                result.abandonCaptcha = true;
                break;
            case ErrorCode.ZERO_CAPTCHA_FILESIZE:
                result.message = `CapMonster: ${this.errorMessages.zeroBalanace}. Solver blocked for 1 min`;
                this.blockFor(60_000);
                break;
            case ErrorCode.IP_NOT_ALLOWED:
                result.message = `CapMonster: Request with current account key is not allowed from your IP`;
                result.abandonCaptcha = true;
                break;
            case ErrorCode.CAPTCHA_UNSOLVABLE:
                result.message = `CapMonster: Captcha could not be solved`;
                result.abandonCaptcha = true;
                break;
            case ErrorCode.NO_SUCH_CAPCHA_ID:
            case ErrorCode.WRONG_CAPTCHA_ID:
                result.message = `CapMonster: Captcha not found (Invalid ID). ${this.errorMessages.contact}`;
                result.abandonCaptcha = true;
                break;
            case ErrorCode.IP_BANNED:
                result.message = `CapMonster: IP banned, too many requests with invalid api key`;
                result.disableSolver = true;
                break;
            case ErrorCode.NO_SUCH_METHOD:
                result.message = `CapMonster: Method not supported or empty. ${this.errorMessages.contact}`;
                result.abandonCaptcha = true;
                break;
            case ErrorCode.TOO_MUCH_REQUESTS:
                result.message = `CapMonster: Too many requests. ${this.errorMessages.contact}`;
                result.abandonCaptcha = true;
                break;
            default:
                result.message = `CapMonster: Unknown error occurred, ${this.errorMessages.contact}`;
        }
        return result;
    }
}
