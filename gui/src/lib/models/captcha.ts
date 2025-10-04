// captcha types as defined by the autosolver
// https://docs.aycd.io/docs/autosolve-messaging/
export enum CaptchaType {
    reCaptchaCheckbox = '0',
    reCaptchaInvisible = '1',
    reCaptchaScore = '2',
    hCaptchaCheckbox = '3',
    hCaptchaInvisible = '4',
    GeeTest = '5',
}

export interface Captcha {
    /**
     * id of the task
     */
    taskId: string;

    /**
     * full url of the site
     */
    url: string;

    /**
     * captcha sitekey
     */
    siteKey: string;

    /**
     * type of captcha to be solved
     */
    version: CaptchaType;

    /**
     * action (required for V3 only)
     */
    action?: string;

    /**
     * map object for parameters for ReCaptcha v2, in the grecaptcha.render method
     */
    renderParameters?: any;

    /**
     * minimum score required to pass the recaptcha
     */
    minScore?: number;

    /**
     * proxy to be used in the task which got the captcha, Formatted as IP:PORT:USER:PASS
     */
    proxy?: string;

    /**
     * is proxy required, some captcha services don't support use of proxies
     * and will not be used if a proxy is necessary for captcha processing
     * default is false
     */
    proxyRequired?: boolean;
}

export interface CaptchaResponse {
    /**
     * the taskId provided in the request for the token
     */
    taskId: string;

    /**
     * the g-recaptcha-response token
     */
    token: string;

    /**
     * timestamp representing seconds from epoch to UTC
     */
    createdAt: number;

    /**
     * original request object used to generate the token
     */
    request: any;
}
