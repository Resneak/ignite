import got, {
    CacheError,
    CancelError,
    Got,
    MaxRedirectsError,
    ParseError,
    ReadError,
    RequestError,
    Response,
    TimeoutError,
    UnsupportedProtocolError,
    UploadError,
} from 'got';
import { sleep } from '../../../../lib/helpers';
import { httpsOverHttp, httpOverHttp } from 'tunnel';
import Env from '../../env';

/**
 * set this to route traffic through your proxy
 * If you have issues with charles, disable ssl proxying for px2-env-1.eba-3ip7gihp.eu-central-1.elasticbeanstalk.com
 */
const debug = {
    useProxy: false,
    proxyIP: '127.0.0.1',
    proxyPort: 8888,
};

enum PXEndpoint {
    UserAgent = 'https://px.hwkapi.com/px/ua',
    Payload1 = 'https://px.hwkapi.com/px/1',
    Payload2 = 'https://px.hwkapi.com/px/2',
    PayloadIntermediate = 'https://px.hwkapi.com/px/captcha/15',
    Hold = 'https://px.hwkapi.com/px/captcha/hold',
    Google = 'https://px.hwkapi.com/px/captcha/google',
}

export enum SupportedSite {
    Hibbett = 'hibbett',
    Solebox = 'solebox',
    Snipes = 'snipes',
    Onygo = 'onygo',
    Revolve = 'revolve',
    Walmart = 'walmart',
    Ssense = 'ssense',
}

interface Application {
    appID: string;
    domain: string;
}

interface FetchPayloadProps {
    endpoint: PXEndpoint;
    type: PXType;
    /**
     * url that was being requested when the block occured
     */
    blockURL: string;
    userAgent: string;
    metaPayload: any;
    token?: string;
}

interface SubmitPayloadProps {
    type: PXType;

    userAgent: string;

    payloadResult: string;
}

interface Payload {
    result: string;
    meta: Record<string, any>;
    delay?: number;
}

interface PXResult {
    userAgent: string;

    success: boolean;

    cookies: Record<string, string>;
}

const Applications: Record<SupportedSite, Application> = {
    hibbett: {
        appID: 'PXAJDckzHD',
        domain: 'www.hibbett.com',
    },
    solebox: {
        appID: 'PXuR63h57Z',
        domain: 'www.solebox.com',
    },
    snipes: {
        appID: 'PX6XNN2xkk',
        domain: 'www.snipes.com',
    },
    onygo: {
        appID: 'PXJ1N025xg',
        domain: 'www.onygo.com',
    },
    revolve: {
        appID: 'PX78VMO82C',
        domain: 'www.revolve.com',
    },
    walmart: {
        appID: 'PXu6b0qd2S',
        domain: 'www.walmart.com',
    },
    ssense: {
        appID: 'PX58Asv359',
        domain: 'www.ssense.com',
    },
};

/**
 * type of px block/solve
 */
enum PXType {
    Hold = 'hold',
    Normal = 'normal',
    Google = 'google',
}

export default class HawkPerimeterX {
    private readonly auth: string = '6bd1778e-ad16-42bd-8acc-fb711291fc92';

    private application: Application;

    /**
     * the client's httpClient with a configured proxy to use
     */
    private httpClient: Got;

    /**
     * the http client that will be used to make requests to the hawk api
     */
    private apiHttpClient: Got;

    /**
     * stores the state of the solver
     */
    private metadata: {
        ua?: string;
        a?: any;
        meta?: any;
    } = {};

    /**
     *
     * @param siteName (i.e. walmart)
     * @param httpClient to use while making posting payload
     */
    constructor(siteName: SupportedSite, httpClient: Got) {
        this.httpClient = httpClient;

        this.application = Applications[siteName];

        this.apiHttpClient = got.extend({
            searchParams: {
                auth: this.auth,
                appId: this.application.appID,
            },
            timeout: 10_000,
            cache: false,
            throwHttpErrors: true,
            http2: false, // not supported by hawk yet :/
            agent:
                Env.isDev && debug.useProxy
                    ? {
                          http: httpOverHttp({
                              proxy: {
                                  host: debug.proxyIP,
                                  port: debug.proxyPort,
                                  ...{ rejectUnauthorized: false },
                              },
                              ...{ rejectUnauthorized: false },
                          }),
                          https: httpsOverHttp({
                              proxy: {
                                  host: debug.proxyIP,
                                  port: debug.proxyPort,
                                  ...{ rejectUnauthorized: false },
                              },
                              ...{ rejectUnauthorized: false },
                          }) as any,
                          //   http2: new http2.proxies.Http2OverHttps({
                          //       proxyOptions: {
                          //           url: `http://${debug.proxyIP}:${debug.proxyPort}`,
                          //           ...{ rejectUnauthorized: false },
                          //       },
                          //       ...{ rejectUnauthorized: false },
                          //   }),
                      }
                    : {},
        });
    }

    /**
     * resets the px solver to it's initial state
     */
    public async reset() {
        const userAgent = this.metadata.ua;

        this.metadata = {
            ua: userAgent,
        };
    }

    /**
     *
     * @param uuid to start using/pass to api
     */
    public setUUID(uuid: string) {
        if (!this.metadata.meta) {
            this.metadata.meta = {};
        }
        this.metadata.meta.uuid = uuid;
    }

    /**
     *
     * @param vid to start using/pass to api
     */
    public setVID(vid: string) {
        if (!this.metadata.meta) {
            this.metadata.meta = {};
        }
        this.metadata.meta.vid = vid;
    }

    /**
     *
     * @param pxhdCookie to start using/pass to api
     */
    public setpxhd(pxhdCookie: string) {
        if (!this.metadata.meta) {
            this.metadata.meta = {};
        }
        this.metadata.meta.pxhd = pxhdCookie;
    }

    /**
     *
     * @returns the response for a user agent (user-agent is in plain text in the body)
     */
    public async getUserAgent() {
        return this.apiHttpClient.post(PXEndpoint.UserAgent);
    }

    /**
     *
     * @param blockURL - url that the block occurred on (not the one that you were redirected to)
     * @param userAgent to make requests with
     * @returns a promise for a px result (cookies, success, and the user agent)
     *
     * note - not all error are handled and error will bubble up so you can rotate proxies, change ua, etc.
     */
    public async solveNormal(blockURL: string, userAgent: string): Promise<PXResult> {
        const type = PXType.Normal;
        this.metadata.ua = userAgent;

        /**
         * payload 1
         */
        const fetchPayload1Props: FetchPayloadProps = {
            endpoint: PXEndpoint.Payload1,
            blockURL,
            type,
            userAgent,
            metaPayload: this.metadata,
        };
        const payload1 = await this.fetchPayload(fetchPayload1Props);
        this.metadata.meta = payload1.meta;

        /**
         * submit payload 1
         */
        const submitPayload1Props: SubmitPayloadProps = {
            type,
            userAgent,
            payloadResult: payload1.result,
        };
        const submitPayload1ResponseBody = await this.submitPayloadVIAPost(submitPayload1Props);
        this.metadata.a = submitPayload1ResponseBody;

        /**
         * payload 2
         */
        const fetchPayload2Props: FetchPayloadProps = {
            endpoint: PXEndpoint.Payload2,
            blockURL,
            type,
            userAgent,
            metaPayload: this.metadata,
        };
        const payload2 = await this.fetchPayload(fetchPayload2Props);
        this.metadata.meta = payload2.meta;

        /**
         * submit payload 2
         */
        const submitPayload2Props: SubmitPayloadProps = {
            type,
            userAgent,
            payloadResult: payload2.result,
        };
        const submitPayload2ResponseBody = await this.submitPayloadVIAPost(submitPayload2Props);

        /**
         * return cookies
         */
        const { cookies } = this.parseResponseBody(submitPayload2ResponseBody);
        return {
            userAgent: this.metadata.ua,
            cookies,
            success: Object.entries(cookies) !== [],
        };
    }

    /**
     *
     * @param blockURL - url that the block occurred on (not the one that you were redirected to)
     * @param userAgent to make requests with
     * @returns a promise for a px result (cookies, success, and the user agent)
     *
     * note - not all error are handled and error will bubble up so you can rotate proxies, change ua, etc.
     */
    public async solveHold(blockURL: string, userAgent: string): Promise<PXResult> {
        const type = PXType.Hold;
        this.metadata.ua = userAgent;

        /**
         * payload 1
         */
        const fetchPayload1Props: FetchPayloadProps = {
            endpoint: PXEndpoint.Payload1,
            blockURL,
            type,
            userAgent,
            metaPayload: this.metadata,
        };
        const payload1 = await this.fetchPayload(fetchPayload1Props);
        this.metadata.meta = payload1.meta;

        /**
         * submit payload 1
         */
        const submitPayload1Props: SubmitPayloadProps = {
            type,
            userAgent,
            payloadResult: payload1.result,
        };
        const submitPayload1ResponseBody = await this.submitPayloadVIAPost(submitPayload1Props);

        this.metadata.a = submitPayload1ResponseBody;

        /**
         * intermediate payload
         */
        const fetchPayloadIntermediateProps: FetchPayloadProps = {
            endpoint: PXEndpoint.PayloadIntermediate,
            blockURL,
            type,
            userAgent,
            metaPayload: this.metadata,
        };
        const payloadIntermediate = await this.fetchPayload(fetchPayloadIntermediateProps);
        this.metadata.meta = payloadIntermediate.meta;

        /**
         * submit intermediate payload
         */
        const submitPayloadIntermediateProps: SubmitPayloadProps = {
            type,
            userAgent,
            payloadResult: payloadIntermediate.result,
        };
        const response = await this.submitPayloadVIAGet(submitPayloadIntermediateProps);

        /**
         * payload 2
         */
        const fetchPayload2Props: FetchPayloadProps = {
            endpoint: PXEndpoint.Payload2,
            blockURL,
            type,
            userAgent,
            metaPayload: this.metadata,
        };
        const payload2 = await this.fetchPayload(fetchPayload2Props);
        this.metadata.meta = payload2.meta;

        /**
         * submit payload 2
         */
        const submitPayload2Props: SubmitPayloadProps = {
            type,
            userAgent,
            payloadResult: payload2.result,
        };
        await this.submitPayloadVIAPost(submitPayload2Props);

        /**
         * hold payload
         */
        const fetchPayloadHoldProps: FetchPayloadProps = {
            endpoint: PXEndpoint.Hold,
            blockURL,
            type,
            userAgent,
            metaPayload: this.metadata,
        };
        const payloadHold = await this.fetchPayload(fetchPayloadHoldProps);
        this.metadata.meta = payloadHold.meta;

        if (payloadHold.delay) {
            // console.log(`Waiting for delay: ${payloadHold.delay}`);
            await sleep(payloadHold?.delay * 1000);
        }

        /**
         * submit hold
         */
        const submitPayloadHoldProps: SubmitPayloadProps = {
            type,
            userAgent,
            payloadResult: payloadHold.result,
        };

        const submitPayloadHoldResponseBody = await this.submitPayloadVIAPost(submitPayloadHoldProps);

        /**
         * return cookies
         */
        const { cookies, captchaSuccess } = this.parseResponseBody(submitPayloadHoldResponseBody);
        return {
            userAgent: this.metadata.ua,
            cookies,
            success: captchaSuccess,
        };
    }

    /**
     * px collector url
     */
    private get pxURL() {
        return new URL(`https://collector-${this.application.appID.toLocaleLowerCase()}.px-cloud.net`);
    }

    /**
     *
     * @param props used in the request
     * the response body of this request is not used
     */
    private async submitPayloadVIAGet(props: SubmitPayloadProps) {
        let url = this.pxURL;
        url.pathname = '/b/g';

        let response: Response<any>;
        let attempts = 0;
        let maxAttempts = 2;
        while (attempts < maxAttempts) {
            attempts += 1;
            try {
                response = await this.httpClient.get(url.href, {
                    headers: {
                        dnt: '1',
                        'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
                        'sec-ch-ua-mobile': '?0',
                        'user-agent': props.userAgent,
                        accept: '*/*',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'no-cors',
                        'sec-fetch-dest': 'script',
                        referer: `https://${this.application.domain}/login`,
                        'accept-encoding': 'gzip, deflate, br',
                        'accept-language': 'en,de-DE;q=0.9,de;q=0.8,en-US;q=0.7',
                    },
                    searchParams: props.payloadResult,
                    throwHttpErrors: true,
                });
                if (response?.body) {
                    return response;
                }
            } catch (e) {
                // Env.isDev && console.log(e.code);
                const shouldErrorBeHandledByClient = this.shouldErrorBeHandledByClient(e);
                if (shouldErrorBeHandledByClient) {
                    throw e;
                }
            }
        }
        throw new Error(`Failed to submit payload in ${maxAttempts} attemps`);
    }

    /**
     *
     * @param props used to make the request
     * @returns cookies to be parsed in the final request of a flow
     */
    private async submitPayloadVIAPost(props: SubmitPayloadProps) {
        let url = this.pxURL;
        switch (props.type) {
            case PXType.Normal:
                url.pathname = '/api/v2/collector';
                break;

            case PXType.Hold:
                url.pathname = '/assets/js/bundle';
                break;

            case PXType.Google:
                url.pathname = '/api/v2/collector';
                break;
        }

        let response: Response<any>;
        let maxAttempts = 2;
        let attempts = 0;
        while (attempts < maxAttempts) {
            attempts += 1;
            try {
                response = await this.httpClient.post(url.href, {
                    headers: {
                        dnt: '1',
                        'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
                        'sec-ch-ua-mobile': '?0',
                        'user-agent': props.userAgent,
                        'content-type': 'application/x-www-form-urlencoded',
                        accept: '*/*',
                        origin: `https://${this.application.domain}`,
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        referer: `https://${this.application.domain}/login`,
                        'accept-encoding': 'gzip, deflate, br',
                        'accept-language': 'en-US,en;q=0.9',
                    },
                    body: props.payloadResult,
                    responseType: 'json',
                    throwHttpErrors: true,
                    timeout: 20000,
                });
                if (response.body) {
                    return response.body;
                }
            } catch (e) {
                // Env.isDev && console.log(e.code);
                const shouldErrorBeHandledByClient = this.shouldErrorBeHandledByClient(e);
                if (shouldErrorBeHandledByClient) {
                    throw e;
                }
            }
        }
        throw new Error(`Failed to submit payload in ${maxAttempts} attempts`);
    }

    /**
     *
     * @param body of a request to parse px cookies from
     * @returns cookies and whether the captcha was solved (this only pertains to google and hold solves)
     */
    private parseResponseBody(body: any) {
        const cookies: any = {};
        body?.['do']?.forEach?.((cookie: string) => {
            const cookieSplit = cookie?.split('|');
            if (cookieSplit?.[0] === 'bake' || cookieSplit?.[1] === '_pxde') {
                cookies[cookieSplit[1]] = cookieSplit[3];
            }
        });
        return {
            cookies,
            captchaSuccess: body?.['do']?.includes?.('cv|0'),
        };
    }

    /**
     *
     * @param props
     * @returns
     */
    private fetchPayload(props: FetchPayloadProps): Promise<Payload> {
        const token = props?.token ? { token: props.token } : {};

        let captcha = {};
        switch (props.type) {
            case PXType.Hold:
                captcha = { captcha: 'hold' };
                break;
            case PXType.Google:
                captcha = { captcha: 'google' };
        }

        const searchParams = {
            domain: props.blockURL,
            ...token,
            ...captcha,
        };

        const data = {
            ua: props.metaPayload.ua,
            a: props.metaPayload.a,
            ...props.metaPayload.meta,
        };

        return this.apiHttpClient
            .post(props.endpoint, {
                searchParams,
                headers: {
                    'User-Agent': props.userAgent,
                    'Upgrade-Insecure-Requests': '1',
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-User': '?1',
                    'Accept-Encoding': 'gzip, deflate',
                    'Accept-Language': 'en,de-DE;q=0.9,de;q=0.8,en-US;q=0.7',
                    'Content-Type': 'application/json',
                },
                json: data,
                responseType: 'json',
                timeout: 20000,
            })
            .then((response: Response<any>) => {
                let body: Payload;

                body = response.body;
                return body;
            });
    }

    /**
     * checks all possible Got response errors and returns a boolean
     * indicating whether the px class should retry the request or let the
     * client handle the error
     */
    private shouldErrorBeHandledByClient(error: Error) {
        let shouldRotateProxy = false;
        let shouldRetry = false;
        if (error instanceof CacheError) {
            shouldRetry = true;
        } else if (error instanceof ReadError) {
            shouldRetry = true;
        } else if (error instanceof ParseError) {
            shouldRetry = true;
        } else if (error instanceof UploadError) {
            shouldRetry = true;
        } else if (error instanceof MaxRedirectsError) {
            shouldRetry = true;
        } else if (error instanceof UnsupportedProtocolError) {
            shouldRetry = true;
        } else if (error instanceof TimeoutError) {
            shouldRetry = true;
            shouldRotateProxy = true;
        } else if (error instanceof CancelError) {
            shouldRetry = false;
        } else if (error instanceof RequestError) {
            shouldRotateProxy = true;
            shouldRetry = true;
        } else {
            // unknown error (likely an unexpected response)
            shouldRetry = true;
        }

        return !shouldRetry || shouldRotateProxy;
    }
}

export { HawkPerimeterX };
