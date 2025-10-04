import { addToCart, getStock, generateSession, placeOrder, submitBilling, submitEmail, submitShipping, submitPaypal, getProduct } from './api';
import { getPow, getUrl, enterQueue, pollQueue, postCaptcha, postPow } from './queue-it';
import { encryptPayment, getTimeToWait, formatXCache } from './utils';
import { PDP } from './IFootsites';

import { v4 as uuid } from 'uuid';
import { executeChallenge } from '../../utils/cryptography/pow';
import { JSONParseSafely, sleep, randomNumber } from '../../../../lib/helpers';
import BotTask, { BotTaskProperties } from '../../models/tasks/botTask';
import { TaskEvent, TaskStatusColor } from '../../../../lib/models/taskUpdate';
import { RetryExecutor } from '../../../../lib/errors';
import CacheNodeGroup from '../../../../lib/models/cacheNodeGroup';
import { CaptchaTask, CaptchaType } from '../../models/captchaSolvers/captchaSolver';
import Env from '../../env';
import { Cookie } from 'tough-cookie';
import FootsitesManager, { CacheNodeUpdate } from './footsitesManager';
import { pollRandomEvent } from '../../../../cli/src/utils/general';
import Sizes from '../../../../lib/models/sizes';
import Size from '../../../../lib/models/size';
import { FootsitesModes } from './footsites.config';

export default class Footsites extends BotTask {
    private atcTries: number = 0;
    private static RandomTaskCount: { [id: string]: number } = {};
    private static PDPs: {
        [id: string]: PDP;
    } = {};
    private readonly host: string;
    private url: string;
    private cacheNodeMethod: 'random' | 'poll-api';
    private cacheNodeGroup: CacheNodeGroup;
    private manager: FootsitesManager;
    private readonly delay: number;
    private recapEnabled?: boolean;
    private csrfToken!: string;
    private cartGUID!: string;
    private dataReductionClipped = true;
    private submittedShipping = false;
    private strategy: 'MinFirstTTL' | 'ShieldBypass' = 'ShieldBypass';
    private shouldSpamATC = false;
    private userAgent: string = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:88.0) Gecko/20100101 Firefox/88.0';
    private deviceID: string = '';

    private isQueueIt: boolean = false;

    private queueItUserId!: string;
    private queueItMeta!: string;
    private queueItSessionId!: string;
    private queueItPowParametersInput!: string;
    private queueItPowParametersZeroCount!: string;
    private queueItCustomerId!: string;
    private queueItEventId!: string;
    private queueItVersion!: any;
    private queueItChallengesPresent!: any;
    private queueItChallengeSessions!: any;
    private queueItLayout!: string;
    private queueItCustomUrlParams!: string;
    private queueItTargetUrl!: string;
    private queueItQueueId!: string;
    private queueItLayoutVersion!: any;
    private queueItRedirectUrl!: string;
    private queueItTimestamp!: string;
    private queueItSeid!: string;
    private queueItUrl!: string;
    private queueItPow!: object;
    private queueItInvisibleCaptchaKey!: string;

    private productGroups: {
        store: string;
        pid: string;
        sizes: Sizes;
    };
    //#region const helpers
    private getSessionID = () => this.cookieJar.getCookieStringSync(`https://${this.host}`).split('JSESSIONID=')?.[1]?.split(';')?.[0];

    private getCacheNodeMethod() {
        if (Footsites.RandomTaskCount[this.task.product.id] === undefined) Footsites.RandomTaskCount[this.task.product.id] = 0;
        let shouldUseRandom = Footsites.RandomTaskCount[this.task.product.id] < 3 || pollRandomEvent(5, 100);
        if (shouldUseRandom) Footsites.RandomTaskCount[this.task.product.id] += 1;
        return shouldUseRandom ? 'random' : 'poll-api';
    }

    private getNextATC = async () => {
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
                return this.getNextATC();
            } else if (!size) {
                Env.isDev && console.log(`Error: Size ${cacheNode.productGroup.store} does not exist in available sizes`);
                return this.getNextATC();
            }
        }
        return {
            cacheNodeName,
            size,
            ttl,
        };
    };
    //#endregion

    protected *execute() {
        this.manager.onStart();
        this.rotateProxy();

        yield this.generateSession();
        yield this.getStock();
 

        if (this.isQueueIt) {
            yield this.onQueueItRedirect();
            yield this.getStock();
        }


        yield this.addToCart();


        const useMobileShipping = true;
        if (useMobileShipping) {
            yield this.submitPaypal();
        }

        if (!this.submittedShipping) {
            yield this.parallelize([this.submitEmail, this.submitShipping, this.submitBilling]);
        }

        yield this.placeOrder();
    }

    constructor(botTaskProps: BotTaskProperties) {
        super(botTaskProps);

        this.host = `www.${this.website.url.hostname}`;
        this.url = `https://${this.host}`;
        this.deviceID = uuid();
        this.delay = this.task.retryDelay ? this.task.retryDelay : this.task.checkoutDelay;

        this.cacheNodeMethod = this.getCacheNodeMethod();
        this.cacheNodeGroup = CacheNodeGroup.getInstance();
        this.productGroups = { store: this.task.websiteName, pid: this.task.product.id, sizes: this.task.sizes };
        this.manager = FootsitesManager.getInstance(this.productGroups);
        const options = {
            https: {
                rejectUnauthorized: false,
                checkServerIdentity: (hostname) => {
                    if (hostname === this.host) {
                        return;
                    } else {
                        Env.isDev && console.log(`Invalid hostname ${hostname}`)
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
                                Env.isDev && console.log(`Invalid hostname ${hostname}`)
                                return new Error('Invalid Hostname');
                            }
                        },
                    }),
                },
            });
        }
    }

    private baseDetails = () => {
        return {
            deviceId: this.deviceID,
            userAgent: this.userAgent,
            host: this.host,
            strategy: this.strategy,
            url: this.url,
        };
    };
    //#region flow
    private async getProductPage() {
        let response: any;
        this.updateStatus('Getting product page', TaskStatusColor.Neutral);
        try {
            response = await getProduct(this.httpClient, {
                ...this.baseDetails(),
                sku: this.task.product.id,
            });
        } catch (e) {
            this.handleConnectionError(e, this.getProductPage.bind(this), 'to get product page');
            return;
        }

        switch (response.statusCode) {
            case 529:
                if (this.userAgent.includes('CFNetwork') || this.task.websiteName === 'footlockerca')
                    throw new RetryExecutor(this.getProductPage.bind(this), `Waiting in fastly queue ...`);
                this.setFastlyAgent();
                throw new RetryExecutor(this.getProductPage.bind(this), `Detected fastly queue, Switching to fastly settings and retrying`);
            case 403:
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.getProductPage.bind(this), `Ratelimited, Rotating proxy and retrying`);
            case 201:
            case 200:
                return;
            case 302:
                this.updateStatus('Detected queue it, handling queue ...', TaskStatusColor.Warning);
                this.isQueueIt = true;
                this.queueItUrl = response?.headers?.location;
                break;
            case 405:
                this.dataReductionClipped = true;
                throw new RetryExecutor(this.getProductPage.bind(this), 'Data reduction method clipped, changing method and retrying');
            default:
                Env.isDev && console.log(response.body);
                throw new RetryExecutor(this.getProductPage.bind(this), `Unable to get product page (${response.statusCode}), Retrying`);
        }
    }

    private async generateSession() {
        let response: any;
        this.updateStatus('Generating Session', TaskStatusColor.Neutral);
        try {
            response = await generateSession(this.httpClient, { ...this.baseDetails() });
        } catch (e) {
            this.handleConnectionError(e, this.generateSession.bind(this), 'Generating session');
            return;
        }

        switch (response.statusCode) {
            case 529:
                if (this.userAgent.includes('CFNetwork') || this.task.websiteName === 'footlockerca')
                    throw new RetryExecutor(this.generateSession.bind(this), `Waiting in fastly queue ...`);
                this.setFastlyAgent();
                throw new RetryExecutor(this.generateSession.bind(this), `Detected fastly queue, Switching to fastly settings and retrying`);
            case 403:
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.generateSession.bind(this), `Ratelimited, Rotating proxy and retrying`);
            case 201:
            case 200:
                const sessionObj = JSONParseSafely(response.body);
                this.csrfToken = sessionObj?.data?.csrfToken;
                return;
            case 405:
                this.dataReductionClipped = true;
                throw new RetryExecutor(this.generateSession.bind(this), 'Data reduction method clipped, changing method and retrying');
            default:
                Env.isDev && console.log(response.body);
                throw new RetryExecutor(this.generateSession.bind(this), `Unable to generate session (${response.statusCode}), Retrying`);
        }
    }

    private async getStock() {
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

            if (this.task.sizes.availableSizes.length > 0) return;
            this.updateStatus(`Selected sizes OOS or not loaded.`, TaskStatusColor.Warning);
        }
        let response: any;
        this.updateStatus('Getting variants', TaskStatusColor.Neutral);
        try {
            response = await getStock(this.httpClient, {
                productId: this.task.product.id,
                csrfToken: this.csrfToken,
                sessionId: this.getSessionID(),
                ...this.baseDetails(),
            });
        } catch (e) {
            this.handleConnectionError(e, this.getStock.bind(this), 'Generating session');
            return;
        }

        switch (response.statusCode) {
            case 529:
                if (this.userAgent.includes('CFNetwork') || this.task.websiteName === 'footlockerca')
                    throw new RetryExecutor(this.getStock.bind(this), `Waiting in fastly queue ...`);
                this.setFastlyAgent();
                throw new RetryExecutor(this.getStock.bind(this), `Detected fastly queue, Switching to fastly settings and retrying`);
            case 403:
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.getStock.bind(this), `Ratelimited, Rotating proxy and retrying`);
            case 201:
            case 200:
                const stockObj = JSONParseSafely(response.body);

                const productVariant = stockObj?.variantAttributes.find((x) => x.sku === this.task.product.id);

                this.task.product.name = stockObj?.name;
                this.task.product.image = stockObj?.images
                    ?.find((item) => item.code === this.task.product.id)
                    ?.variations?.find((item) => item.format === 'small')?.url;

                this.task.product.price = productVariant.price.formattedValue;
                this.task.product.image = stockObj?.images
                    ?.find((x) => x.code === productVariant.code)
                    ?.variations.find((x) => x.format === 'large')?.url;

                const availibleSizes: Size[] = stockObj?.sellableUnits.map((x) => new Size(x.attributes[0].value, x.attributes[0].value, x.code));

                if (availibleSizes.length === 0) throw new RetryExecutor(this.getStock.bind(this), 'Product not loaded, Monitoring');
                this.task.sizes.setAvailableSizes(availibleSizes);

                Footsites.PDPs[this.task.product.id] = {
                    skuLaunch: productVariant.skuLaunchDate ? Date.parse(productVariant.skuLaunchDate) : 0,
                    sizes: availibleSizes,
                    name: this.task.product?.name as string,
                    image: this.task.product?.image as string,
                    price: productVariant.price.formattedOriginalPrice as string,
                    isRecaptchaEnabled: productVariant.recaptchaOn as boolean,
                };
                return;
            case 302:
                this.setStatus('Failed to get variants, checking for queue-it ...', TaskStatusColor.Warning);
                await this.getProductPage();
                break;
            case 405:
                this.dataReductionClipped = true;
                throw new RetryExecutor(this.getStock.bind(this), 'Data reduction method clipped, changing method and retrying');
            default:
                // const error = e.response.body.errors[0].message;
                Env.isDev && console.log(response.body);
                throw new RetryExecutor(this.getStock.bind(this), `Unable to get variants (${response.statusCode}), Retrying`);
        }
    }
    private async addToCart() {
        this.atcTries++;

        if (this.shouldSpamATC) this.shouldSpamATC = pollRandomEvent(8, 10);
        const { cacheNodeName, size, ttl } = await this.getNextATC();

        this.setURL(cacheNodeName);
        this.task.product.size = size;
        const msToWait = getTimeToWait(ttl);
        await sleep(msToWait);

        let response: any;

        try {
            response = await addToCart(this.httpClient, {
                productId: this.task.product.id,
                sizeCode: this.task.product.size!.code!,
                qty: this.task.atcQuantity,
                csrfToken: this.csrfToken,
                sessionId: this.getSessionID(),
                ...this.baseDetails(),
            });
        } catch (e) {
            this.handleConnectionError(e, this.addToCart.bind(this), 'Adding to cart');
            return;
        }

        switch (response.statusCode) {
            case 529:
                if (this.userAgent.includes('CFNetwork') || this.task.websiteName === 'footlockerca')
                    throw new RetryExecutor(this.addToCart.bind(this), `Waiting in fastly queue ...`);
                this.setFastlyAgent();
                throw new RetryExecutor(this.addToCart.bind(this), `Detected fastly queue, Switching to fastly settings and retrying`);
            case 403:
                if (this.atcTries > 15) {
                    this.strategy = this.strategy === 'MinFirstTTL' ? 'ShieldBypass' : 'MinFirstTTL';
                    this.atcTries = 0;
                }
                if (this.task.mode === FootsitesModes.Rotate) {
                    this.rotateProxy();
                    throw new RetryExecutor(this.addToCart.bind(this), `Blocked by datadome, Rotating proxy and retrying`);
                }
                //HANDLE DATADOME
                break;
            case 429:
                if (this.atcTries > 15) {
                    this.strategy = this.strategy === 'MinFirstTTL' ? 'ShieldBypass' : 'MinFirstTTL';
                    this.atcTries = 0;
                }
                this.rotateProxy();
                throw new RetryExecutor(this.addToCart.bind(this), `Ratelimited, Rotating proxy and retrying`);
            case 201:
            case 200:
                const atcObj = JSONParseSafely(response.body);

                if (atcObj?.errors?.length > 0)
                    throw new RetryExecutor(this.addToCart.bind(this), `Failed to add to cart (${atcObj?.errors}), Retrying`);
                if (atcObj.totalUnitCount === 0) throw new RetryExecutor(this.addToCart.bind(this), `Failed to add to cart (Cart Empty), Retrying`);
                if (!atcObj.guid) throw new RetryExecutor(this.addToCart.bind(this), `Failed to add to cart (Couldn't find cart id), Retrying`);

                this.cartGUID = atcObj.guid;
                this.setStatus(
                    `Added '${this.task.product.name}' in size ${this.task.product.size?.toString()} to cart ${formatXCache(response)}`,
                    TaskStatusColor.Cart,
                    TaskEvent.Carted
                );
                this.updateCacheNode({ headers: response?.headers, ttl }, true);
                this.setURL();

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
            case 405:
                this.rotateProxy();
                throw new RetryExecutor(this.addToCart.bind(this), 'Data reduction method clipped, changing method and retrying');
            default:
                Env.isDev && console.log(response.body);
                throw new RetryExecutor(this.addToCart.bind(this), `Unable to add to cart (${response.statusCode}), Retrying`);
        }
    }
    private async submitEmail() {
        let response: any;
        this.updateStatus(`Submitting email address (${this.profile.shippingAddress.email})`, TaskStatusColor.Neutral);
        try {
            response = await submitEmail(this.httpClient, {
                sessionId: this.getSessionID(),
                csrfToken: this.csrfToken,
                cartGUID: this.cartGUID,
                email: this.profile.shippingAddress.email,
                cookieString: `${this.cookieJar.getCookieStringSync(`${this.url}`)};`,
                ...this.baseDetails(),
            });
        } catch (e) {
            this.handleConnectionError(e, this.submitEmail.bind(this), 'Submitting email address');
            return;
        }

        switch (response.statusCode) {
            case 529:
                if (this.userAgent.includes('CFNetwork') || this.task.websiteName === 'footlockerca')
                    throw new RetryExecutor(this.submitEmail.bind(this), `Waiting in fastly queue ...`);
                this.setFastlyAgent();
                throw new RetryExecutor(this.submitEmail.bind(this), `Detected fastly queue, Switching to fastly settings and retrying`);
            case 403:
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.submitEmail.bind(this), `Ratelimited, Rotating proxy and retrying`);
            case 201:
            case 200:
                return;
            default:
                Env.isDev && console.log(response.body);
                throw new RetryExecutor(this.submitEmail.bind(this), `Unable to submit email (${response.statusCode}), Retrying`);
        }
    }
    private async submitPaypal() {
        let response: any;
        this.updateStatus(`Submitting user informations`, TaskStatusColor.Neutral);
        try {
            response = await submitPaypal(this.httpClient, {
                sessionId: this.getSessionID(),
                csrfToken: this.csrfToken,
                cartGUID: this.cartGUID,
                profile: this.profile,
                cookieString: `${this.cookieJar.getCookieStringSync(this.url)};`,
                ...this.baseDetails(),
            });
        } catch (e) {
            this.handleConnectionError(e, this.submitPaypal.bind(this), 'Submitting client informations');
            return;
        }

        switch (response.statusCode) {
            case 529:
                if (this.userAgent.includes('CFNetwork') || this.task.websiteName === 'footlockerca')
                    throw new RetryExecutor(this.submitPaypal.bind(this), `Waiting in fastly queue ...`);
                this.setFastlyAgent();
                throw new RetryExecutor(this.submitPaypal.bind(this), `Detected fastly queue, Switching to fastly settings and retrying`);
            case 403:
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.submitPaypal.bind(this), `Ratelimited, Rotating proxy and retrying`);
            case 200:
                this.submittedShipping = true;
                return;
            default:
                Env.isDev && console.log(response.body);
                throw new RetryExecutor(this.submitPaypal.bind(this), `Unable to submit client informations (${response.statusCode}), Retrying`);
        }
    }
    private async submitShipping() {
        let response: any;
        this.updateStatus(`Submitting shipping informations`, TaskStatusColor.Neutral);
        try {
            response = await submitShipping(this.httpClient, {
                sessionId: this.getSessionID(),
                csrfToken: this.csrfToken,
                cartGUID: this.cartGUID,
                profile: this.profile,
                cookieString: `${this.cookieJar.getCookieStringSync(this.url)};`,
                ...this.baseDetails(),
            });
        } catch (e) {
            this.handleConnectionError(e, this.submitShipping.bind(this), 'Submitting shipping informations');
            return;
        }

        switch (response.statusCode) {
            case 529:
                if (this.userAgent.includes('CFNetwork') || this.task.websiteName === 'footlockerca')
                    throw new RetryExecutor(this.submitShipping.bind(this), `Waiting in fastly queue ...`);
                this.setFastlyAgent();
                throw new RetryExecutor(this.submitShipping.bind(this), `Detected fastly queue, Switching to fastly settings and retrying`);
            case 403:
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.submitShipping.bind(this), `Ratelimited, Rotating proxy and retrying`);
            case 201:
                return;
            default:
                Env.isDev && console.log(response.body);
                throw new RetryExecutor(this.submitShipping.bind(this), `Unable to submit shipping informations (${response.statusCode}), Retrying`);
        }
    }

    private async submitBilling() {
        let response: any;
        this.updateStatus(`Submitting billing informations`, TaskStatusColor.Neutral);
        try {
            response = await submitBilling(this.httpClient, {
                sessionId: this.getSessionID(),
                csrfToken: this.csrfToken,
                cartGUID: this.cartGUID,
                profile: this.profile,
                cookieString: `${this.cookieJar.getCookieStringSync(this.url)};`,
                ...this.baseDetails(),
            });
        } catch (e) {
            this.handleConnectionError(e, this.submitBilling.bind(this), 'Submitting billing informations');
            return;
        }

        switch (response.statusCode) {
            case 529:
                if (this.userAgent.includes('CFNetwork') || this.task.websiteName === 'footlockerca')
                    throw new RetryExecutor(this.submitBilling.bind(this), `Waiting in fastly queue ...`);
                this.setFastlyAgent();
                throw new RetryExecutor(this.submitBilling.bind(this), `Detected fastly queue, Switching to fastly settings and retrying`);
            case 403:
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.submitBilling.bind(this), `Ratelimited, Rotating proxy and retrying`);
            case 200:
                return;
            default:
                Env.isDev && console.log(response.body);
                throw new RetryExecutor(this.submitBilling.bind(this), `Unable to submit billing informations (${response.statusCode}), Retrying`);
        }
    }

    private async placeOrder() {
        let response: any;
        const encryptedCard = encryptPayment({
            number: this.profile.payment.number,
            code: this.profile.payment.code,
            month: this.profile.payment.month,
            year: this.profile.payment.year.toString(),
            name: this.profile.name,
        });
        this.updateStatus(`Placing order ...`, TaskStatusColor.Neutral);
        try {
            response = await placeOrder(this.httpClient, {
                sessionId: this.getSessionID(),
                csrfToken: this.csrfToken,
                cartGUID: this.cartGUID,
                encryptedCard,
                cookieString: `${this.cookieJar.getCookieStringSync(this.url)};`,
                ...this.baseDetails(),
            });
        } catch (e) {
            this.handleConnectionError(e, this.placeOrder.bind(this), 'Placing order');
            return;
        }

        switch (response.statusCode) {
            case 529:
                if (this.userAgent.includes('CFNetwork') || this.task.websiteName === 'footlockerca')
                    throw new RetryExecutor(this.placeOrder.bind(this), `Waiting in fastly queue ...`);
                this.setFastlyAgent();
                throw new RetryExecutor(this.placeOrder.bind(this), `Detected fastly queue, Switching to fastly settings and retrying`);
            case 403:
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.placeOrder.bind(this), `Ratelimited, Rotating proxy and retrying`);
            case 201:
                const orderObj = JSONParseSafely(response.body);
                this.task.checkoutProxy = this.proxy?.getUrl();
                this.task.orderId = orderObj.order?.code;
                this.setStatus(
                    `Successfully checked out - ${this.task.product?.name} size ${this.task.product?.size}`,
                    TaskStatusColor.Success,
                    TaskEvent.CheckoutSuccess
                );
                return;
            case 400:
                const error = JSONParseSafely(response.body)?.errors?.[0];
                switch (error?.code) {
                    case 11501:
                        throw new RetryExecutor(this.placeOrder.bind(this), `Failed to place order - OOS, Retrying`);

                    case 11512:
                        this.setStatus('Failed to place order - Cart emptied', TaskStatusColor.Error);
                        return;

                    case 12001:
                        this.setStatus('Failed to place order - Card declined', TaskStatusColor.Error, TaskEvent.CheckoutDecline);
                        return;

                    case 12550:
                        this.updateStatus('Failed to place order - Duplicate order', TaskStatusColor.Error);
                        return;

                    case 25008:
                        this.setStatus('Failed to to place order - Cart expired', TaskStatusColor.Error, TaskEvent.CheckoutDecline);
                        return;

                    case 25505:
                        throw new RetryExecutor(this.placeOrder.bind(this), `Failed to place order - Server error, Retrying`);

                    default:
                        const errorMessage = error?.message;

                        if (/Cart not found/.test(errorMessage)) {
                            this.setStatus(
                                `Successfully checked out - ${this.task.product?.name} size ${this.task.product?.size}`,
                                TaskStatusColor.Success,
                                TaskEvent.CheckoutSuccess
                            );
                            return;
                        }

                        this.setStatus(
                            `Failed to place order - ${errorMessage || 'Card declined'}`,
                            TaskStatusColor.Error,
                            TaskEvent.CheckoutDecline
                        );
                        return;
                }
                break;
            default:
                Env.isDev && console.log(response.body);
                throw new RetryExecutor(this.placeOrder.bind(this), `Unable to place order (${response.statusCode}), Retrying`);
        }
    }
    //#endregion
    //#region QueueIT
    private async solveQueueItCaptcha() {
        let sessionInfo = await this.postQueueItRecaptcha();
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
        this.queueItPow = await this.getQueueItPowPayload();
        let sessionInfo = await this.postQueueItPow();
        return {
            sessionId: sessionInfo.sessionId,
            timestamp: sessionInfo.timestamp,
            checksum: sessionInfo.checksum,
            sourceIp: sessionInfo.sourceIp,
            challengeType: 'proofofwork',
            version: sessionInfo.version,
        };
    }

    private async attemptQueueItChallenge(method: () => Promise<any>): Promise<any> {
        let result;
        try {
            const challengeSession = await method();
            result = { success: true, challengeSession };
        } catch (e) {
            result = { success: false, error: e };
        }
        return result;
    }

    private async onQueueItRedirect() {
        this.setURL();
        await this.getQueueItURL();

        this.queueItChallengeSessions;
        console.log(this.queueItChallengesPresent);
        for (const challenge of this.queueItChallengesPresent) {
            const method = challenge.name === 'RecaptchaInvisible' ? this.solveQueueItCaptcha : this.solveQueueItPOW;
            let solved = false;
            console.log(challenge);
            do {
                Env.isDev && console.log('solving');
                const { success, challengeSession, error } = await this.attemptQueueItChallenge(method.bind(this));
                Env.isDev && console.log(success, challengeSession);
                if (success) {
                    this.queueItChallengeSessions.push(challengeSession);
                    solved = true;
                }
            } while (!solved);
        }

        await this.queueItEnterQueue();
        this.queueItSeid = uuid();
        this.queueItTimestamp = Date.now().toString();
        await this.queueItPollQueue();
    }

    private async getQueueItURL() {
        let response: any;
        this.updateStatus('Getting queue details ...', TaskStatusColor.Neutral);
        try {
            response = await getUrl(this.httpClient, {
                ...this.baseDetails(),
                url: this.queueItUrl,
            });
        } catch (e) {
            this.handleConnectionError(e, this.getQueueItURL.bind(this), 'Getting queue it URL');
            return;
        }

        switch (response.statusCode) {
            case 200:
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
                this.queueItInvisibleCaptchaKey = String(response.body).match(/captchaInvisiblePublicKey[^\'\"]*[\'\"]([0-9a-zA-Z_-]*)/)?.[1] || '';
                return;
            case 302:
                if (!response.headers?.location?.includes('afterevent'))
                    throw new RetryExecutor(this.getQueueItURL.bind(this), 'Queue redirected to unknown location, Retrying');
                throw new RetryExecutor(this.getQueueItURL.bind(this), 'Queue event has ended, Retrying');
            default:
                Env.isDev && console.log(response.body);
                throw new RetryExecutor(this.getQueueItURL.bind(this), `Unable to get queue it url (${response.statusCode}), Retrying`);
        }
    }

    private async postQueueItRecaptcha() {
        let response: any;
        // let captchaToken = await this.solveInvisibleRecaptcha(this.queueItUrl);
        let captchaToken = await this.solveRecaptcha(this.queueItUrl, true, this.queueItInvisibleCaptchaKey!);
        this.updateStatus('Submitting queue captcha ...', TaskStatusColor.Neutral);
        try {
            response = await postCaptcha(this.httpClient, {
                ...this.baseDetails(),
                captchaToken,
                queueItVersion: this.queueItVersion,
                queueItEventId: this.queueItEventId,
                queueItCustomerId: this.queueItCustomerId,
            });
        } catch (e) {
            this.handleConnectionError(e, this.postQueueItRecaptcha.bind(this), 'Getting queue it URL');
            return;
        }

        const captchaObj = JSONParseSafely(response.body);
        Env.isDev && console.log(captchaObj);

        if (!captchaObj?.isVerified) throw new RetryExecutor(this.postQueueItRecaptcha.bind(this), 'Failed to verify queue it user');
        return captchaObj.sessionInfo;
    }

    private async getQueueItPow() {
        let response: any;
        this.updateStatus('Getting queue proof of work ...', TaskStatusColor.Neutral);
        try {
            response = await getPow(this.httpClient, {
                ...this.baseDetails(),
                queueItUserId: this.queueItUserId,
            });
        } catch (e) {
            this.handleConnectionError(e, this.getQueueItPow.bind(this), 'Getting queue it proof of work');
            return;
        }

        const powObj = JSONParseSafely(response.body);

        if (!powObj.meta) throw new RetryExecutor(this.getQueueItPow.bind(this), 'Failed to load proof of work response');

        this.queueItMeta = powObj?.meta;
        this.queueItSessionId = powObj?.sessionId;
        this.queueItPowParametersInput = powObj?.parameters?.input;
        this.queueItPowParametersZeroCount = powObj?.parameters?.zeroCount;
        return;
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
                screen: '1920 x 720',
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

    private async postQueueItPow() {
        let response: any;
        this.updateStatus('Sending queue it proof of work ...', TaskStatusColor.Neutral);
        try {
            response = await postPow(this.httpClient, {
                ...this.baseDetails(),
                payload: JSON.stringify(this.queueItPow),
                queueItCustomerId: this.queueItCustomerId,
                queueItEventId: this.queueItEventId,
                queueItVersion: this.queueItVersion,
            });
        } catch (e) {
            this.handleConnectionError(e, this.postQueueItPow.bind(this), 'Sending queue it proof of work ...');
            return;
        }

        switch (response.statusCode) {
            case 200:
                return JSONParseSafely(response.body)?.sessionInfo;
            default:
                throw new RetryExecutor(this.postQueueItPow.bind(this), 'Failed to submit queue it proof of work');
        }
    }

    private async queueItEnterQueue() {
        let response: any;
        this.updateStatus('Entering queue ...', TaskStatusColor.Neutral);
        try {
            response = await enterQueue(this.httpClient, {
                ...this.baseDetails(),
                queueItEventId: this.queueItEventId,
                queueItChallengeSessions: this.queueItChallengeSessions,
                queueItCustomUrlParams: this.queueItCustomUrlParams,
                queueItLayout: this.queueItLayout,
                queueItTargetUrl: this.queueItTargetUrl,
            });
        } catch (e) {
            this.handleConnectionError(e, this.queueItEnterQueue.bind(this), 'Sending queue it proof of work ...');
            return;
        }

        switch (response.statusCode) {
            case 200:
                const queueObj = JSONParseSafely(response.body);
                if (queueObj.challengeFailed || queueObj.invalidQueueitEnqueueToken)
                    throw new RetryExecutor(this.queueItEnterQueue.bind(this), 'Failed to enter queue, Retrying');
                return;
            default:
                throw new RetryExecutor(this.queueItEnterQueue.bind(this), `Failed to enter queue  (${response.statusCode})`);
        }
    }

    private async queueItPollQueue() {
        let response: any;
        this.updateStatus('Polling queue status ...', TaskStatusColor.Neutral);
        try {
            response = await pollQueue(this.httpClient, {
                ...this.baseDetails(),
                queueItEventId: this.queueItEventId,
                queueItLayout: this.queueItLayout,
                queueItTargetUrl: this.queueItTargetUrl,
                queueItCustomUrlParams: this.queueItCustomUrlParams,
                queueItLayoutVersion: this.queueItLayoutVersion,
                queueItQueueId: this.queueItQueueId,
                seid: this.queueItSeid,
                timestamp: this.queueItTimestamp,
            });
        } catch (e) {
            this.handleConnectionError(e, this.queueItPollQueue.bind(this), 'Polling queue status ...');
            return;
        }

        switch (response.statusCode) {
            case 200:
                const statusObj = JSONParseSafely(response.body);
                if (!response.body.includes('isRedirectToTarget'))
                    throw new RetryExecutor(this.queueItPollQueue.bind(this), `Task in queue, Polling ...`);
                else if (!statusObj?.isRedirectToTarget) {
                    if ((statusObj?.redirectUrl).includes('afterevent'))
                        throw new RetryExecutor(this.queueItPollQueue.bind(this), `Queue event has ended, Retrying`);
                    else throw new RetryExecutor(this.queueItPollQueue.bind(this), `Queue redirected to unknown location, Retrying`);
                } else {
                    this.queueItRedirectUrl = statusObj?.redirectUrl;
                    this.updateStatus(`Passed queue`, TaskStatusColor.Info);
                    return;
                }
            default:
                throw new RetryExecutor(this.queueItPollQueue.bind(this), `Failed to poll queue (${response.statusCode})`);
        }
    }
    //#endregion
    //#region misc
    private setFastlyAgent() {
        switch (this.task.websiteName) {
            case 'footlocker':
                this.userAgent = 'Footlocker/CFNetwork/Darwin';
                break;
            case 'footlockerca':
                this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:88.0) Gecko/20100101 Firefox/88.0';
                this.strategy = 'MinFirstTTL';
                break;
            case 'champssports':
                this.userAgent = 'ChampsSports/CFNetwork/Darwin';
                break;
            case 'eastbay':
                this.userAgent = 'Eastbay/CFNetwork/Darwin';
                break;
            case 'kidsfootlocker':
                this.userAgent = 'KidsFootlocker/CFNetwork/Darwin';
                break;
            case 'footaction':
                this.userAgent = 'FootAction/CFNetwork/Darwin';
                break;
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

    private setURL(cacheNodeName?: string) {
        if (cacheNodeName) this.url = `https://cache-${cacheNodeName}.hosts.fastly.net`;
        else this.url = `https://${this.host}`;
    }

    private updateCacheNode(data?: { headers: any; ttl: number }, didATC?: boolean) {
        const headers = data?.headers;
        const ttl = data?.ttl;
        const xTimer = headers?.['x-timer'] || '';
        const debugTTL = headers?.['fastly-debug-ttl'] || '';
        const debugPaths = headers?.['fastly-debug-path'] || '';
        if (!debugPaths || !debugTTL) return;
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
    //#endregion
}
