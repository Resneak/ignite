import { WalmartModes } from '..';
import { RetryExecutor, StopTask } from '../../../../lib/errors';
import { JSONParseSafely } from '../../../../lib/helpers';
import { createCredentials } from '../../../../lib/helpers/accounts';
import { TaskEvent, TaskStatusColor } from '../../../../lib/models/taskUpdate';
import { CaptchaTask, CaptchaType } from '../../models/captchaSolvers/captchaSolver';
import BotTask, { BotTaskProperties } from '../../models/tasks/botTask';
import { HawkPerimeterX, SupportedSite } from '../../utils/perimeterx';
import WalmartManager from './walmartManager';
import { Response, TimeoutError } from 'got';
import { encryptWalmartCreditCard, encryptWalmartPayment } from '../../utils/cryptography/encryptCard';

import getProductPage from './api/getProductPage';
import getCart from './api/getCart';
import removeItem from './api/removeItem';
import fetchEncryptionKey, { parseEncryptionKeys } from './api/fetchEncryptionKeys';
import creditCardType from 'credit-card-type';
import postCreditCard from './api/submitCreditCard';
import signIn from './api/signIn';
import fetchShippingRates from './api/fetchShippingRates';
import fetchProductInfo, { parseProductInfo, ProductOffer } from './api/fetchProductInfo';
import { parsePrice } from '../../../../lib/helpers/formatters';

import addToCart from './api/addToCart';
import getCheckout from './api/getCheckout';
import submitShipping from './api/submitShipping';
import startCheckout from './api/startCheckout';
import submitPayment from './api/submitPayment';
import createAccount from './api/createAccount';
import fulfillment from './api/submitFulfillment';
import SiteAccount from '../../../../lib/models/siteAccount';
import Env from '../../env';
import submitOrder from './api/submitOrder';
import { Cookie } from 'tough-cookie';
import { capitalizeFirstLetter, pollRandomEvent } from '../../../../cli/src/utils/general';

// process.env.NODE_NO_WARNINGS = '0';
// process.env.NODE_NO_DEPRECATION = '0';

export enum WalmartAccountType {
    Guest = 'guest',
    Login = 'login',
    New = 'new',
}

enum RetryMessage {
    Blocked = 'Blocked by px',
    Unknown = 'Unknown',
    ProxyBanned = 'Proxy banned, rotating...',
    RateLimited = 'Rate limited, rotating...',
    OutOfStock = 'Out of stock, retrying...',
}

const reportMessage = 'Please report this so we can add error handling :)';

export default class Walmart extends BotTask {
    /**
     *   href: 'https://walmart.com/'
     *   origin: 'https://walmart.com'
     *   host: 'walmart.com'
     *   hostname: 'walmart.com'
     */
    private url: URL;

    private _accountType: WalmartAccountType;

    private manager: WalmartManager;

    private px: HawkPerimeterX;

    /**
     * contains the state of the task
     * ignite should hold values that should eventually come from the server
     */
    private state!: {
        ignite: {
            isHoldCaptchaEnabled: boolean;
            isPreCartEnabled: boolean;
        };
        site: {
            userAgent: string;
            itemsInCart: string[];
            itemsInSavedForLater: string[];
            storeInfo: any;
            cardType: string;
            offerID: string;
            itemIDs: string[];
            preferenceID: string;
            isProductServerSideMonitorable: boolean;
            encryption: {
                PIE_key_id: string;
                PIE_key_phase: string;
                piHash: string;
                creditCard: {
                    encryptedPanCreditcard: string;
                    encryptedCvvPaymentCreditcard: string;
                    integrityCheckCreditcard: string;
                };
                payment: {
                    encryptedPanPayment: string;
                    encryptedCvvPayment: string;
                    integrityCheckPayment: string;
                };
            };
        };
    };

    private get initialState() {
        return {
            ignite: {
                isHoldCaptchaEnabled: true,
                isPreCartEnabled: false,
            },
            site: {
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36',
                itemsInCart: [],
                itemsInSavedForLater: [],
                cardType: this.getCardType(),
                storeInfo: {},
                offerID: '',
                itemIDs: [],
                isProductServerSideMonitorable: false,
                preferenceID: '',
                encryption: {
                    PIE_key_id: '',
                    PIE_key_phase: '',
                    piHash: '',
                    creditCard: {
                        encryptedPanCreditcard: '',
                        encryptedCvvPaymentCreditcard: '',
                        integrityCheckCreditcard: '',
                    },
                    payment: {
                        encryptedPanPayment: '',
                        encryptedCvvPayment: '',
                        integrityCheckPayment: '',
                    },
                },
            },
        };
    }

    protected *execute() {
        this.rotateProxy();
        this.manager.monitorProduct(this.task.product);
        this.updateStatus('Preloading...', TaskStatusColor.Neutral);

        this.monitorCookie();

        yield this.getUserAgent();

        yield this.getCartCookie();

        yield this.handleSignIn();

        if (!this.state.site.offerID) {
            yield this.getProductInfo();
        }

        yield this.encryptPayment();

        yield this.fetchShippingRates();

        yield this.submitCreditCard();

        yield this.getCheckout();

        yield this.addToCart();

        this.updateStatus('Starting contract', TaskStatusColor.Neutral);
        yield this.startCheckout();

        if (pollRandomEvent(3, 10)) {
            yield this.submitFulfillment();
        }

        yield this.submitShipping();
        yield this.submitPaymentII();
        yield this.submitOrder();
    }

    constructor(botTaskProps: BotTaskProperties) {
        super(botTaskProps);

        // this.setHTTP2(true);

        this.url = new URL('https://www.walmart.com');

        this.manager = WalmartManager.getInstance();

        this.px = new HawkPerimeterX(SupportedSite.Walmart, this.httpClient);

        this._accountType = this.accountType;
        if (this.accountType === WalmartAccountType.New) {
            const originalEmail = this.profile.billingAddress?.email || this.profile.shippingAddress.email;
            const { email, password } = createCredentials(originalEmail, true);
            this.task.username = email;
            this.task.password = password;
        }

        this.state = this.initialState;

        const [productID, offerID] = this.task.product.id.split(':').map((item) => item.trim());
        this.task.product.id = productID;
        if (offerID) {
            this.state.site.offerID = offerID;
        }
    }

    private monitorCookie() {
        setInterval(() => {
            this.solvePXCookie('normal');
        }, 120_000);
    }

    private async getUserAgent() {
        let response: Response<any>;
        try {
            response = await this.px.getUserAgent();
            if (response.body && !/error/.test(`${response.body}`)) {
                this.state.site.userAgent = response?.body;
            } else {
                this.state.site.userAgent =
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36';
            }
        } catch (e) {
            this.handleConnectionError(e, this.getUserAgent.bind(this), 'Preloading');
            return;
        }
    }

    /**
     *
     * @returns the account type for this task
     */
    private get accountType(): WalmartAccountType {
        if (!this._accountType) {
            if (this.task.mode === WalmartModes.Auto) {
                this._accountType = WalmartAccountType.New;
            } else if (this.task.mode === WalmartModes.Fast && this.task.username && this.task.password) {
                this._accountType = WalmartAccountType.Login;
            } else {
                this._accountType = WalmartAccountType.Guest;
            }
        }
        return this._accountType;
    }

    private set accountType(type: WalmartAccountType) {
        this._accountType = type;
    }

    /**
     *
     * @param currentStep name of the current step that the user should see
     * @param reason that we have to retry
     * @param response to get the status code from
     * @returns a formatted response log
     */
    private getRetryMessage(currentStep: string, reason?: string, response?: Response<any>) {
        const base = `Retrying: ${capitalizeFirstLetter(currentStep.toLowerCase())}.`;
        const reasonMsg = reason ? `Reason: ${reason?.toLowerCase?.()}.` : '';
        const statusCode = Env.isDev && response?.statusCode ? `Status Code: ${response?.statusCode}` : '';
        return [base, reasonMsg, statusCode].join(' ');
    }

    private async getProductPage() {
        const step = 'Getting product page';
        let response: Response<any>;

        try {
            response = await getProductPage(this.httpClient, this.state.site.userAgent, this.task.product.id);
        } catch (e) {
            this.handleConnectionError(e, this.getProductPage.bind(this), 'Product page');
            return;
        }

        switch (response?.statusCode) {
            case 200:
                return;
            default:
                throw new RetryExecutor(this.getProductPage.bind(this), 'Failed to get product page, retrying...');
        }
    }

    private async handleSignIn() {
        switch (this.accountType) {
            case WalmartAccountType.Guest:
                return;
            case WalmartAccountType.Login:
                return this.signIn();

            case WalmartAccountType.New:
                return this.createAccount();
        }
    }

    private signInAttempts = {
        userAuthFailed: 0,
        blocks: 0,
        unknown403: 0,
        unknown: 0,
    };
    private async signIn() {
        const step = `Signing in`;

        let response: Response<any>;
        try {
            if (!this.task.username || !this.task.password) {
                this._accountType = WalmartAccountType.Guest;
                throw new RetryExecutor(this.handleSignIn.bind(this), 'No username or password, switching to guest account');
            }
            response = await signIn(this.httpClient, this.state.site.userAgent, { email: this.task.username, password: this.task.password });
        } catch (e) {
            this.handleConnectionError(e, this.signIn.bind(this), step);
            return;
        }

        const body = JSONParseSafely(response?.body);
        let retryMessage;

        switch (response?.statusCode) {
            case 200:
                this.setStatus(`Signed in!`, TaskStatusColor.Info);
                return;
            case 444:
                await this.reset();
                throw new RetryExecutor(this.handleSignIn.bind(this), RetryMessage.RateLimited, this.getRetryMessage(step, RetryMessage.RateLimited));
            case 403:
                if (body?.code === 'user_auth_fail') {
                    this.signInAttempts.userAuthFailed += 1;
                    if (this.signInAttempts.userAuthFailed > 2) {
                        this.accountType = WalmartAccountType.Guest;
                        throw new RetryExecutor(
                            this.handleSignIn.bind(this),
                            `Incorrect passowrd for ${this.task.username}, switching to guest account`
                        );
                    }
                    retryMessage = `Incorrect password for ${this.task.username}`;
                } else {
                    this.signInAttempts.unknown403 += 1;
                    retryMessage = `error: ${body?.code}. ${reportMessage}`;
                }
                throw new RetryExecutor(
                    this.signIn.bind(this),
                    `Sign in error: ${retryMessage}, Retrying...`,
                    this.getRetryMessage(step, retryMessage, response)
                );
            default: {
                const attempts = this.signInAttempts.blocks + this.signInAttempts.unknown;
                retryMessage = await this.detectAndHandleCaptcha(response, attempts);

                if (retryMessage === RetryMessage.Blocked) {
                    this.signInAttempts.blocks += 1;
                } else {
                    this.signInAttempts.unknown += 1;
                }

                throw new RetryExecutor(this.signIn.bind(this), 'Sign in failed, retrying...', this.getRetryMessage(step, retryMessage, response));
            }
        }
    }

    private createAccountAttempts = {
        blocks: 0,
        unknown: 0,
    };
    private async createAccount() {
        let step = 'Creating account';
        let response: Response<any>;

        try {
            response = await createAccount(this.httpClient, this.state.site.userAgent, {
                firstName: this.profile.shippingAddress.firstName,
                lastName: this.profile.shippingAddress.lastName,
                email: this.task.username!,
                password: this.task.password!,
            });
        } catch (e) {
            this.handleConnectionError(e, this.createAccount.bind(this), step);
            return;
        }

        let body = JSONParseSafely(response?.body);
        switch (response?.statusCode) {
            case 200:
                this.setStatus(
                    SiteAccount.toString({ site: this.website.name, username: this.task.username!, password: this.task.password! }),
                    TaskStatusColor.Info,
                    TaskEvent.AccountCreated
                );
                return;

            case 302:
                this.rotateProxy();
                Env.isDev && console.log(response?.headers?.location);
                throw new RetryExecutor(this.createAccount.bind(this), RetryMessage.ProxyBanned, this.getRetryMessage(step, 'Redirected', response));
            case 403:
                if (body?.code === 'account_already_exist') {
                    const retryMessage = `Account already exists with email ${this.task.username}, re-spoofing`;
                    const originalEmail = this.profile.billingAddress?.email || this.profile.shippingAddress.email;
                    const { email, password } = createCredentials(originalEmail, true);
                    this.task.username = email;
                    this.task.password = password;
                    throw new RetryExecutor(
                        this.createAccount.bind(this),
                        'Account already exists, creating. Re-spoofing...',
                        this.getRetryMessage(step, retryMessage, response)
                    );
                }
            case 444:
                await this.reset();
                throw new RetryExecutor(
                    this.createAccount.bind(this),
                    RetryMessage.ProxyBanned,
                    this.getRetryMessage(step, RetryMessage.RateLimited)
                );
            case 412:
            default:
                let tries = this.createAccountAttempts.blocks + this.createAccountAttempts.unknown;

                const retryReason = await this.detectAndHandleCaptcha(response, tries);

                if (retryReason === RetryMessage.Blocked) {
                    this.createAccountAttempts.blocks += 1;
                } else {
                    this.createAccountAttempts.unknown += 1;
                }

                throw new RetryExecutor(
                    this.createAccount.bind(this),
                    'Create account failed, retrying...',
                    this.getRetryMessage(step, retryReason, response)
                );
        }
    }

    private getCartCookieAttempts = {
        failedToClearCart: 0,
        invalidResponse: 0,
        redirects: 0,
        blocks: 0,
        unknown: 0,
    };
    private async getCartCookie() {
        const step = 'Getting cart cookie';

        let response: Response<any>;
        try {
            response = await getCart(this.httpClient, this.state.site.userAgent, this.accountType, this.task.product.id);
        } catch (e) {
            this.handleConnectionError(e, this.getCartCookie.bind(this), step);
            return;
        }
        let CRTCookie;

        switch (response?.statusCode) {
            case 200:
                const data = JSONParseSafely(response?.body?.match?.(/<script id="tb-djs-wml-redux-state"[^>]*>(.*?)<\/script>/)?.[1]);

                const itemsInCart = (data?.cartData?.items || []).map((item) => item.id);
                const itemsInSavedForLater = (data?.sflData?.savedItems || []).map((item) => item.id);

                try {
                    await this.cleanCart(itemsInCart, itemsInSavedForLater);
                } catch (e) {
                    this.getCartCookieAttempts.failedToClearCart += 1;
                    throw new RetryExecutor(
                        this.getCartCookie.bind(this),
                        'Cart cookie failed, retrying...',
                        this.getRetryMessage(step, 'failed to clear cart', response)
                    );
                }

                CRTCookie = this.getCookie('CRT');
                let cookiePromises: Promise<Cookie>[] = [];
                if (!CRTCookie) {
                    for (const cookie of response.headers?.['set-cookie'] || []) {
                        if (/CRT=/.test(cookie)) CRTCookie = true;
                        cookiePromises.push(this.cookieJar.setCookie(cookie, this.url.origin));
                    }
                    await Promise.all(cookiePromises);
                }
                if (!CRTCookie) {
                    await this.reset();
                    this.getCartCookieAttempts.invalidResponse += 1;
                    throw new RetryExecutor(
                        this.getCartCookie.bind(this),
                        'Cart cookie failed, retrying...',
                        this.getRetryMessage(step, 'invalid response', response)
                    );
                }
                return;
            case 444:
                await this.reset();
                throw new RetryExecutor(
                    this.getCartCookie.bind(this),
                    RetryMessage.ProxyBanned,
                    this.getRetryMessage(step, RetryMessage.RateLimited)
                );
            case 302:
                if (response?.headers?.location === 'http://www.walmart.com.mx/') {
                    await this.reset();
                    throw new RetryExecutor(
                        this.getCartCookie.bind(this),
                        RetryMessage.ProxyBanned,
                        this.getRetryMessage(step, 'Redirected to Walmart Mexico', response)
                    );
                }

                CRTCookie = this.getCookie('CRT');
                if (!CRTCookie) {
                    const totalAttempts = this.getTotalAttempts(this.getCartCookieAttempts);
                    if (totalAttempts > 0 && totalAttempts % 2 === 0) {
                        this.initNewCookieJar();
                        await this.reset();
                        throw new RetryExecutor(
                            this.getCartCookie.bind(this),
                            RetryMessage.ProxyBanned,
                            this.getRetryMessage(step, 'Failed to get cart')
                        );
                    }
                    this.getCartCookieAttempts.redirects += 1;
                    const cookies = this.cookieJar.getCookiesSync(this.url.origin);
                    cookies
                        .filter((x) => x.key !== 'vtc' && x.key !== 'bstc' && x.key !== 'akavpau_p1')
                        .forEach((cookie) => this.cookieJar.setCookie(`${cookie.key}=${cookie.value};`, this.url.origin));

                    await this.reset();
                    throw new RetryExecutor(
                        this.getCartCookie.bind(this),
                        RetryMessage.ProxyBanned,
                        this.getRetryMessage(step, 'Failed to get cart', response)
                    );
                }
                break;
            case 307:
                this.getCartCookieAttempts.redirects += 1;
                if (this.getCartCookieAttempts.redirects > 0 && this.getCartCookieAttempts.redirects % 2 === 0) {
                    this.initNewCookieJar();
                    await this.reset();
                    throw new RetryExecutor(
                        this.getCartCookie.bind(this),
                        RetryMessage.ProxyBanned,
                        this.getRetryMessage(step, 'Failed to get cart')
                    );
                }
                this.initNewCookieJar();
                await this.reset();
                throw new RetryExecutor(
                    this.getCartCookie.bind(this),
                    RetryMessage.ProxyBanned,
                    this.getRetryMessage(step, RetryMessage.ProxyBanned, response)
                );

            default:
                const defaultRetries = this.getCartCookieAttempts.blocks + this.getCartCookieAttempts.unknown;
                const retryMessage = await this.detectAndHandleCaptcha(response, defaultRetries);

                if (retryMessage === RetryMessage.Blocked) {
                    this.getCartCookieAttempts.blocks += 1;
                } else {
                    this.getCartCookieAttempts.unknown += 1;
                }

                throw new RetryExecutor(
                    this.getCartCookie.bind(this),
                    'Cart cookie failed, retrying...',
                    this.getRetryMessage(step, retryMessage, response)
                );
        }
    }

    private cleanCart(idsInCart: string[], idsInSavedForLater: string[]) {
        let removeAllItemsFromSavedForLaterPromises: Promise<void>[] = [];
        const removeAllItemsFromCartPromises = idsInCart.map((item) => this.removeItem('cart', item));
        if (this.state.ignite.isPreCartEnabled) {
            removeAllItemsFromSavedForLaterPromises = idsInSavedForLater.map((item) => this.removeItem('saved', item));
        }
        return Promise.all([...removeAllItemsFromCartPromises, ...removeAllItemsFromSavedForLaterPromises]);
    }

    /**
     *
     * @param removeItemFrom either a cart or saved items (as far as I know, this doesn't work for lists)
     * @param itemID pid of the product to remove
     */
    private async removeItem(removeItemFrom: 'cart' | 'saved', itemID: string) {
        if (!itemID) return;
        let response;
        try {
            response = await removeItem(this.httpClient, this.state.site.userAgent, removeItemFrom, itemID);
        } catch (e) {
            throw new Error(e);
        }
        if (response?.statusCode === 200) {
            return;
        }
        throw new Error(`Failed to remove item from ${removeItemFrom}`);
    }

    private encryptPaymentAttempts = {
        failedToGetEncryptionKeys: 0,
        failedToEncryptInfo: 0,
        blocks: 0,
        unknown: 0,
    };

    private async encryptPayment() {
        const step = `Encrypting payment`;

        let response: Response<any>;
        try {
            response = await fetchEncryptionKey(this.httpClient, this.state.site.userAgent);
        } catch (e) {
            this.handleConnectionError(e, this.encryptPayment.bind(this), step);
            return;
        }
        switch (response?.statusCode) {
            case 200:
                const { PIE_L, PIE_E, PIE_K, PIE_key_id, PIE_phase } = parseEncryptionKeys(response?.body);

                if (Number.isNaN(PIE_L) || Number.isNaN(PIE_E) || !PIE_K || !PIE_key_id || Number.isNaN(PIE_phase)) {
                    this.encryptPaymentAttempts.failedToGetEncryptionKeys += 1;
                    throw new RetryExecutor(
                        this.encryptPayment.bind(this),
                        `${step} failed, retrying...`,
                        this.getRetryMessage(step, 'Failed to get encryption keys', response)
                    );
                }

                const [encryptedPanCreditcard, encryptedCvvPaymentCreditcard, integrityCheckCreditcard] =
                    encryptWalmartCreditCard(PIE_L, PIE_E, PIE_K, PIE_key_id, PIE_phase, this.profile.payment.number, this.profile.payment.code) ||
                    [];
                const [encryptedPanPayment, encryptedCvvPayment, integrityCheckPayment] =
                    encryptWalmartPayment(PIE_L, PIE_E, PIE_K, PIE_key_id, PIE_phase, this.profile.payment.code) || [];

                if (!encryptedPanCreditcard || !encryptedCvvPaymentCreditcard || !integrityCheckCreditcard) {
                    this.encryptPaymentAttempts.failedToGetEncryptionKeys += 1;
                    throw new RetryExecutor(
                        this.encryptPayment.bind(this),
                        `${step} failed, retrying...`,
                        this.getRetryMessage(step, 'Failed to encrypt credit card', response)
                    );
                } else if (!encryptedPanPayment || !encryptedCvvPayment || !integrityCheckPayment) {
                    this.encryptPaymentAttempts.failedToGetEncryptionKeys += 1;
                    throw new RetryExecutor(
                        this.encryptPayment.bind(this),
                        `${step} failed, retrying...`,
                        this.getRetryMessage(step, 'Failed to encrypt payment', response)
                    );
                } else {
                    this.state.site.encryption = {
                        PIE_key_id: `${PIE_key_id}`,
                        PIE_key_phase: `${PIE_phase}`,
                        piHash: '',
                        creditCard: {
                            encryptedPanCreditcard,
                            encryptedCvvPaymentCreditcard,
                            integrityCheckCreditcard,
                        },
                        payment: {
                            encryptedPanPayment,
                            encryptedCvvPayment,
                            integrityCheckPayment,
                        },
                    };
                    return;
                }
            case 444:
                await this.reset();
                throw new RetryExecutor(
                    this.encryptPayment.bind(this),
                    RetryMessage.ProxyBanned,
                    this.getRetryMessage(step, RetryMessage.RateLimited)
                );
            default:
                const defaultRetries = this.encryptPaymentAttempts.blocks + this.encryptPaymentAttempts.unknown;
                const retryMessage = await this.detectAndHandleCaptcha(response, defaultRetries);

                if (retryMessage === RetryMessage.Blocked) {
                    this.encryptPaymentAttempts.blocks += 1;
                } else {
                    this.encryptPaymentAttempts.unknown += 1;
                }

                throw new RetryExecutor(
                    this.encryptPayment.bind(this),
                    `${step} failed, retrying...`,
                    this.getRetryMessage(step, retryMessage, response)
                );
        }
    }

    private submitCreditCardAttempts = {
        failedToParse: 0,
        proxyBan: 0,
        unknown: 0,
        blocks: 0,
    };
    private async submitCreditCard() {
        const step = 'Submitting credit card';

        let response: Response<any>;
        const data = {
            encryptedPan: this.state.site.encryption.creditCard.encryptedPanCreditcard,
            encryptedCvv: this.state.site.encryption.creditCard.encryptedCvvPaymentCreditcard,
            integrityCheck: this.state.site.encryption.creditCard.integrityCheckCreditcard,
            PIE_key_id: this.state.site.encryption.PIE_key_id,
            PIE_phase: this.state.site.encryption.PIE_key_phase,
            profile: this.profile,
            cardType: this.state.site.cardType,
        };

        try {
            response = await postCreditCard(this.httpClient, this.state.site.userAgent, this.accountType, data);
        } catch (e) {
            this.handleConnectionError(e, this.submitCreditCard.bind(this), step);
            return;
        }

        const body = JSONParseSafely(response?.body);
        switch (response?.statusCode) {
            case 200:
                const piHash = body?.piHash || '';
                const preferenceID = body?.id;
                this.state.site.preferenceID = preferenceID || '';
                const preferenceIDRequired = this.accountType !== WalmartAccountType.Guest;
                if (!piHash || (preferenceIDRequired && !preferenceID)) {
                    this.submitCreditCardAttempts.failedToParse += 1;
                    throw new RetryExecutor(
                        this.submitCreditCard.bind(this),
                        `${step} failed, retrying...`,
                        this.getRetryMessage(step, 'Failed to parse body', response)
                    );
                }
                this.state.site.encryption.piHash = piHash;

                return;

            case 444:
                await this.reset();
                this.submitCreditCardAttempts.proxyBan += 1;
                throw new RetryExecutor(
                    this.submitCreditCard.bind(this),
                    RetryMessage.ProxyBanned,
                    this.getRetryMessage(step, RetryMessage.ProxyBanned, response)
                );
            default:
                const attempts = this.submitCreditCardAttempts.unknown + this.submitCreditCardAttempts.blocks;

                const retryReason = await this.detectAndHandleCaptcha(response, attempts);

                if (retryReason === RetryMessage.Blocked) {
                    this.submitCreditCardAttempts.blocks += 1;
                } else {
                    this.submitCreditCardAttempts.unknown += 1;
                }

                throw new RetryExecutor(
                    this.submitCreditCard.bind(this),
                    `${step} failed, retrying...`,
                    this.getRetryMessage(step, retryReason, response)
                );
        }
    }

    private fetchShippingRatesAttempts = {
        failedToParse: 0,
        unknown: 0,
        proxyBan: 0,
        blocks: 0,
    };

    private async fetchShippingRates() {
        const step = 'Fetching shipping rates';

        let response: Response<any>;
        try {
            response = await fetchShippingRates(this.httpClient, this.state.site.userAgent, this.profile.shippingAddress.zip);
        } catch (e) {
            this.handleConnectionError(e, this.fetchShippingRates.bind(this), step);
            return;
        }

        const body = JSONParseSafely(response?.body);
        switch (response?.statusCode) {
            case 200:
                if (!body) {
                    this.fetchShippingRatesAttempts.failedToParse += 1;
                    throw new RetryExecutor(
                        this.fetchShippingRates.bind(this),
                        `${step} failed, retrying...`,
                        this.getRetryMessage(step, 'failed to parse', response)
                    );
                }

                this.state.site.storeInfo = {
                    storeList: [{ id: body?.stores?.[0]?.storeId }],
                    postalCode: body?.location?.postalCode,
                    city: body?.location?.city,
                    state: body?.location?.state,
                    isZipLocated: true,
                    'crt:CRT': '',
                    'customerId:CID': '',
                    'customerType:type': '',
                    'affiliateInfo:com.wm.reflector': '',
                };

                return;
            case 444:
                await this.reset();
                this.fetchShippingRatesAttempts.proxyBan += 1;
                throw new RetryExecutor(
                    this.fetchShippingRates.bind(this),
                    RetryMessage.ProxyBanned,
                    this.getRetryMessage(step, RetryMessage.ProxyBanned, response)
                );
            default:
                const attempts = this.fetchShippingRatesAttempts.unknown + this.fetchShippingRatesAttempts.blocks;

                const retryReason = await this.detectAndHandleCaptcha(response, attempts);

                if (retryReason === RetryMessage.Blocked) {
                    this.submitCreditCardAttempts.blocks += 1;
                } else {
                    this.submitCreditCardAttempts.unknown += 1;
                }

                throw new RetryExecutor(
                    this.fetchShippingRates.bind(this),
                    `${step} failed, retrying...`,
                    this.getRetryMessage(step, retryReason, response)
                );
        }
    }

    private async getProductInfo() {
        const step = 'Getting product info';

        // const { supported, stockEvent } = await this.manager.awaitMonitor(this.task.product, this.updateStatus.bind(this));
        // const walmartStockEvent = stockEvent as WalmartStockEvent;
        // if (supported && walmartStockEvent?.offerID) {
        //     this.state.site.isProductServerSideMonitorable = true;
        //     this.task.product.image = walmartStockEvent.image;
        //     this.task.product.name = walmartStockEvent.productName;
        //     this.task.product.price = walmartStockEvent.price ? `${walmartStockEvent.price}` : 'Unable to parse';
        //     this.state.site.offerID = walmartStockEvent.offerID;
        //     return;
        // } else {
        //     this.state.site.isProductServerSideMonitorable = false;
        const productOffer = this.manager.getProductOffer(this.task.product.id);
        if (productOffer?.offerID) {
            this.task.product.image = productOffer.image;
            this.task.product.name = productOffer.name;
            this.task.product.price = productOffer.price;
            this.state.site.offerID = productOffer.offerID;
            // this.manager.setProductOffer(this.task.product.id, productOffer);
            return;
        }
        return this.fetchProductInfo();
        // }
    }

    private fetchProductInfoAttempts = {
        failedToParse: 0,
        proxyBan: 0,
        blocks: 0,
        unknown: 0,
    };

    /**
     * scrapes and parses product info
     * we retry the getProductInfo method so that if another task parses the offer it will be reused
     * @returns
     */
    private async fetchProductInfo() {
        const step = 'Fetching product info';

        let response: Response<any>;
        try {
            response = await fetchProductInfo(this.httpClient, this.state.site.userAgent, this.task.product.id);
        } catch (e) {
            this.handleConnectionError(e, this.getProductInfo.bind(this), step);
            return;
        }

        let body = JSONParseSafely(response?.body);
        switch (response?.statusCode) {
            case 200:
                if (!body) {
                    if (/Forbidden/.test(`${response?.body}`)) {
                        await this.reset();
                        this.fetchProductInfoAttempts.proxyBan += 1;
                        throw new RetryExecutor(
                            this.getProductInfo.bind(this),
                            `${step} failed, retrying...`,
                            this.getRetryMessage(step, RetryMessage.ProxyBanned)
                        );
                    }
                    this.fetchProductInfoAttempts.failedToParse += 1;
                    throw new RetryExecutor(
                        this.getProductInfo.bind(this),
                        `${step} failed, retrying...`,
                        this.getRetryMessage(step, 'failed to parse', response)
                    );
                }

                const { success, productOffer: parsedProductOffer } = parseProductInfo(body);
                const productOffer = parsedProductOffer as ProductOffer;

                if (!success || !parsedProductOffer) {
                    this.fetchProductInfoAttempts.failedToParse += 1;
                    throw new RetryExecutor(
                        this.getProductInfo.bind(this),
                        `${step} failed, retrying...`,
                        this.getRetryMessage(step, 'failed to parse', response)
                    );
                } else if (!productOffer?.offerID) {
                    this.updateStatus('Out of stock, retrying...', TaskStatusColor.Ping);
                    throw new RetryExecutor(this.getProductInfo.bind(this), '', this.getRetryMessage(step, 'OOS', response));
                }

                this.task.product.image = productOffer.image;
                this.task.product.name = productOffer.name;
                this.task.product.price = productOffer.price;
                this.state.site.offerID = productOffer.offerID;

                this.manager.setProductOffer(this.task.product.id, productOffer);
                return;

            case 444:
                await this.reset();
                this.fetchProductInfoAttempts.proxyBan += 1;
                throw new RetryExecutor(
                    this.getProductInfo.bind(this),
                    RetryMessage.RateLimited,
                    this.getRetryMessage(step, RetryMessage.ProxyBanned, response)
                );

            default:
                const tries = this.fetchProductInfoAttempts.blocks + this.fetchProductInfoAttempts.unknown;
                const retryReason = await this.detectAndHandleCaptcha(response, tries);

                if (retryReason === RetryMessage.Blocked) {
                    this.fetchProductInfoAttempts.blocks += 1;
                } else {
                    this.fetchProductInfoAttempts.unknown += 1;
                }
                throw new RetryExecutor(
                    this.getProductInfo.bind(this),
                    `${step} failed, retrying...`,
                    this.getRetryMessage(step, retryReason, response)
                );
        }
    }

    private addToCartAttempts = {
        redirects: 0,
        blocks: 0,
        unknown: 0,
    };
    private async addToCart() {
        const step = 'Adding to cart';

        let response: Response<any>;

        const atcDetails = {
            productID: this.task.product.id,
            offerId: this.state.site.offerID,
            quantity: this.task.atcQuantity,
            postalCode: this.profile.shippingAddress.zip,
            city: this.profile.shippingAddress.city,
            stateCode: this.profile.shippingAddress.stateCode,
            storeIds: this.state.site.storeInfo?.storeList?.map((item) => parseInt(item)) || [null],
        };

        try {
            response = await addToCart(this.httpClient, this.state.site.userAgent, this.accountType, atcDetails);
        } catch (e) {
            this.handleConnectionError(e, this.addToCart.bind(this), step);
            return;
        }
        const body = JSONParseSafely(response?.body);

        switch (response?.statusCode) {
            case 200:
            case 201:
                const item = body?.items?.[0];
                const image = Object.values(item?.assets?.primary?.[0] || {})?.[0] || '';
                const name = item?.name;
                const price = parsePrice(body?.cart?.totals?.grandTotal);
                this.task.product.price = `${price}`;
                this.task.product.name = name || 'Failed to parse';
                this.task.product.image = `${image}` || '';
                this.setStatus(`${this.task.product.name} added to cart`, TaskStatusColor.Cart, TaskEvent.Carted);
                return;
            case 302:
                this.addToCartAttempts.redirects += 1;
                await this.reset();
                throw new RetryExecutor(this.addToCart.bind(this), RetryMessage.ProxyBanned, this.getRetryMessage(step, 'OOS', response));
            case 444:
                await this.reset();

                throw new RetryExecutor(this.addToCart.bind(this), RetryMessage.RateLimited, this.getRetryMessage(step, RetryMessage.RateLimited));

            case 400:
                switch (body?.message) {
                    case "'canAddToCart' flag is false.":
                        this.updateStatus('Out of stock, retrying...', TaskStatusColor.Ping);
                        throw new RetryExecutor(this.addToCart.bind(this), '', this.getRetryMessage(step, 'OOS', response));
                }
            default:
                const tries = this.addToCartAttempts.blocks + this.addToCartAttempts.unknown;
                const retryMessage = await this.detectAndHandleCaptcha(response, tries);
                if (retryMessage === RetryMessage.Blocked) {
                    this.addToCartAttempts.blocks += 1;
                } else {
                    this.addToCartAttempts.unknown += 1;
                }

                const oosMessage = `Out of stock - ${retryMessage}`;
                this.updateStatus('Out of stock, retrying...', TaskStatusColor.Ping);
                throw new RetryExecutor(this.addToCart.bind(this), '', this.getRetryMessage(step, oosMessage, response));
        }
    }

    private getCheckoutAttempts = {
        blocks: 0,
        unknown: 0,
    };
    private async getCheckout() {
        let step = 'Getting checkout';

        let response: Response<any>;

        try {
            response = await getCheckout(this.httpClient, this.state.site.userAgent);
        } catch (e) {
            this.handleConnectionError(e, this.getCheckout.bind(this), step);
            return;
        }

        switch (response?.statusCode) {
            case 200:
            case 201:
                return;

            default:
                let tries = this.getCheckoutAttempts.blocks + this.getCheckoutAttempts.unknown;
                const retryMessage = await this.detectAndHandleCaptcha(response, tries);

                if (retryMessage === RetryMessage.Blocked) {
                    this.getCheckoutAttempts.blocks += 1;
                } else {
                    this.getCheckoutAttempts.unknown += 1;
                }

                throw new RetryExecutor(
                    this.getCheckout.bind(this),
                    `${step} failed, retrying...`,
                    this.getRetryMessage(step, retryMessage, response)
                );
        }
    }

    private startCheckoutAttempts = {
        outOfStock: 0,
        proxyBans: 0,
        blocks: 0,
        unknown: 0,
    };
    private async startCheckout() {
        const step = 'Starting checkout';

        let response: Response<any>;

        try {
            response = await startCheckout(this.httpClient, this.state.site.userAgent, this.state.site.storeInfo);
        } catch (e) {
            this.handleConnectionError(e, this.startCheckout.bind(this), step);
            return;
        }
        const json = JSONParseSafely(response?.body);
        switch (response?.statusCode) {
            case 200:
            case 201:
                this.state.site.itemIDs = json?.items?.map((item) => item.id);
                return;

            case 444:
                await this.reset();
                this.startCheckoutAttempts.proxyBans += 1;
                throw new RetryExecutor(this.startCheckout.bind(this), this.getRetryMessage(step, RetryMessage.ProxyBanned, response));
            case 400:
                if (JSONParseSafely(response?.body)?.message?.includes?.('Item is no longer in stock.')) {
                    this.startCheckoutAttempts.outOfStock += 1;
                    throw new RetryExecutor(this.startCheckout.bind(this), this.getRetryMessage(step, 'Item no longer in stock.', response));
                }
            default:
                const tries = this.startCheckoutAttempts.blocks + this.startCheckoutAttempts.unknown;
                const retryMessage = await this.detectAndHandleCaptcha(response, tries);
                if (retryMessage === RetryMessage.Blocked) {
                    this.startCheckoutAttempts.blocks += 1;
                } else {
                    this.startCheckoutAttempts.unknown += 1;
                }

                throw new RetryExecutor(this.startCheckout.bind(this), this.getRetryMessage(step, retryMessage, response));
        }
    }

    /**
     * not required
     */
    private async submitFulfillment() {
        const step = 'Submitting fulfillment';
        let response: Response<any>;

        try {
            response = await fulfillment(this.httpClient, this.state.site.userAgent, this.state.site.itemIDs);
        } catch (e) {
            this.handleConnectionError(e, this.submitFulfillment.bind(this), step);
            return;
        }
    }

    private submitShippingAttempts = {
        blocks: 0,
        unknown: 0,
    };
    private async submitShipping() {
        const step = 'Submitting shipping';

        let response: Response<any>;
        try {
            response = await submitShipping(
                this.httpClient,
                this.state.site.userAgent,
                this.accountType,
                this.profile,
                this.task.username || '',
                this.state.site.preferenceID
            );
        } catch (e) {
            this.handleConnectionError(e, this.submitShipping.bind(this), step);
            return;
        }

        switch (response?.statusCode) {
            case 200:
                return;

            case 444:
                await this.reset();
                throw new RetryExecutor(
                    this.submitShipping.bind(this),
                    RetryMessage.RateLimited,
                    this.getRetryMessage(step, RetryMessage.RateLimited)
                );
            default:
                let attempts = this.getTotalAttempts(this.submitShippingAttempts);
                const retryMessage = await this.detectAndHandleCaptcha(response, attempts);

                if (retryMessage === RetryMessage.Blocked) {
                    this.submitShippingAttempts.blocks += 1;
                } else {
                    this.submitShippingAttempts.unknown += 1;
                }

                throw new RetryExecutor(
                    this.submitShipping.bind(this),
                    `${step} failed, retrying...`,
                    this.getRetryMessage(step, retryMessage, response)
                );
        }
    }

    private submitPaymentIIAttempts = {
        blocks: 0,
        unknown: 0,
    };
    private async submitPaymentII() {
        const step = 'Submitting payment II';

        let response: Response<any>;

        try {
            response = await submitPayment(
                this.httpClient,
                this.state.site.userAgent,
                this.accountType,
                this.state.site.cardType,
                this.state.site.encryption,
                this.profile,
                this.state.site.preferenceID
            );
        } catch (e) {
            this.handleConnectionError(e, this.submitPaymentII.bind(this), step);
            return;
        }

        switch (response?.statusCode) {
            case 200:
                return;
            case 444:
                await this.reset();
                throw new RetryExecutor(
                    this.submitPaymentII.bind(this),
                    RetryMessage.ProxyBanned,
                    this.getRetryMessage(step, RetryMessage.RateLimited)
                );
            default:
                let tries = this.submitPaymentIIAttempts.unknown + this.submitPaymentIIAttempts.blocks;
                let retryReason = await this.detectAndHandleCaptcha(response, tries);

                if (retryReason === RetryMessage.Blocked) {
                    this.submitPaymentIIAttempts.blocks += 1;
                } else {
                    this.submitPaymentIIAttempts.unknown += 1;
                }

                throw new RetryExecutor(
                    this.submitPaymentII.bind(this),
                    `${step} failed, retrying...`,
                    this.getRetryMessage(step, retryReason, response)
                );
        }
    }

    private async submitOrder() {
        let step = 'Submitting order';

        let response: Response<any>;
        try {
            response = await submitOrder(this.httpClient, this.state.site.userAgent, this.state.site.encryption, this.state.site.preferenceID);
        } catch (e) {
            this.handleConnectionError(e, this.submitOrder.bind(this), step);
            return;
        }

        switch (response?.statusCode) {
            case 200:
                Env.isDev && console.log(response?.body);
                this.task.checkoutProxy = this.proxy?.toString();
                this.setStatus('Successful Checkout', TaskStatusColor.Success, TaskEvent.CheckoutSuccess);
                return;
            case 444:
                await this.reset();
                throw new RetryExecutor(this.submitOrder.bind(this), RetryMessage.RateLimited, this.getRetryMessage(step, RetryMessage.RateLimited));

            case 400:
                const body = JSONParseSafely(response?.body);
                if (
                    body?.code === 'payment_service_invalid_account_no' ||
                    body?.code === 'payment_service_insufficient_funds' ||
                    body?.message?.includes?.(
                        'We cannot get authorization for this payment method. Please check the Credit Card values like Card Number, Security Code, Expiration Date and try again or try a different payment method.'
                    ) ||
                    body?.message?.includes?.("Your payment couldn't be authorized. Please use a different card or payment option.")
                ) {
                    const message =
                        body?.message.includes("Your payment couldn't be authorized") ||
                        body?.message.includes('We cannot get authorization for this payment method.')
                            ? 'Payment could not be authorized.'
                            : body?.message;

                    this.task.checkoutProxy = this.proxy?.toString();
                    this.setStatus(`Payment Declined: ${message}`, TaskStatusColor.Error, TaskEvent.CheckoutDecline);
                    return;
                } else if (body?.message?.includes('Mandatory information missing in Purchase Contract for Submit.')) {
                    await this.submitFulfillment();
                    throw new RetryExecutor(
                        this.submitOrder.bind(this),
                        `${step} failed, retrying...`,
                        this.getRetryMessage(step, 'waiting for fulfillment')
                    );
                } else if (
                    body?.message?.includes('Purchase Contract has expired. Create a new Purchase Contract') ||
                    body?.message?.includes('Cookie PCID is missing')
                ) {
                    await this.startCheckout();
                    await this.submitShipping();
                    await this.submitPaymentII();
                    throw new RetryExecutor(
                        this.submitOrder.bind(this),
                        `${step} expired, restarting contract...`,
                        `Failed to Submit Order. Reason: ${body?.message}`
                    );
                } else {
                    Env.isDev && console.dir(body);
                    const message = body?.message || 'Unknown';
                    throw new RetryExecutor(this.submitOrder.bind(this), `${step} failed, retrying...`, `Failed to Submit Order. Reason: ${message}`);
                }

            default:
                let tries = 0;
                const retryReason = await this.detectAndHandleCaptcha(response, tries);
                throw new RetryExecutor(
                    this.submitOrder.bind(this),
                    `${step} failed, retrying...`,
                    this.getRetryMessage(step, retryReason, response)
                );
        }
    }

    getTotalAttempts(obj: Record<string, number>) {
        let total = 0;
        for (const value of Object.values(obj)) {
            total += value;
        }
        return total;
    }

    private getCardType() {
        let cardType;
        try {
            cardType = creditCardType(this.profile.payment.number)[0].type.toUpperCase().replace('-', '_');
            if (cardType == 'AMERICAN_EXPRESS') {
                cardType = 'AMEX';
            }
            return cardType;
        } catch (e) {
            throw new StopTask('Invalid Credit Card');
        }
    }

    /**
     *
     * @param response to detect a captcha from and handle
     * @returns a the retry message indicating if the response was a block or not
     */
    private async detectAndHandleCaptcha(response: Response<any>, tries: number) {
        if (tries > 0 && tries % 5 === 0) {
            await this.reset();
            return RetryMessage.Blocked;
        }

        const body = JSONParseSafely(response?.body);
        if (body?.vid) this.px.setVID(body.vid);
        if (body?.uuid) this.px.setUUID(body.uuid);
        const pxhd = this.cookieJar.toJSON().cookies.find((c) => c.key === '_pxhd');
        if (pxhd) {
            this.px.setpxhd(pxhd.value);
        }

        const wasBlocked = this.wasCaptchaBlocked(response);

        if (wasBlocked) {
            const url = this.getRequestURLFromResponse(response);

            await this.solvePXCookie('hold', url);
            return RetryMessage.Blocked;
        }

        return RetryMessage.Unknown;
    }

    /**
     *
     * @param response to detect a block in
     * @returns boolean indicating whether the response is a block
     */
    private wasCaptchaBlocked(response: Response<any>) {
        return response?.statusCode === 412 || response?.body?.includes?.('blocked');
    }

    /**
     *
     * @param response to get the request url of
     * @returns url used in the request
     */
    private getRequestURLFromResponse(response: Response<any>) {
        return response?.request?.requestUrl;
    }

    /**
     *
     * @param key of a cookie to get
     * @returns the first cookie found with that key
     */
    private getCookie(key: string) {
        return this.cookieJar.toJSON().cookies.find((c) => c.key === key);
    }

    /**
     * sets a new cookie in the cookie jar with key and value provided
     * @param key
     * @param value
     */
    protected async setCookie(key: string, value: string, domain?: string) {
        const cookieDomain = domain ?? this.url.host;
        await this.cookieJar.setCookie(`${key}=${value};`, cookieDomain);
    }

    private async reset() {
        this.rotateProxy();
        this.px.reset();
        await this.getUserAgent();
        await this.solvePXCookie('normal', this.url.href);
    }

    private pxCookiePromise?: { promise: Promise<void>; state: 'pending' | 'fulfilled'; resolve: () => void };
    /**
     *
     * @param type of cookie to solve
     * @returns a promise that the px cookie has been solved and set
     * if a px cookie is already being solved, a promise for the px cookie already being solved will be returned
     */
    private async solvePXCookie(type: 'normal' | 'hold', blockURL?: string) {
        if (!blockURL) {
            blockURL = this.url.href;
        }
        // if (this.pxCookiePromise?.state === 'pending') {
        //     Env.isDev && this.updateStatus('px cookie pending', TaskStatusColor.Info);
        //     return this.pxCookiePromise.promise!;
        // } else {
        // let resolve;
        // const promise = new Promise<void>((res, reject) => {
        //     resolve = res;
        // });
        // this.pxCookiePromise = { resolve, promise, state: 'pending' };

        const step = 'Grabbing PX cookie';
        let attempts = 0;
        let maxAttempts = 3;
        while (!this.shouldStopTask && attempts < maxAttempts) {
            if (attempts > 0) this.updateStatus(`Failed ${step} retrying...`);
            attempts += 1;
            let response;
            try {
                if (type === 'normal') {
                    response = await this.px.solveNormal(blockURL, this.state.site.userAgent);
                } else {
                    response = await this.px.solveHold(blockURL, this.state.site.userAgent);
                }
            } catch (e) {
                this.handleConnectionError(e, undefined, step);
                if (e instanceof TimeoutError) {
                    this.px = new HawkPerimeterX(SupportedSite.Walmart, this.httpClient);
                    return this.reset();
                }
                continue;
            }

            if (response.success) {
                const cookie = response?.cookies?.['_px3'];
                if (cookie) await this.setCookie('_px3', cookie, this.url.origin);
                const cookie2 = response?.cookies?.['_pxde'];
                if (cookie2) await this.setCookie('_pxde', cookie2, this.url.origin);
                // this.pxCookiePromise.resolve();
                // this.pxCookiePromise.state = 'fulfilled';
                return;
            }
        }
        this.updateStatus(RetryMessage.ProxyBanned, TaskStatusColor.Warning);
        return this.reset();
    }

    /**
     * @param URL to solve the recaptcha for
     * @returns a captcha token
     */
    private async solveRecaptcha(URL: string) {
        const captchaTask: CaptchaTask = {
            taskID: this.task.id,
            type: CaptchaType.RecaptchaV2,
            URL,
            siteKey: '6Lc8-RIaAAAAAPWSm2FVTyBg-Zkz2UjsWWfrkgYN',
            minScore: 0.7,
            pageAction: 'handleCaptcha',
            proxy: this.proxy,
        };
        const gCaptchaToken = (await this.solveCaptchaTask(captchaTask)) as string;
        return gCaptchaToken;
    }
}
