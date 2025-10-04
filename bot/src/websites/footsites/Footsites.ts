import got, { Options } from 'got';
import { v4 as uuid } from 'uuid';
import { randomNumber, sleep } from '../../../../lib/helpers';
import ddExecuteCaptchaChallenge from '../../models/captchaSolvers/captchaChallenge';
import BotTask, { BotTaskProperties } from '../../models/tasks/botTask';
import { TaskEvent, TaskStatusColor } from '../../../../lib/models/taskUpdate';
import Size from '../../../../lib/models/size';
import { FootsitesModes } from './footsites.config';
import CacheNodeGroup from '../../../../lib/models/cacheNodeGroup';
import { CaptchaTask, CaptchaType, GeeTestParams, GeeTestResponse } from '../../models/captchaSolvers/captchaSolver';
import Env from '../../env';
import FootsitesManager, { CacheNodeUpdate } from './footsitesManager';
import { pollRandomEvent } from '../../../../cli/src/utils/general';
import Sizes from '../../../../lib/models/sizes';
import { Cookie } from 'tough-cookie';
const adyen18 = require('../../utils/cryptography/adyen18');
import { executeChallenge } from '../../utils/cryptography/pow';

export interface StyleAttribute {
    id: string;

    type: 'style';

    /**
     * style description (e.g. Black/White/University Red)
     */
    value: string;
}

export interface SizeAttribute {
    id: string;

    type: 'style';

    /**
     * size double (e.g. '07.5')
     */
    value: string;
}
export interface SizeGroup {
    attributes: Array<SizeAttribute | StyleAttribute>;
    barcode: string;
    code: string;
    isBackOrderable: boolean;
    isPreOrder: boolean;
    isRecaptchaOn: boolean;
    price: any;
    singleStoreInventory: boolean;
    sizeAvailableInStores: boolean;
    stockLevelStatus: 'inStock' | 'outOfStock';
    sizeAvailableInStoresMessage: string;
}

export interface VariantAttributes {
    code: string;
    cstSkuLaunchDate: string | undefined;
    definedTimeForCountDown: string;
    displayCountDownTimer: boolean;
    eligiblePaymentTypesForProduct: string;
    fitVariant: string;
    freeShipping: boolean;
    freeShippingMessage: boolean;
    isSelected: boolean;
    launchProduct: boolean;
    mapEnable: boolean;
    pdpActivationDate: string;
    price: any;
    recaptchaOn: boolean;
    riskified: boolean;
    shipToAndFromStore: boolean;
    shippingRestrictionExists: boolean;
    sku: string;
    skuExclusions: boolean;
    skuLaunchDate: string;
    stockLevelStatus: string;
    webOnlyLaunch: boolean;
    /**
     * e.g. Width - D - Medium'
     */
    width: string;
}

interface PDP {
    skuLaunch: number;
    sizes: Size[];
    name: string;
    image: string;
    price: string;
    isRecaptchaEnabled: boolean;
}

export default class Footsites extends BotTask {
    private static RandomTaskCount: { [id: string]: number } = {};
    private static PDPs: {
        [id: string]: PDP;
    } = {};

    protected *execute() {
        this.manager.onStart();
        this.rotateProxy();

        //yield this.initializeSession();
        yield this.parseProduct();

        yield this.addToCart();

        const useMobileShipping = true;
        if (useMobileShipping) {
            yield this.submitShippingMobile();
        }

        if (!this.submittedShipping) {
            yield this.parallelize([this.submitContact, this.submitShipping, this.submitBilling]);
        }

        yield this.submitPayment();
    }

    /**
     * host name of the site
     *
     * e.g. www.footlocker.com
     */
    private readonly host: string;

    /**
     * base url of the site
     *
     * e.g. https://www.footlocker.com
     */
    private url: string;

    private cacheNodeMethod: 'random' | 'poll-api';

    private cacheNodeGroup: CacheNodeGroup;

    private manager: FootsitesManager;

    /**
     * value of the retry delay if set, otherwise checkout delay
     */
    private readonly delay: number;

    /**
     * whether the recaptcha is enabled for the product
     */
    private recapEnabled?: boolean;

    private csrfToken?: string;

    private cartGUID?: string;

    private queueItUserId?: string;
    private queueItMeta?: string;
    private queueItSessionId?: string;
    private queueItPowParametersInput?: string;
    private queueItPowParametersZeroCount?: string;
    private queueItCustomerId?: string;
    private queueItEventId?: string;
    private queueItVersion?: any;
    private queueItChallengesPresent?: any;
    private queueItChallengeSessions: Array<any | undefined> = [];
    private queueItLayout?: string;
    private queueItCustomUrlParams?: string;
    private queueItTargetUrl?: string;
    private queueItQueueId?: string;
    private queueItLayoutVersion?: any;
    private queueItRedirectUrl?: string;
    private queueItInvisibleCaptchaKey?: string;

    private dataReductionClipped = true;

    private submittedShipping = false;

    private strategy: 'MinFirstTTL' | 'ShieldBypass' = 'ShieldBypass';

    private shouldSpamATC = false;

    private userAgent!: string;
    private deviceID: string;
    private apiKey = 'm38t5V0ZmfTsRpKIiQlszub1Tx4FbnGG';
    private apiIdentifier = '921B2b33cAfba5WWcb0bc32d5ix89c6b0f614';
    private getRequestID = () => uuid();
    private getSessionID = () => this.cookieJar.getCookieStringSync(`https://${this.host}`).split('JSESSIONID=')?.[1]?.split(';')?.[0];

    private productGroups: {
        store: string;
        pid: string;
        sizes: Sizes;
    };

    private getCacheNodeMethod() {
        if (Footsites.RandomTaskCount[this.task.product.id] === undefined) Footsites.RandomTaskCount[this.task.product.id] = 0;
        let shouldUseRandom;
        // if (Env.isDev) {
        //     shouldUseRandom = Footsites.RandomTaskCount[this.task.product.id] < 1;
        // } else {
        shouldUseRandom = Footsites.RandomTaskCount[this.task.product.id] < 3 || pollRandomEvent(5, 100);
        // }
        if (shouldUseRandom) Footsites.RandomTaskCount[this.task.product.id] += 1;
        return shouldUseRandom ? 'random' : 'poll-api';
    }

    constructor(botTaskProps: BotTaskProperties) {
        super(botTaskProps);

        this.host = `www.${this.website.url.hostname}`;
        this.host = 'staging.kidsfootlocker.com'
        this.url = `https://${this.host}`;
        this.url = 'https://staging.kidsfootlocker.com'
        this.deviceID = uuid();
        this.setUserAgent();
        this.delay = this.task.retryDelay ? this.task.retryDelay : this.task.checkoutDelay;

        this.cacheNodeMethod = this.getCacheNodeMethod();

        this.cacheNodeGroup = CacheNodeGroup.getInstance();

        this.productGroups = { store: this.task.websiteName, pid: this.task.product.id, sizes: this.task.sizes };

        this.manager = FootsitesManager.getInstance(this.productGroups);

        const options: Options = {
            throwHttpErrors: true,
            https: {
                rejectUnauthorized: false,
                checkServerIdentity: (hostname) => {
                    if (hostname === this.host) {
                        return;
                    } else {
                        return new Error('Invalid Hostname');
                    }
                },
            },
        };
        this.updateHttpOptions(options);
    }

    protected rotateProxy() {
        const proxy = this.proxies.getItem();
        if (proxy) {
            this.proxy = proxy;

            this.updateHttpOptions({
                agent: {
                    https: proxy.getHttpsProxyAgent({
                        rejectUnauthorized: false,
                        checkServerIdentity: (hostname) => {
                            if (hostname === this.host) {
                                return;
                            } else {
                                return new Error('Invalid Hostname');
                            }
                        },
                    }),
                },
            });
        }
    }

    private setUserAgent() {
        this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:88.0) Gecko/20100101 Firefox/88.0';
    }

    private async getProduct() {
        loop: while (!this.shouldStopTask) {
            let options: Options = {};
            if (this.strategy === 'ShieldBypass') {
                options = {
                    headers: {
                        'user-agent': this.userAgent,
                        accept: 'application/json',
                        'x-fl-device-id': this.deviceID,
                        'accept-language': 'en-us',
                        'x-fl-app-version': '4.6.1',
                        'x-api-key': this.apiKey,
                        'x-flapi-api-identifier': this.apiIdentifier,
                        'x-fl-request-id': uuid(),
                        'accept-encoding': 'gzip, deflate, br',
                        'x-flapi-session-id': this.getSessionID(),
                        'x-csrf-token': this.csrfToken,
                        Host: this.host,
                        host: `${this.host}:443`,
                    },
                };
            } else {
                options = {
                    headers: {
                        host: `${this.host}`,
                        referer: '',
                    },
                };
            }
            try {
                this.updateStatus('Getting product page', TaskStatusColor.Info);
                let url = this.queueItRedirectUrl ? this.queueItRedirectUrl : `${this.url}/product/~/${this.task.product.id}.html`;
                const response = await this.sendRequest('GET', url, {
                    ...options,
                });
                if (response.statusCode === 200) {
                    this.updateStatus(`Got product page`);
                    return;
                } else if (response.statusCode === 302) {
                    await this.onQueueItRedirect(response?.headers['location']);
                    continue loop;
                } else {
                    this.updateStatus(`Failed to load product page response`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    await sleep(this.delay);
                    continue loop;
                }
            } catch (e) {
                if (e?.response?.statusCode === 529) {
                    this.setStatus(`In queue...`, TaskStatusColor.Warning);
                    await sleep(5000);
                    continue loop;
                } else if (e?.response?.statusCode === 400) {
                    let errorMessage = e.response.body.errors[0].message;
                    this.setStatus(errorMessage, TaskStatusColor.Warning);
                    await sleep(this.delay);
                    continue loop;
                }
                this.setStatus(`Get product page request failed.`, TaskStatusColor.Warning);
                await sleep(this.delay);
                continue loop;
            }
        }
    }

    async initializeSession() {
        this.updateStatus('Generating session...', TaskStatusColor.Neutral);
        let failedAttempts = 0;
        loop: while (!this.shouldStopTask) {
            try {
                const method = 'GET';
                let options: Options = {};
                let url;
                if (this.strategy === 'ShieldBypass') {
                    url = `${this.url}/apigate/v3/session`;
                    options = {
                        headers: {
                            'user-agent': this.userAgent,
                            accept: 'application/json',
                            'x-fl-device-id': this.deviceID,
                            'accept-language': 'en-us',
                            'x-fl-app-version': '4.6.1',
                            'x-api-key': this.apiKey,
                            'x-flapi-api-identifier': this.apiIdentifier,
                            'x-fl-request-id': uuid(),
                            'accept-encoding': 'gzip, deflate, br',
                            Host: this.host,
                            host: `${this.host}:443`,
                        },
                    };
                } else {
                    url = `${this.url}/api/session`;
                    options = {
                        headers: {
                            host: `${this.host}`,
                            referer: '',
                        },
                    };
                }

                const response = await this.sendRequest(method, url, {
                    ...options,
                    searchParams: {
                        timestamp: Date.now(),
                    },
                    responseType: 'json',
                });

                if (typeof response.body === 'object') {
                    if (response.body?.success) {
                        this.csrfToken = response.body?.data?.csrfToken;
                        this.updateStatus(`Generated session.`, TaskStatusColor.Info);
                        return;
                    } else {
                        failedAttempts += 1;
                        this.setStatus(`Failed to generate session, error: ${response.body?.errors}`, TaskStatusColor.Warning);
                        if (`${response.body?.errors.includes('tunneling socket could not be established')}`) this.rotateProxy();

                        if (response?.statusCode === 405) {
                            this.dataReductionClipped = true;
                            this.updateStatus('Data reduction method clipped', TaskStatusColor.Warning);
                        } else if (response?.statusCode === 529) {
                            this.setStatus(`In queue...`, TaskStatusColor.Warning);
                            await sleep(5000);
                            continue loop;
                        } else if (response?.statusCode === 403 || response?.statusCode === 429) {
                            if (failedAttempts > 15) {
                                this.strategy = 'MinFirstTTL';
                                this.setUserAgent();
                            }
                            this.rotateProxy();
                        }

                        await sleep(this.delay);
                        continue loop;
                    }
                } else {
                    this.setStatus(`Error loading session response.`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    await sleep(this.delay);
                    continue loop;
                }
            } catch (e) {
                failedAttempts += 1;
                if (e?.response?.statusCode === 405 || /NOHE/.test(e?.toString())) {
                    this.dataReductionClipped = true;
                    this.updateStatus('Data reduction method clipped', TaskStatusColor.Warning);
                } else if (e?.response?.statusCode === 529) {
                    this.setStatus(`In queue...`, TaskStatusColor.Warning);
                    await sleep(5000);
                    continue loop;
                }

                this.setStatus(`Failed to generate session, error ${e.toString()}`, TaskStatusColor.Warning);

                if (e?.response?.statusCode === 403 || e?.response?.statusCode === 429 || /ECONNREFUSED/.test(e?.toString())) {
                    if (failedAttempts > 15) {
                        this.strategy = 'MinFirstTTL';
                        this.setUserAgent();
                    }
                    this.rotateProxy();
                }
                await sleep(this.delay);
                continue loop;
            }
        }
    }

    private async parseProduct() {
        const getAvailableSizes = (sizeGroups: SizeGroup[], codePrefix: string) => {
            const sizes: Size[] = [];
            for (const sizeGroup of sizeGroups) {
                const sizeAttr = sizeGroup.attributes.find((attribute: SizeAttribute | StyleAttribute) => {
                    const isSizeAttr = (attribute.type as string) === 'size';
                    const isCorrectVariant = new RegExp(`^${codePrefix}`).test(attribute.id);
                    return isSizeAttr && isCorrectVariant;
                });
                if (sizeAttr) sizes.push(new Size(`${parseFloat(sizeAttr.value)}`, `${parseFloat(sizeAttr.value)}`, sizeAttr.id));
            }
            return sizes;
        };

        loop: while (!this.shouldStopTask) {
            const skuPDP = Footsites.PDPs[this.task.product.id];
            if (skuPDP) {
                this.task.product.name = skuPDP.name;
                this.task.product.image = skuPDP.image;

                this.task.sizes.setAvailableSizes(skuPDP.sizes);
                const millisecondsToWait = skuPDP.skuLaunch - Date.now();
                if (millisecondsToWait > 0) {
                    const secondsUntilLaunch = Math.floor(millisecondsToWait / 1000);
                    const seconds = secondsUntilLaunch % 60;
                    const minutes = Math.floor((secondsUntilLaunch / 60) % 60);
                    const hours = Math.floor(secondsUntilLaunch / 3600);
                    this.updateStatus(
                        `Waiting for product to launch. Launching in ${hours > 0 ? String(hours) + 'hr ' : ''}${
                            minutes > 0 ? String(minutes) + 'min ' : ''
                        }${seconds}s`,
                        TaskStatusColor.Info
                    );

                    const requestTime = (Math.random() * 1.0 + 0.5) * 1000; // between 0.5 sec and 1.5 sec
                    await sleep(millisecondsToWait - requestTime);
                    this.shouldSpamATC = true;
                }

                this.task.product.price = skuPDP.price;
                this.recapEnabled = skuPDP.isRecaptchaEnabled;
                if (this.task.sizes.availableSizes.length > 0) {
                    break;
                } else {
                    this.updateStatus(`Selected sizes OOS or not loaded.`, TaskStatusColor.Warning);
                }
            }

            let options: Options = {};
            if (this.strategy === 'ShieldBypass') {
                options = {
                    headers: {
                        'user-agent': this.userAgent,
                        accept: 'application/json',
                        'x-fl-device-id': this.deviceID,
                        'accept-language': 'en-us',
                        'x-fl-app-version': '4.6.1',
                        'x-api-key': this.apiKey,
                        'x-flapi-api-identifier': this.apiIdentifier,
                        'x-fl-request-id': uuid(),
                        'accept-encoding': 'gzip, deflate, br',
                        'x-flapi-session-id': this.getSessionID(),
                        'x-csrf-token': this.csrfToken,
                        Host: this.host,
                        host: `${this.host}:443`,
                    },
                };
            } else {
                options = {
                    headers: {
                        host: `${this.host}`,
                        referer: '',
                    },
                };
            }
            try {
                this.updateStatus('Getting PDP', TaskStatusColor.Neutral);
                let url = `${this.url}/api/products/pdp/${this.task.product.id}?e_stgtimtest~q_157987ed-f03d-4862-813f-7f8c9bcc6d8f~ts_1629007672~ce_true~rt_queue~h_dffae7235a505249aa58a6dced0a6d844a59052387cde0a7546ed88bf7a15bbc`;
                // const response = await this.sendRequest('GET', `${this.url}/api/products/pdp/${this.task.product.id}`, {
                const response = await this.sendRequest('GET', url, {
                    ...options,
                    searchParams: {
                        timestamp: Date.now(),
                    },
                    responseType: 'json',
                });
                if (typeof response.body === 'object') {
                    const productName = response.body.name;
                    const variants = response.body.variantAttributes as VariantAttributes[];
                    const variant = variants.find((v) => v.sku === this.task.product.id);
                    const code = variant?.code;
                    const codePrefix = `${code}`.substr(0, 4);
                    const images = response.body.images || [];
                    const productImage = images.find((item) => item.code === code)?.variations?.find((item) => item.format === 'small')?.url;

                    const sizeGroups = response.body.sellableUnits as SizeGroup[];
                    const availableSizes = getAvailableSizes(sizeGroups, codePrefix);

                    if (availableSizes.length === 0) {
                        this.updateStatus('Product not loaded.', TaskStatusColor.Warning);
                        await sleep(this.delay);
                    } else if (!variant) {
                        this.updateStatus('Failed to find variant', TaskStatusColor.Warning);
                        await sleep(this.delay);
                    } else {
                        const skuLaunch = variant.skuLaunchDate ? Date.parse(variant.skuLaunchDate) : 0;
                        const price = variant.price.formattedOriginalPrice;
                        const isRecaptchaEnabled = variant.recaptchaOn;
                        const pdp: PDP = {
                            skuLaunch,
                            sizes: availableSizes,
                            name: productName,
                            image: productImage,
                            price,
                            isRecaptchaEnabled,
                        };
                        Footsites.PDPs[this.task.product.id] = pdp;
                    }
                    continue loop;
                } else if (response.statusCode === 302) {
                    this.updateStatus(`Detected queue-it`, TaskStatusColor.Warning);
                    await this.getProduct();
                    // await this.onQueueItRedirect(response?.headers['location']);
                    continue loop;
                } else {
                    this.updateStatus(`Failed to load product response (PID: ${this.task.product.id}).`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    await sleep(this.delay);
                    continue loop;
                }
            } catch (e) {
                if (e?.response?.statusCode === 529) {
                    this.setStatus(`In queue...`, TaskStatusColor.Warning);
                    await sleep(5000);
                    continue loop;
                } else if (e?.response?.statusCode === 400) {
                    let errorMessage = e.response.body.errors[0].message;
                    this.setStatus(errorMessage, TaskStatusColor.Warning);
                    await sleep(this.delay);
                    continue loop;
                }
                console.log(e.response.body);
                this.setStatus(`Fetch product request failed.`, TaskStatusColor.Warning);
                await sleep(this.delay);
                continue loop;
            }
        }
        this.updateStatus(`Successfully found sizes in stock. Recaptcha enabled: ${this.recapEnabled}`, TaskStatusColor.Info);
    }

    async addToCart() {
        this.updateStatus('Adding to Cart...', TaskStatusColor.Neutral);
        let tries = 0;

        if (this.shouldSpamATC) {
            // 80% of 'poll-api' tasks will spam atc, reserve 20% for spamming misses
            this.shouldSpamATC = pollRandomEvent(8, 10);
        }

        const getNextATC = async () => {
            let cacheNodeName;
            let size;
            let ttl = 0;

            if (this.cacheNodeMethod === 'random' || this.shouldSpamATC) {
                size = this.task.sizes.getNextSize();
                cacheNodeName = this.cacheNodeGroup.getItem();
                this.shouldSpamATC = false;
            } else {
                const cacheNode = await this.manager.getNextCacheNode(this.productGroups);
                cacheNodeName = cacheNode.name;
                ttl = cacheNode.ttl;
                size = this.task.sizes.availableSizes.find((s) => parseFloat(s?.value) === parseFloat(cacheNode.productGroup.size));
                if (cacheNode.productGroup.pid !== this.task.product.id) {
                    Env.isDev && console.log(`Error: PID received is not the PID for this task`);
                    return getNextATC();
                } else if (!size) {
                    Env.isDev && console.log(`Error: Size ${cacheNode.productGroup.store} does not exist in available sizes`);
                    return getNextATC();
                }
            }
            return {
                cacheNodeName,
                size,
                ttl,
            };
        };

        const formatXCache = (response) => {
            const xCache = `${response?.headers?.['x-cache']}`
                ?.split(', ')
                ?.map((item) => item?.replace('HIT', '+')?.replace('MISS', '-'))
                ?.join('')
                .trim();
            return xCache;
        };

        loop: while (!this.shouldStopTask) {
            tries += 1;
            let options: Options = {};

            const { cacheNodeName, size, ttl } = await getNextATC();
            this.setURL(cacheNodeName);
            this.task.product.size = size;
            const msToWait = this.getTimeToWait(ttl);
            await sleep(msToWait);

            let url = `${this.url}/apigate/users/carts/current/entries`;

            if (this.strategy === 'ShieldBypass') {
                options = {
                    headers: {
                        'user-agent': this.userAgent,
                        accept: 'application/json',
                        'x-fl-device-id': this.deviceID,
                        'accept-language': 'en-us',
                        'x-fl-app-version': '4.6.1',
                        'x-api-key': this.apiKey,
                        'x-flapi-api-identifier': this.apiIdentifier,
                        'x-fl-request-id': this.getRequestID(),
                        'accept-encoding': 'gzip, deflate, br',
                        'x-flapi-session-id': this.getSessionID(),
                        'x-csrf-token': this.csrfToken,
                        'x-fl-productid': this.task.product.size!.code,
                        // 'cache-control': `${'----------'.repeat(50)}`, // 500
                        // 'cache-control': `${'------------------------'.repeat(1000)}`, // 24k
                        'cache-control': 'no-cache',
                        pragma: 'no-cache',
                        'spoof-host': 'www.footlocker.com',
                        'fastly-debug': '1',
                        // connection: 'keep-alive',
                        connection: 'close',
                        host: this.host,
                        'content-type': 'application/json',
                        'Fastly-FF': 'bwi5039-BWI',
                    },
                };
            } else {
                const cacheNodeRequestOptions = this.getCacheNodeRequestOptions(cacheNodeName);
                url = `${this.url}/apigate/users/carts/current/entries`;
                options = {
                    headers: {
                        accept: 'application/json',
                        referer: `https://${this.host}/`,
                        'x-fl-request-id': uuid(),
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:88.0) Gecko/20100101 Firefox/88.0',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'accept-encoding': 'gzip, deflate, br',
                        origin: `https://${this.host}`,
                        'x-fl-productid': this.task.product.size!.code,
                        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0, max-stale=0, post-check=0, pre-check=0',
                        Pragma: 'no-cache',
                        Expires: '0',
                        Vary: '*',
                        'x-csrf-token': this.csrfToken,
                        ...cacheNodeRequestOptions.headers,
                    },
                    ...cacheNodeRequestOptions.options,
                };
            }

            try {
                const response = await this.sendRequest('POST', url, {
                    responseType: 'json',
                    searchParams: {
                        timestamp: Date.now(),
                    },
                    json: {
                        productQuantity: this.task.atcQuantity,
                        productId: this.task.product.size!.code,
                    },
                    ...options,
                });

                if (typeof response?.body === 'object') {
                    if (response.body.totalUnitCount !== 0) {
                        this.cartGUID = response.body.guid;
                        if (this.cartGUID === undefined) {
                            this.updateStatus('Failed to find Cart ID. Retrying ATC...', TaskStatusColor.Warning);
                            await sleep(this.delay);
                            continue loop;
                        }
                        this.task.product.price = response.body.subTotal?.formattedValue;
                        this.setStatus(
                            `'${this.task.product.name} - ${this.task.product.size?.toString()}' added to your cart. ${formatXCache(response)}`,
                            TaskStatusColor.Cart,
                            TaskEvent.Carted
                        );
                        this.updateCacheNode({ headers: response?.headers, ttl }, true);
                        this.setURL('');

                        response?.headers?.['set-cookie']?.forEach((cookieStr) => {
                            const cookie = Cookie.parse(cookieStr);
                            if (!cookie) return;
                            const expires = cookie.expires === 'Infinity' ? new Date(Date.now() + 300_000) : cookie.expires;
                            const lastAccessed = cookie.lastAccessed === null ? new Date() : cookie.lastAccessed;
                            const creation = cookie.creation === null ? new Date() : cookie.creation;
                            const footsitesCookie = new Cookie({
                                key: cookie.key,
                                value: cookie.value,
                                expires: expires,
                                maxAge: cookie.maxAge,
                                domain: this.host,
                                path: '/',
                                hostOnly: true,
                                creation: creation,
                                lastAccessed: lastAccessed,
                            });
                            try {
                                this.cookieJar.setCookieSync(footsitesCookie, this.url);
                            } catch (e) {
                                Env.isDev && console.error(e);
                            }
                        });
                        return;
                    } else {
                        this.updateStatus(`Unknown error adding to cart. (${response?.statusCode})`, TaskStatusColor.Warning);
                        await sleep(this.delay);
                        continue loop;
                    }
                } else {
                    this.updateStatus('Failed to load ATC response.', TaskStatusColor.Warning);
                    await sleep(this.delay);
                    continue loop;
                }
            } catch (e) {
                if (e?.response?.body?.url && /captcha-delivery/.test(e.response.body.url)) {
                    await this.onCaptchaDelivery(e.response.body.url);
                    await sleep(this.delay);
                    continue loop;
                } else if (e?.response?.statusCode === 531) {
                    this.updateCacheNode({ headers: e?.response?.headers, ttl });
                    this.updateStatus(`Product OOS, retrying... ${formatXCache(e?.response)}`, TaskStatusColor.Warning);

                    await sleep(this.delay);

                    continue loop;
                } else if (e?.response?.statusCode === 429) {
                    this.updateStatus(`429 on ATC, retrying...`, TaskStatusColor.Warning);
                    await sleep(this.delay);
                    continue loop;
                } else if (e?.response?.body?.errors?.length > 0) {
                    this.updateStatus(`Failed adding to cart, message: ${e.response.body.errors[0].type}`, TaskStatusColor.Warning);
                    await sleep(this.delay);
                    continue loop;
                } else if (e?.response?.statusCode === 529) {
                    this.setStatus(`In queue...`, TaskStatusColor.Warning);
                    await sleep(5000);
                    continue loop;
                } else if (e?.response?.statusCode === 418) {
                    this.setStatus(`ATC error, rotating proxy...`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    await sleep(this.delay);
                    continue loop;
                }

                let failedStatus;
                if (e?.response?.statusCode === undefined) {
                    failedStatus = 'N/A';
                } else {
                    failedStatus = e?.response?.statusCode;
                }
                Env.isDev && console.log(e?.name);
                this.setStatus(`ATC request failed (${failedStatus})`, TaskStatusColor.Warning);
                this.rotateProxy();
                await sleep(this.delay);
                continue loop;
            }
        }
    }

    async submitContact() {
        loop: while (!this.shouldStopTask) {
            this.updateStatus('Submitting email...', TaskStatusColor.Neutral);
            let options: Options = {};
            let url;
            if (this.strategy === 'ShieldBypass') {
                url = `${this.url}/apigate/users/carts/current/email/${this.profile.shippingAddress.email}`;
                options = {
                    headers: {
                        referer: `https://www.${this.website.name}.com/checkout`,
                        cookie: `${this.cookieJar.getCookieStringSync(`${this.url}`)};`,
                        'user-agent': this.userAgent,
                        accept: 'application/json',
                        'x-fl-device-id': this.deviceID,
                        'accept-language': 'en-us',
                        'x-fl-app-version': '4.6.1',
                        'x-api-key': this.apiKey,
                        'x-flapi-api-identifier': this.apiIdentifier,
                        'x-fl-request-id': this.getRequestID(),
                        'accept-encoding': 'gzip, deflate, br',
                        'x-flapi-session-id': this.getSessionID(),
                        'x-csrf-token': this.csrfToken,
                        'x-flapi-cart-guid': this.cartGUID,
                        'content-type': 'application/json',
                        Host: this.host,
                        host: `${this.host}:443`,
                    },
                };
            } else {
                url = `${this.url}/api/users/carts/current/email/${this.profile.shippingAddress.email}`;
                options = {
                    headers: {
                        host: `${this.host}`,
                        'x-csrf-token': this.csrfToken,
                        'x-flapi-session-id': this.cookieJar.getCookieStringSync(`${this.url}`).split('JSESSIONID=')?.[1]?.split(';')?.[0],
                        'x-fl-request-id': uuid(),
                        referer: `https://www.${this.website.name}.com/checkout`,
                        'fastly-restart-on-error': '1',
                        cookie: `${this.cookieJar.getCookieStringSync(`${this.url}`)};`,
                    },
                };
            }

            try {
                const response = await this.sendRequest('PUT', url, {
                    searchParams: {
                        timestamp: Date.now(),
                    },
                    ...options,
                });

                if (response?.statusCode === 200) {
                    this.updateStatus('Successfully submitted email.', TaskStatusColor.Info);
                    return;
                } else {
                    this.updateStatus('Submitting email failed', TaskStatusColor.Warning);
                    await sleep(this.delay);
                    continue loop;
                }
            } catch (e) {
                if (e?.response?.body?.url && /captcha-delivery/.test(e.response.body.url)) {
                    await this.onCaptchaDelivery(e.response.body.url);
                    await sleep(this.delay);
                    continue loop;
                }

                if (e?.response?.statusCode === 529) {
                    this.setStatus(`In queue...`, TaskStatusColor.Warning);
                    await sleep(5000);
                    continue loop;
                }
                this.setStatus('Failed to submit email.', TaskStatusColor.Warning);
                await sleep(this.delay);
                continue loop;
            }
        }
    }

    async submitShipping() {
        loop: while (!this.shouldStopTask) {
            this.updateStatus('Submitting shipping info...', TaskStatusColor.Neutral);

            try {
                let options: Options = {};
                let url;
                if (this.strategy === 'ShieldBypass') {
                    url = `${this.url}/api/users/carts/current/addresses/shipping`;
                    options = {
                        headers: {
                            referer: `https://www.${this.website.name}.com/checkout`,
                            'user-agent': this.userAgent,
                            accept: 'application/json',
                            'x-fl-device-id': this.deviceID,
                            'accept-language': 'en-us',
                            'x-fl-app-version': '4.6.1',
                            'x-api-key': this.apiKey,
                            'x-flapi-api-identifier': this.apiIdentifier,
                            'x-fl-request-id': this.getRequestID(),
                            'accept-encoding': 'gzip, deflate, br',
                            'x-flapi-session-id': this.getSessionID(),
                            'x-csrf-token': this.csrfToken,
                            'x-flapi-cart-guid': this.cartGUID,
                            'content-type': 'application/json',
                            Host: this.host,
                            host: `${this.host}:443`,
                        },
                    };
                } else {
                    url = `${this.url}/apigate/users/carts/current/addresses/shipping`;
                    options = {
                        headers: {
                            host: `${this.host}`,
                            'x-csrf-token': this.csrfToken,
                            'x-flapi-session-id': this.cookieJar.getCookieStringSync(`${this.url}`).split('JSESSIONID=')?.[1]?.split(';')?.[0],
                            'x-fl-request-id': uuid(),
                            referer: `https://www.${this.website.name}.com/checkout`,
                            'fastly-restart-on-error': '1',
                            cookie: `${this.cookieJar.getCookieStringSync(`${this.url}`)};`,
                        },
                    };
                }

                const response = await this.sendRequest('POST', url, {
                    searchParams: {
                        timestamp: Date.now(),
                    },
                    responseType: 'json',
                    json: {
                        shippingAddress: {
                            setAsDefaultBilling: false,
                            setAsDefaultShipping: false,
                            firstName: this.profile.shippingAddress.firstName,
                            lastName: this.profile.shippingAddress.lastName,
                            email: this.profile.shippingAddress.email,
                            phone: this.profile.shippingAddress.phone,
                            country: {
                                isocode: this.profile.shippingAddress.country,
                                name: this.profile.shippingAddress.country === 'US' ? 'United States' : 'Canada',
                            },
                            id: null,
                            setAsBilling: false,
                            region: {
                                countryIso: this.profile.shippingAddress.country,
                                isocode: `${this.profile.shippingAddress.country}-${this.profile.shippingAddress.stateCode}`,
                                isocodeShort: this.profile.shippingAddress.stateCode,
                                name: this.profile.shippingAddress.state,
                            },
                            type: 'default',
                            LoqateSearch: '',
                            line1: this.profile.shippingAddress.address,
                            line2: this.profile.shippingAddress.secondaryAddress,
                            postalCode: this.profile.shippingAddress.zip,
                            town: this.profile.shippingAddress.city,
                            regionFPO: null,
                            shippingAddress: true,
                            recordType: 'S',
                        },
                    },
                    ...options,
                });

                if (response?.statusCode !== 201) {
                    this.updateStatus(
                        `Failed to submit shipping info.', 'warn - Error: ${JSON.stringify(response?.body?.fieldErrors)}`,
                        TaskStatusColor.Warning
                    );
                    await sleep(this.delay);
                    continue loop;
                } else {
                    this.updateStatus('Successfully submitted shipping info.', TaskStatusColor.Info);
                    return;
                }
            } catch (e) {
                if (e?.response?.body?.url && /captcha-delivery/.test(e.response.body.url)) {
                    await this.onCaptchaDelivery(e.response.body.url);
                    await sleep(this.delay);
                    continue loop;
                }

                if (e?.response?.statusCode === 529) {
                    this.setStatus(`In queue...`, TaskStatusColor.Warning);
                    await sleep(5000);
                    continue loop;
                }
                this.setStatus(`Submitting shipping info failed - Error: ${e.toString()}`, TaskStatusColor.Warning);
                await sleep(this.delay);
                continue loop;
            }
        }
    }

    async submitBilling() {
        loop: while (!this.shouldStopTask) {
            this.updateStatus('Submitting billing info...', TaskStatusColor.Neutral);

            try {
                let options: Options = {};
                let url;
                if (this.strategy === 'ShieldBypass') {
                    url = `${this.url}/apigate/users/carts/current/set-billing`;
                    options = {
                        headers: {
                            referer: `https://www.${this.website.name}.com/checkout`,

                            'user-agent': this.userAgent,
                            accept: 'application/json',
                            'x-fl-device-id': this.deviceID,
                            'accept-language': 'en-us',
                            'x-fl-app-version': '4.6.1',
                            'x-api-key': this.apiKey,
                            'x-flapi-api-identifier': this.apiIdentifier,
                            'x-fl-request-id': this.getRequestID(),
                            'accept-encoding': 'gzip, deflate, br',
                            'x-flapi-session-id': this.getSessionID(),
                            'x-csrf-token': this.csrfToken,
                            'x-flapi-cart-guid': this.cartGUID,
                            'content-type': 'application/json',
                            Host: this.host,
                            host: `${this.host}:443`,
                        },
                    };
                } else {
                    url = `${this.url}/api/users/carts/current/set-billing`;
                    options = {
                        headers: {
                            Host: `${this.host}`,
                            'x-csrf-token': this.csrfToken,
                            'x-fl-request-id': uuid(),
                            'fastly-restart-on-error': '1',
                            referer: `https://www.${this.website.name}.com/checkout`,
                        },
                    };
                }
                const response = await this.sendRequest('POST', url, {
                    searchParams: {
                        timestamp: Date.now(),
                    },
                    responseType: 'json',
                    json: {
                        setAsDefaultBilling: false,
                        setAsDefaultShipping: false,
                        firstName: this.profile.shippingAddress.firstName,
                        lastName: this.profile.shippingAddress.lastName,
                        phone: this.profile.shippingAddress.phone,
                        country: {
                            isocode: this.profile.shippingAddress.country,
                            name: this.profile.shippingAddress.country === 'US' ? 'United States' : 'Canada',
                        },
                        id: null,
                        type: 'default',
                        LoqateSearch: '',
                        line1: this.profile.shippingAddress.address,
                        line2: this.profile.shippingAddress.secondaryAddress,
                        postalCode: this.profile.shippingAddress.zip,
                        town: this.profile.shippingAddress.city,
                        region: {
                            countryIso: this.profile.shippingAddress.country,
                            isocode: `${this.profile.shippingAddress.country}-${this.profile.shippingAddress.stateCode}`,
                            isocodeShort: this.profile.shippingAddress.stateCode,
                            name: this.profile.shippingAddress.state,
                        },
                        regionFPO: null,
                        recordType: ' ',
                        shippingAddress: true,
                        setAsBilling: false,
                        email: false,
                    },
                    ...options,
                });

                if (response?.statusCode !== 200) {
                    this.updateStatus(
                        `Failed to submit billing info. Error: ${JSON.stringify(response?.body?.fieldErrors)}`,
                        TaskStatusColor.Warning
                    );
                    await sleep(this.delay);
                    continue loop;
                } else {
                    this.updateStatus('Successfully submitted billing info.', TaskStatusColor.Info);
                    return;
                }
            } catch (e) {
                if (e?.response?.body?.url && /captcha-delivery/.test(e.response.body.url)) {
                    await this.onCaptchaDelivery(e.response.body.url);
                    await sleep(this.delay);
                    continue loop;
                }

                if (e?.response?.statusCode === 529) {
                    this.setStatus(`In queue...`, TaskStatusColor.Warning);
                    await sleep(5000);
                    continue loop;
                }

                this.setStatus('Submitting billing info failed', TaskStatusColor.Warning);
                await sleep(this.delay);
                continue loop;
            }
        }
    }

    async submitShippingMobile() {
        let attempts = 0;
        loop: while (!this.shouldStopTask && ++attempts <= 5) {
            this.updateStatus('Submitting info...', TaskStatusColor.Neutral);
            let options: Options = {};
            if (this.strategy === 'ShieldBypass') {
                options = {
                    headers: {
                        'user-agent': this.userAgent,
                        accept: 'application/json',
                        'x-fl-device-id': this.deviceID,
                        'accept-language': 'en-us',
                        'x-fl-app-version': '4.6.1',
                        'x-api-key': this.apiKey,
                        'x-flapi-api-identifier': this.apiIdentifier,
                        'x-fl-request-id': this.getRequestID(),
                        'accept-encoding': 'gzip, deflate, br',
                        'x-flapi-session-id': this.getSessionID(),
                        'x-csrf-token': this.csrfToken,
                        'x-flapi-cart-guid': this.cartGUID,
                        'content-type': 'application/json',
                        Host: this.host,
                        host: `${this.host}:443`,
                    },
                };
            } else {
                options = {
                    headers: {
                        'X-FLAPI-CART-GUID': this.cartGUID,
                        'x-api-lang': 'en-EN',
                        host: this.host,
                        'x-csrf-token': this.csrfToken,
                        'x-fl-request-id': uuid(),
                        referer: `https://www.${this.website.name}.com/checkout`,
                        cookie: `${this.cookieJar.getCookieStringSync(`${this.url}`)};`,
                    },
                };
            }
            let shippingData = {
                checkoutType: 'EXPRESS',
                details: {
                    billingAddress: {
                        countryCodeAlpha2: this.profile.shippingAddress.country,
                        firstName: this.profile.shippingAddress.firstName,
                        lastName: this.profile.shippingAddress.lastName,
                        line1: this.profile.shippingAddress.address,
                        locality: this.profile.shippingAddress.city,
                        postalCode: this.profile.shippingAddress.zip,
                        recipientName: [this.profile.shippingAddress.firstName, this.profile.shippingAddress.lastName].join(' '),
                        region: this.profile.shippingAddress.stateCode,
                    },
                    countryCode: this.profile.shippingAddress.country,
                    email: this.profile.shippingAddress.email,
                    firstName: this.profile.shippingAddress.firstName,
                    lastName: this.profile.shippingAddress.lastName,
                    payerId: 'null',
                    phone: this.profile.shippingAddress.phone,
                    shippingAddress: {
                        countryCodeAlpha2: this.profile.shippingAddress.country,
                        firstName: this.profile.shippingAddress.firstName,
                        lastName: this.profile.shippingAddress.lastName,
                        line1: this.profile.shippingAddress.address,
                        locality: this.profile.shippingAddress.city,
                        postalCode: this.profile.shippingAddress.zip,
                        recipientName: [this.profile.shippingAddress.firstName, this.profile.shippingAddress.lastName].join(' '),
                        region: this.profile.shippingAddress.stateCode,
                    },
                },
                nonce: uuid(),
                type: 'PayPal',
            };

            try {
                const response = await this.sendRequest('POST', `${this.url}/apigate/users/carts/current/paypal`, {
                    responseType: 'json',
                    json: shippingData,
                    ...options,
                });

                if (response?.statusCode !== 200) {
                    this.updateStatus(`Failed to submit info. - Error: ${JSON.stringify(response?.body?.fieldErrors)}`, TaskStatusColor.Warning);
                    await sleep(this.delay);
                    continue loop;
                } else {
                    this.submittedShipping = true;
                    this.updateStatus('Successfully submitted info.', TaskStatusColor.Info);
                    return;
                }
            } catch (e) {
                if (e?.response?.body?.url && /captcha-delivery/.test(e.response.body.url)) {
                    await this.onCaptchaDelivery(e.response.body.url);
                    await sleep(this.delay);
                    continue loop;
                }

                if (e?.response?.statusCode === 529) {
                    this.setStatus(`In queue...`, TaskStatusColor.Warning);
                    await sleep(5000);
                    continue loop;
                }

                this.setStatus(`Submitting info failed - Error: ${e.toString()}`, TaskStatusColor.Warning);
                await sleep(this.delay);
                continue loop;
            }
        }
    }

    async submitPayment() {
        loop: while (!this.shouldStopTask) {
            this.updateStatus('Submitting order...', TaskStatusColor.Neutral);
            let options: Options = {};
            let url;
            if (this.strategy === 'ShieldBypass') {
                url = `${this.url}/apigate/users/orders`;
                options = {
                    headers: {
                        'user-agent': this.userAgent,
                        accept: 'application/json',
                        'x-fl-device-id': this.deviceID,
                        'accept-language': 'en-us',
                        'x-fl-app-version': '4.6.1',
                        'x-api-key': this.apiKey,
                        'x-flapi-api-identifier': this.apiIdentifier,
                        'x-fl-request-id': this.getRequestID(),
                        'accept-encoding': 'gzip, deflate, br',
                        'x-flapi-session-id': this.getSessionID(),
                        'x-csrf-token': this.csrfToken,
                        'x-flapi-cart-guid': this.cartGUID,
                        'content-type': 'application/json',
                        Host: this.host,
                        host: `${this.host}:443`,
                    },
                };
            } else {
                url = `${this.url}/api/users/orders`;
                options = {
                    headers: {
                        host: `${this.host}`,
                        referer: `${this.url}/adyen/checkout`,
                        'x-csrf-token': this.csrfToken,
                        'x-fl-request-id': uuid(),
                        'fastly-restart-on-error': '1',
                    },
                };
            }
            const adyenKey =
                '10001|A237060180D24CDEF3E4E27D828BDB6A13E12C6959820770D7F2C1671DD0AEF4729670C20C6C5967C664D18955058B69549FBE8BF3609EF64832D7C033008A818700A9B0458641C5824F5FCBB9FF83D5A83EBDF079E73B81ACA9CA52FDBCAD7CD9D6A337A4511759FA21E34CD166B9BABD512DB7B2293C0FE48B97CAB3DE8F6F1A8E49C08D23A98E986B8A995A8F382220F06338622631435736FA064AEAC5BD223BAF42AF2B66F1FEA34EF3C297F09C10B364B994EA287A5602ACF153D0B4B09A604B987397684D19DBC5E6FE7E4FFE72390D28D6E21CA3391FA3CAADAD80A729FEF4823F6BE9711D4D51BF4DFCB6A3607686B34ACCE18329D415350FD0654D';
            const cardData = {
                number: this.profile.payment.number.match(/.{1,4}/g)!.join(' '), // 'xxxx xxxx xxxx xxxx'
                cvc: this.profile.payment.code, //'xxx'
                holderName: this.profile.name, // 'John Doe'
                expiryMonth: `${this.profile.payment.month}`.length === 1 ? `0${this.profile.payment.month}` : `${this.profile.payment.month}`, //'MM'
                expiryYear: `${this.profile.payment.year}`.length === 2 ? `20${this.profile.payment.year}` : `${this.profile.payment.year}`, // 'YYYY'
                generationtime: new Date().toISOString(), // new Date().toISOString()
            };
            const cseInstance = adyen18.createEncryption(adyenKey, {});
            cseInstance.validate(cardData);
            const dataEncrypted = cseInstance.encrypt(cardData);

            try {
                const response = await this.sendRequest('POST', url, {
                    searchParams: {
                        timestamp: Date.now(),
                    },
                    responseType: 'json',
                    json: {
                        preferredLanguage: 'en',
                        termsAndCondition: false,
                        deviceId: this.csrfToken,
                        cartId: this.cartGUID,
                        encryptedCardNumber: dataEncrypted,
                        encryptedExpiryYear: dataEncrypted,
                        encryptedExpiryMonth: dataEncrypted,
                        encryptedSecurityCode: dataEncrypted,
                        paymentMethod: 'CREDITCARD',
                        returnUrl: `${this.url}/adyen/checkout`,
                        browserInfo: {
                            screenWidth: 1920,
                            screenHeight: 1080,
                            colorDepth: 24,
                            userAgent:
                                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.66 Safari/537.36',
                            timeZoneOffset: 480,
                            language: 'en-US',
                            javaEnabled: false,
                        },
                    },
                    ...options,
                });
                this.task.checkoutProxy = this.proxy?.getUrl();
                if (response?.statusCode === 201) {
                    this.task.checkoutProxy = this.proxy?.getUrl();
                    this.task.orderId = response?.body?.order?.code;
                    this.setStatus('Order Placed', TaskStatusColor.Success, TaskEvent.CheckoutSuccess);
                    return;
                } else {
                    this.setStatus(response.body?.errors?.[0]?.message || 'Payment Declined', TaskStatusColor.Error, TaskEvent.CheckoutDecline);
                    await sleep(this.delay);
                    continue loop;
                }
            } catch (e) {
                if (e?.response?.body?.url && /captcha-delivery/.test(e.response.body.url)) {
                    await this.onCaptchaDelivery(e.response.body.url);
                    await sleep(this.delay);
                    continue loop;
                }

                if (e?.response?.statusCode === 529) {
                    this.setStatus(`In queue...`, TaskStatusColor.Warning);
                    await sleep(5000);
                    continue loop;
                } else if (e?.response?.statusCode === 400 || typeof e?.response?.body === 'object') {
                    const error = e?.response?.body?.errors?.[0];

                    switch (error?.code) {
                        case 11501:
                            this.updateStatus('Wait for restock');
                            await sleep(this.retryDelay);
                            continue loop;

                        case 11512:
                            this.updateStatus('Empty cart', TaskStatusColor.Error);
                            return;

                        case 12001:
                            this.setStatus('Card declined', TaskStatusColor.Error, TaskEvent.CheckoutDecline);
                            return;

                        case 12550:
                            this.updateStatus('Duplicate order', TaskStatusColor.Error);
                            return;

                        case 25008:
                            this.setStatus('Cart expired', TaskStatusColor.Error, TaskEvent.CheckoutDecline);
                            return;

                        case 25505:
                            this.updateStatus('Server error', TaskStatusColor.Error);
                            await sleep(this.retryDelay);
                            continue loop;

                        default:
                            const errorMessage = error?.message;

                            if (/Cart not found/.test(errorMessage)) {
                                this.setStatus('Payment Successful', TaskStatusColor.Success, TaskEvent.CheckoutSuccess);
                                return;
                            }

                            this.setStatus(errorMessage || 'Payment Declined', TaskStatusColor.Error, TaskEvent.CheckoutDecline);
                            return;
                    }
                }

                await sleep(this.delay);
                continue loop;
            }
        }
    }

    private async onQueueItRedirect(url: any) {
        this.setURL('');
        await this.getQueueItURL(url);

        // const promises = this.queueItChallengesPresent.map((challenge) => {
        //     challenge.name === 'RecaptchaInvisible' ? this.solveQueueItCaptcha(url) : this.solveQueueItPOW();
        // });

        const challenge1 = await this.solveQueueItCaptcha(url);
        const challenge2 = await this.solveQueueItPOW();
        this.queueItChallengeSessions = [challenge1, challenge2];
        // this.queueItChallengeSessions = await Promise.all(promises);
        await this.queueItEnterQueue();
        let seid = uuid();
        let timestamp = Date.now();
        await this.queueItPollQueue(seid, timestamp);
    }

    private async solveQueueItCaptcha(url: string) {
        let captchaToken = await this.solveRecaptcha(url, true, this.queueItInvisibleCaptchaKey);
        let sessionInfo = await this.postQueueItRecaptcha(captchaToken);
        return {
            sessionId: sessionInfo.sessionId,
            timestamp: sessionInfo.timestamp,
            checksum: sessionInfo.checksum,
            sourceIp: sessionInfo.sourceIp,
            challengeType: 'recaptcha-invisible',
            version: sessionInfo.version,
        };
    }

    private async solveQueueItPOW() {
        await this.getQueueItPow();
        let powPayload = await this.getQueueItPowPayload();
        let sessionInfo = await this.postQueueItPow(powPayload);
        return {
            sessionId: sessionInfo.sessionId,
            timestamp: sessionInfo.timestamp,
            checksum: sessionInfo.checksum,
            sourceIp: sessionInfo.sourceIp,
            challengeType: 'proofofwork',
            version: sessionInfo.version,
        };
    }

    private async getQueueItURL(url: string) {
        // console.log(url)
        this.updateStatus('Getting queue...', TaskStatusColor.Neutral);
        let failedAttempts = 0;
        loop: while (!this.shouldStopTask) {
            try {
                const method = 'GET';
                let options: Options = {};
                url = url;
                options = {
                    headers: {
                        'user-agent': this.userAgent,
                        accept: 'application/json',
                        'x-fl-device-id': this.deviceID,
                        'accept-language': 'en-us',
                        'x-fl-app-version': '4.6.1',
                        'x-api-key': this.apiKey,
                        'x-flapi-api-identifier': this.apiIdentifier,
                        'x-fl-request-id': uuid(),
                        'accept-encoding': 'gzip, deflate, br',
                    },
                };

                const response = await this.sendRequest(method, url, {
                    ...options,
                });

                if (response?.statusCode === 200) {
                    this.queueItUserId = this.cookieJar
                        .toJSON()
                        .cookies.find((c) => c.key === 'Queue-it')
                        ?.value.split('u=')[1];
                    this.queueItCustomerId = response.body.split("customerId: '")[1].split("'")[0];
                    this.queueItEventId = response.body.split("eventId: '")[1].split("'")[0];
                    this.queueItVersion = 5; // Hardcoded
                    this.queueItChallengesPresent = JSON.parse(`[${response.body.split('challenges: [')[1].split('],')[0]}]`);
                    this.queueItLayout = response.body.split("layout: '")[1].split("'")[0];
                    this.queueItCustomUrlParams = response.body.split("customUrlParams: '")[1].split("'")[0];
                    this.queueItTargetUrl = decodeURIComponent(response.body.split("targetUrl: decodeURIComponent('")[1].split("')")[0]);
                    this.queueItLayoutVersion = parseInt(response.body.split('layoutVersion:')[1].split(',')[0]);
                    this.queueItInvisibleCaptchaKey =
                        String(response.body).match(/captchaInvisiblePublicKey[^\'\"]*[\'\"]([0-9a-zA-Z_-]*)/)?.[1] || undefined;
                    this.updateStatus(`Got queue.`, TaskStatusColor.Info);

                    return;
                } else if (response?.statusCode === 302) {
                    // console.log(response.body)
                    let location = response?.headers['location'];
                    // console.log(location)
                    if (location?.includes('afterevent')) {
                        this.updateStatus(`Queue event has ended. (get queue)`, TaskStatusColor.Warning);
                        await sleep(this.retryDelay);
                        continue loop;
                    } else {
                        this.updateStatus(`Redirect to target is false but URL is not afterevent. (get queue)`, TaskStatusColor.Warning);
                        await sleep(this.retryDelay);
                        continue loop;
                    }
                } else {
                    this.setStatus(`Error loading queue response.`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    await sleep(this.delay);
                    continue loop;
                }
            } catch (e) {
                failedAttempts += 1;
                if (e?.response?.statusCode === 405 || /NOHE/.test(e?.toString())) {
                    this.dataReductionClipped = true;
                    this.updateStatus('Data reduction method clipped - get queue', TaskStatusColor.Warning);
                }

                this.setStatus(`Failed to get queue, error ${e.toString()}`, TaskStatusColor.Warning);
                await sleep(this.delay);
                continue loop;
            }
        }
    }

    private async postQueueItRecaptcha(captchaToken: String) {
        this.updateStatus('Submitting captcha...', TaskStatusColor.Neutral);
        let failedAttempts = 0;
        loop: while (!this.shouldStopTask) {
            try {
                const method = 'POST';
                let options: Options = {};
                let url = `https://footlocker.queue-it.net/challengeapi/verify`;
                options = {
                    headers: {
                        'user-agent': this.userAgent,
                        accept: 'application/json',
                        'x-fl-device-id': this.deviceID,
                        'accept-language': 'en-us',
                        'x-fl-app-version': '4.6.1',
                        'x-api-key': this.apiKey,
                        'x-flapi-api-identifier': this.apiIdentifier,
                        'x-fl-request-id': uuid(),
                        'accept-encoding': 'gzip, deflate, br',
                    },
                };

                const response = await this.sendRequest(method, url, {
                    ...options,
                    json: {
                        challengeType: 'recaptcha-invisible',
                        sessionId: captchaToken,
                        customerId: this.queueItCustomerId,
                        eventId: this.queueItEventId,
                        version: this.queueItVersion,
                    },
                    responseType: 'json',
                });

                if (typeof response.body === 'object') {
                    if (response.body.isVerified === true) {
                        this.updateStatus(`Submitted captcha.`, TaskStatusColor.Info);
                        return response.body.sessionInfo;
                    } else {
                        this.updateStatus(`Queue user not verified.`, TaskStatusColor.Info);
                        return;
                    }
                } else {
                    this.setStatus(`Error loading submit captcha response.`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    await sleep(this.delay);
                    continue loop;
                }
            } catch (e) {
                failedAttempts += 1;
                if (e?.response?.statusCode === 405 || /NOHE/.test(e?.toString())) {
                    this.dataReductionClipped = true;
                    this.updateStatus('Data reduction method clipped - submit queue captcha', TaskStatusColor.Warning);
                }

                this.setStatus(`Failed to submit captcha, error ${e.toString()}`, TaskStatusColor.Warning);
                await sleep(this.delay);
                continue loop;
            }
        }
    }

    private async getQueueItPow() {
        this.updateStatus('Getting proof of work...', TaskStatusColor.Neutral);
        let failedAttempts = 0;
        loop: while (!this.shouldStopTask) {
            try {
                const method = 'POST';
                let options: Options = {};
                let url = `https://footlocker.queue-it.net/challengeapi/pow/challenge/${this.queueItUserId}`;
                options = {
                    headers: {
                        accept: 'application/json',
                        'accept-encoding': 'gzip, deflate, br',
                        'accept-language': 'fr-FR,fr;q=0.8',
                        'cache-control': 'no-cache',
                        pragma: 'no-cache',
                        referer: this.url,
                        'sec-ch-ua': '"Chromium";v="92", " Not A;Brand";v="99", "Google Chrome";v="92"',
                        'sec-ch-ua-mobile': '?0',
                        'sec-fetch-dest': 'empty',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-site': 'same-origin',
                        'user-agent': this.userAgent,
                    },
                };

                const response = await this.sendRequest(method, url, {
                    ...options,
                    responseType: 'json',
                });

                if (typeof response.body === 'object') {
                    this.queueItMeta = response.body.meta;
                    this.queueItSessionId = response.body.sessionId;
                    this.queueItPowParametersInput = response.body.parameters.input;
                    this.queueItPowParametersZeroCount = response.body.parameters.zeroCount;
                    this.updateStatus(`Got proof of work.`, TaskStatusColor.Info);
                    return;
                } else {
                    this.setStatus(`Error loading proof of work response.`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    await sleep(this.delay);
                    continue loop;
                }
            } catch (e) {
                failedAttempts += 1;
                if (Env.isDev) console.log(e.response.body, e.response.statusCode);
                this.setStatus(`Failed to get proof of work, error ${e.toString()}`, TaskStatusColor.Warning);
                await sleep(this.delay);
                continue loop;
            }
        }
    }

    private async getQueueItPowPayload() {
        let payload = {
            userId: this.queueItUserId,
            meta: this.queueItMeta,
            sessionId: this.queueItSessionId,
            solution: executeChallenge(this.queueItPowParametersInput, this.queueItPowParametersZeroCount),
            tags: [`powTag-CustomerId:${this.queueItCustomerId}`, `powTag-EventId:${this.queueItEventId}`, `powTag-UserId:${this.queueItUserId}`],
            stats: {
                duration: await randomNumber(1000, 1900),
                tries: 1,
                userAgent: this.userAgent,
                screen: '5120 x 1440', // Leaving some device info static for now
                browser: 'Chrome',
                browserVersion: '91.0.4472.114',
                isMobile: false,
                os: 'Mac OS X',
                osVersion: '10_15_7',
                cookiesEnabled: true,
            },
            parameters: {
                input: this.queueItPowParametersInput,
                zeroCount: this.queueItPowParametersZeroCount,
            },
        };
        return payload;
    }

    private async postQueueItPow(powPayload) {
        this.updateStatus('Sending proof of work...', TaskStatusColor.Neutral);
        let failedAttempts = 0;
        loop: while (!this.shouldStopTask) {
            try {
                const sessionId = Buffer.from(JSON.stringify(powPayload)).toString('base64');
                const json = {
                    challengeType: 'proofofwork',
                    sessionId,
                    customerId: this.queueItCustomerId,
                    eventId: this.queueItEventId,
                    version: this.queueItVersion,
                };
                const method = 'POST';
                let options: Options = {};
                let url = `https://footlocker.queue-it.net/challengeapi/verify`;
                options = {
                    headers: {
                        'user-agent': this.userAgent,
                        accept: 'application/json',
                        'x-fl-device-id': this.deviceID,
                        'accept-language': 'en-us',
                        'x-fl-app-version': '4.6.1',
                        'x-api-key': this.apiKey,
                        'x-flapi-api-identifier': this.apiIdentifier,
                        'x-fl-request-id': uuid(),
                        'accept-encoding': 'gzip, deflate, br',
                    },
                };

                const response = await this.sendRequest(method, url, {
                    ...options,
                    json,
                    responseType: 'json',
                });
                if (response.statusCode === 200) {
                    this.updateStatus(`Sent proof of work.`, TaskStatusColor.Info);
                    return response.body.sessionInfo;
                } else {
                    this.setStatus(`Error loading post pow response.`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    await sleep(this.delay);
                    continue loop;
                }
            } catch (e) {
                failedAttempts += 1;
                this.setStatus(`Failed to send proof of work, error ${e.toString()}`, TaskStatusColor.Warning);
                await sleep(this.delay);
                continue loop;
            }
        }
    }

    private async queueItEnterQueue() {
        this.updateStatus('Entering queue...', TaskStatusColor.Neutral);
        let failedAttempts = 0;
        loop: while (!this.shouldStopTask) {
            try {
                const method = 'POST';
                let options: Options = {};
                let url = `https://footlocker.queue-it.net/spa-api/queue/footlocker/${this.queueItEventId}/enqueue?cid=en-US`;
                options = {
                    headers: {
                        'user-agent': this.userAgent,
                        accept: 'application/json',
                        'x-fl-device-id': this.deviceID,
                        'accept-language': 'en-us',
                        'x-fl-app-version': '4.6.1',
                        'x-api-key': this.apiKey,
                        'x-flapi-api-identifier': this.apiIdentifier,
                        'x-fl-request-id': uuid(),
                        'accept-encoding': 'gzip, deflate, br',
                    },
                };

                const response = await this.sendRequest(method, url, {
                    ...options,
                    json: {
                        challengeSessions: this.queueItChallengeSessions,
                        layoutName: this.queueItLayout,
                        customUrlParams: this.queueItCustomUrlParams,
                        targetUrl: this.queueItTargetUrl,
                        Referrer: '',
                    },
                    responseType: 'json',
                });

                if (response.statusCode === 200 && response.body.challengeFailed === false && response.body.invalidQueueitEnqueueToken === false) {
                    this.queueItQueueId = response.body.queueId;
                    this.updateStatus(`Entered queue.`, TaskStatusColor.Info);
                    return;
                } else {
                    if (Env.isDev) console.log(response.body, response.statusCode);
                    this.setStatus(`Error loading enter queue response.`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    await sleep(this.delay);
                    continue loop;
                }
            } catch (e) {
                failedAttempts += 1;
                if (e?.response?.statusCode === 405 || /NOHE/.test(e?.toString())) {
                    this.dataReductionClipped = true;
                    this.updateStatus('Data reduction method clipped - enter queue', TaskStatusColor.Warning);
                }

                this.setStatus(`Failed to send enter queue request, error ${e.toString()}`, TaskStatusColor.Warning);
                await sleep(this.delay);
                continue loop;
            }
        }
    }

    private async queueItPollQueue(seid, timestamp) {
        this.updateStatus('Waiting in queue...', TaskStatusColor.Neutral);
        let failedAttempts = 0;
        loop: while (!this.shouldStopTask) {
            try {
                const method = 'POST';
                let options: Options = {};
                let url = `https://footlocker.queue-it.net/spa-api/queue/footlocker/${this.queueItEventId}/${this.queueItQueueId}/status`;
                options = {
                    headers: {
                        'user-agent': this.userAgent,
                        accept: 'application/json',
                        'x-fl-device-id': this.deviceID,
                        'accept-language': 'en-us',
                        'x-fl-app-version': '4.6.1',
                        'x-api-key': this.apiKey,
                        'x-flapi-api-identifier': this.apiIdentifier,
                        'x-fl-request-id': uuid(),
                        'accept-encoding': 'gzip, deflate, br',
                    },
                };

                const response = await this.sendRequest(method, url, {
                    ...options,
                    json: {
                        targetUrl: this.queueItTargetUrl,
                        customUrlParams: this.queueItCustomUrlParams,
                        layoutVersion: this.queueItLayoutVersion,
                        layoutName: this.queueItLayout,
                        isClientRedayToRedirect: true,
                        isBeforeOrIdle: false,
                    },
                    searchParams: {
                        cid: 'en-US',
                        l: this.queueItLayout,
                        seid: seid,
                        sets: timestamp,
                    },
                    responseType: 'json',
                });

                if (response.statusCode === 200) {
                    console.log(response.body)
                    if (!('isRedirectToTarget' in response.body)) {
                        this.updateStatus('Waiting in queue...', TaskStatusColor.Neutral);
                        await sleep(5000);
                        continue loop;
                    } else if (response.body.isRedirectToTarget === false) {
                        if (response.body.redirectUrl.includes('afterevent')) {
                            this.updateStatus(`Queue event has ended. (poll queue)`, TaskStatusColor.Warning);
                            await sleep(this.retryDelay);
                            continue loop;
                        } else {
                            this.updateStatus(`Redirect to target is false but URL is not afterevent. (poll queue)`, TaskStatusColor.Warning);
                            await sleep(this.retryDelay);
                            continue loop;
                        }
                    } else {
                        this.queueItRedirectUrl = response.body.redirectUrl;
                        this.updateStatus(`Passed queue`, TaskStatusColor.Info);
                        return;
                    }
                } else {
                    this.setStatus(`Error loading waiting in queue response.`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    await sleep(this.delay);
                    continue loop;
                }
            } catch (e) {
                failedAttempts += 1;
                if (e?.response?.statusCode === 405 || /NOHE/.test(e?.toString())) {
                    this.dataReductionClipped = true;
                    this.updateStatus('Data reduction method clipped - waiting in queue', TaskStatusColor.Warning);
                }

                this.setStatus(`Failed to send wait queue request, ${e.toString()}`, TaskStatusColor.Warning);
                await sleep(this.delay);
                continue loop;
            }
        }
    }

    private async onCaptchaDelivery(url: string) {
        if (this.task.mode === FootsitesModes.Release && !/t=bv/.test(url)) {
            let solved = false;
            let attempts = 0;
            while (!solved && ++attempts <= 5) {
                solved = await this.loadChallenge(url);
            }
        } else {
            this.updateStatus('Proxy tempbanned, rotating', TaskStatusColor.Warning);
            this.rotateProxy();
        }
    }

    async loadChallenge(url: string) {
        this.updateStatus('Blocked by datadome, loading challenge.', TaskStatusColor.Neutral);

        const cookieString = this.cookieJar.getCookieStringSync(`${this.url}`);

        if (cookieString) {
            const datadomeCookie = cookieString?.split('datadome=')?.[1]?.split(';')?.[0];

            if (datadomeCookie === undefined) {
                this.updateStatus('Failed to find datadome cookie.', TaskStatusColor.Warning);
                return false;
            } else {
                url += `&cid=${datadomeCookie}`;
            }
        }

        let response: any;
        try {
            response = await got(url, {
                method: 'GET',
                headers: {
                    'Upgrade-Insecure-Requests': '1',
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                    Referer: `${this.url}/`,
                    'Sec-Fetch-Site': 'cross-site',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Dest': 'iframe',
                },
            });
        } catch (e) {
            this.setStatus(`Load datadome request failed`, TaskStatusColor.Warning);
            return false;
        }

        try {
            const params = {
                cid: response?.body?.split(`cid=' + encodeURIComponent( '`)?.[1]?.split(`'`)[0],
                icid: response?.body?.split(`&icid=' + encodeURIComponent('`)?.[1]?.split(`'`)[0],
                hash: response?.body?.split(`&hash=' + encodeURIComponent('`)?.[1]?.split(`'`)[0],
                ua: response?.body?.split(`&ua=' + encodeURIComponent('`)?.[1]?.split(`'`)[0],
                referer: response?.body?.split(`&referer=' + encodeURIComponent('`)?.[1]?.split(`'`)[0],
                'x-forwarded-for': response?.body?.split(`&x-forwarded-for=' + encodeURIComponent('`)?.[1]?.split(`'`)[0],
                s: response?.body?.split(`&s=' + encodeURIComponent('`)?.[1]?.split(`'`)[0],
            };

            let captchaParams;
            if (/g-recaptcha/.test(response?.body)) {
                const g_response = await this.solveRecaptcha(url, false);
                captchaParams = {
                    'g-recaptcha-response': g_response,
                };
            } else {
                const [, api_server, gt, challengeParam, product, offline, new_captcha, lang, http1, http2] = response?.body?.match(
                    /api_server:\s?'([^']*)',\s*gt:\s?'([^']*)',\s*challenge:\s?'([^']*)',\s*product:\s?'([^']*)',\s*offline:\s*([\d]*)\s?,\s*new_captcha:\s?([\d]*)\s*,\s*lang:\s?'([^']*)',\s*http:\s?'([^']*)'[\s\+]*'([^']*)'/
                );
                const http = `${http1}${http2}`;
                const geeTestParams: GeeTestParams = {
                    gt,
                    api_server,
                    challenge: challengeParam,
                    product,
                    offline,
                    new_captcha,
                    lang,
                    http,
                };
                const { challenge, validate, seccode } = await this.solveGeeTest({
                    URL: url,
                    geeTestParams,
                });
                captchaParams = {
                    'geetest-response-challenge': challenge,
                    'geetest-response-validate': validate,
                    'geetest-response-seccode': seccode,
                };
            }

            response = await this.sendRequest('GET', `https://geo.captcha-delivery.com/captcha/check`, {
                responseType: 'json',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                },
                searchParams: {
                    ccid: null,
                    ...captchaParams,
                    parent_url: params.referer,
                    captchaChallenge: ddExecuteCaptchaChallenge(params.ua, params.cid, 10),
                    ...params,
                },
            });
        } catch (e) {
            this.setStatus(`Submit captcha request failed`, TaskStatusColor.Warning);
            return false;
        }

        if (typeof response.body === 'object') {
            this.updateStatus('Successfully got datadome cookie.', TaskStatusColor.Neutral);
            this.cookieJar.setCookieSync(response?.body?.cookie, this.url);
            return true;
        } else {
            this.setStatus('Failed to load datadome cookie response.', TaskStatusColor.Warning);
            return false;
        }
    }

    async solveRecaptcha(URL: string, invisible: boolean, siteKey?: string) {
        this.updateStatus('Solving ReCaptcha', TaskStatusColor.Neutral);

        const captchaTask: CaptchaTask = {
            taskID: this.task.id,
            type: invisible ? CaptchaType.RecaptchaV2Invisible : CaptchaType.RecaptchaV2,
            URL,
            siteKey: siteKey ? siteKey : '6LccSjEUAAAAANCPhaM2c-WiRxCZ5CzsjR_vd8uX',
            minScore: 0.7,
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:88.0) Gecko/20100101 Firefox/88.0',
            proxy: this.proxy,
        };
        let token;
        if (this.task.mode === FootsitesModes.Experimental) {
            const { promise, action, resolve } = this.manager.getSharedToken(captchaTask);
            if (action === 'solve') {
                token = (await this.solveCaptchaTask(captchaTask)) as String;
                resolve?.(token);
            } else {
                token = await promise;
            }
        } else {
            token = (await this.solveCaptchaTask(captchaTask)) as String;
        }
        this.updateStatus(`Solved Captcha ${token.substring(0, 10)}`, TaskStatusColor.Neutral);
        return token;
    }

    async solveGeeTest({ URL, geeTestParams }: { URL: string; geeTestParams: GeeTestParams }): Promise<GeeTestResponse> {
        this.updateStatus('Solving GeeTest', TaskStatusColor.Neutral);
        const captchaTask: CaptchaTask = {
            taskID: this.task.id,
            type: CaptchaType.GeeTest,
            URL,
            siteKey: '',
            proxy: this.proxy,
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:88.0) Gecko/20100101 Firefox/88.0',
            geeTestParams,
        };
        const response = (await this.solveCaptchaTask(captchaTask)) as GeeTestResponse;

        return response;
    }

    private async parallelize(fns: (() => Promise<void>)[]) {
        const promises: Promise<void>[] = [];
        for (const fn of fns) {
            const promise = fn.bind(this)?.();
            promises.push(promise);
        }
        return new Promise<void>((resolve, reject) => {
            Promise.all(promises)
                .then(() => {
                    resolve();
                })
                .catch(() => {
                    reject();
                });
        });
    }

    private setURL(cacheNodeName: string) {
        if (cacheNodeName) {
            this.url = `https://cache-${cacheNodeName}.hosts.fastly.net`;
            return;
        }
        this.url = `https://${this.host}`;
    }

    private formatFastlyFF(cacheName: string) {
        const airportCode = cacheName.substr(0, 3);
        return `!${airportCode.toUpperCase()}!cache-${cacheName}`;
    }

    private getCacheNodeRequestOptions = (cacheNodeName: string) => {
        // get past 'RequestError: Hostname/IP does not match certificate's altnames'
        const name = this.cacheNodeGroup.getItem();
        const fastlyFF = name ? this.formatFastlyFF(name) : '!BWI!cache-bwi5139';
        const https = {
            checkServerIdentity: (hostname) => {
                if (hostname === this.host) {
                    return;
                } else {
                    return new Error('Invalid Hostname');
                }
            },
        };
        return {
            headers: {
                host: this.host,
                cookie: `${this.cookieJar.getCookiesSync(`https://${this.host}`)}`,
                'fastly-debug': '1',
                // 'fastly-ff': '!BWI!cache-bwi5139',
                // 'Fastly-Host': this.host,
                // 'Fastly-Restart-On-Error': '1',
                // 'Fastly-Orig-Host': this.host,
                // 'x-fl-asnum': `${randomNumber(1000, 20000)}`,
                // 'x-requested-for-server': `prod.origin.footlocker.com`,
                // 'true-client-ip': '127.0.0.1',
                // 'fastly-client': '1',
                'fastly-ff': fastlyFF,
            },
            options: {
                http2: false,
                https,
                agent: {
                    https: this.proxy?.getHttpsProxyAgent(https, { servername: this.host }),
                },
            },
        };
    };

    private getTimeToWait(ttl: number) {
        const now = Date.now();
        const productLiveIn = ttl - now;
        const requestTime = (Math.random() * 2.5 + 0.5) * 1000; //random number between 500 and 3000
        const requestIn = productLiveIn - requestTime;
        return requestIn < 0 ? 0 : requestIn;
    }

    private updateCacheNode(data?: { headers: any; ttl: number }, didATC?: boolean) {
        const headers = data?.headers;
        const ttl = data?.ttl;
        const xTimer = headers?.['x-timer'] || '';
        const debugTTL = headers?.['fastly-debug-ttl'] || '';
        const debugPaths = headers?.['fastly-debug-path'] || '';
        if (!debugPaths || !debugTTL) return;

        if (Env.isDev) {
            console.log(debugPaths);
            console.log(debugTTL);
        }
        const update: CacheNodeUpdate = {
            headers: {
                xTimer,
                debugTTL,
                debugPaths,
            },
            productGroup: {
                store: this.website.name,
                pid: this.task.product.id,
                size: `${parseFloat(this.task.product.size!.value)}` || '',
            },
            ttl,
            didATC,
        };
        this.manager.updateCacheNode(update);
    }
}
