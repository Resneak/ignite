import { JSONParseSafely, sleep } from '../../../../lib/helpers';
import { TaskEvent, TaskStatusColor } from '../../../../lib/models/taskUpdate';
import BotTask, { BotTaskProperties } from '../../models/tasks/botTask';
import { RetryExecutor, StopTask } from '../../../../lib/errors';
import AmazonManager from './amazonManager';

const { request } = require('../../../../http-client');

import getPuppeteer from '../../utils/puppeteer';

import got from 'got';
import * as cheerio from 'cheerio';

import { LaunchOptions } from 'puppeteer';
import Product from '../../../../lib/models/product';

const encodeQueries = (obj: object): string => {
    const queries: string[] = [];
    for (let i in obj) queries.push(`${i}=${obj[i]}`);
    return queries.join('&');
};

export default class Amazon extends BotTask {
    private readonly requestLogin: boolean = false;
    private tries: {
        login: number;
        atc: number;
        getCheckout: number;
        placeOrder: number;
    } = {
        login: 0,
        atc: 0,
        getCheckout: 0,
        placeOrder: 0,
    };

    private manager: AmazonManager;

    private host: string;

    private metadata: { email: string; password: string } = { email: '', password: '' };

    private csrf?: string;
    private sessionId?: string;
    private offerId?: string;
    private asin?: string;
    private merchantId?: string;

    private checkoutInputs: object = {};
    private emailInputs: object = {};
    private passwordInputs: object = {};

    private checkoutPayload: object = {};

    private sku: string = '';
    private account: {
        email: string;
        password: string;
    };

    protected *execute() {
        this.manager.monitorProduct(this.task.product);
        yield this.browserLogin();
        yield this.awaitForStock();
        yield this.addToCart();
        yield this.placeOrder();
    }

    constructor(botTaskProps: BotTaskProperties) {
        super(botTaskProps);

        this.host = `www.${this.task.websiteName}.com`;

        this.offerId = this.task.product.id.split(':')[1];
        this.sku = this.task.product.id.split(':')[0];
        this.task.product = new Product({
            ...this.task.product,
            id: this.sku,
        });

        this.manager = AmazonManager.getInstance();

        this.task.product.name = this.sku;

        this.account = {
            email: this.task.username || '',
            password: this.task.password || '',
        };
    }

    private async awaitForStock() {
        const { supported, stockEvent } = await this.manager.awaitMonitor(this.task.product);

        return;
    }

    private checkOrderPayload(): string[] {
        this.checkoutPayload = {
            csrfToken: this.checkoutInputs?.['csrfToken'],
            fromAnywhere: '0',
            redirectOnSuccess: '0',
            purchaseTotal: this.checkoutInputs?.['purchaseTotal'],
            purchaseTotalCurrency: this.checkoutInputs?.['purchaseTotalCurrency'],
            purchaseID: this.checkoutInputs?.['purchaseID'],
            purchaseCustomerId: this.checkoutInputs?.['purchaseCustomerId'],
            useCtb: '1',
            scopeId: this.checkoutInputs?.['scopeId'],
            isQuantityInvariant: '',
            'promiseTime-0': this.checkoutInputs?.['promiseTime-0'],
            'promiseAsin-0': this.checkoutInputs?.['promiseAsin-0'],
            selectedPaymentPaystationId: this.checkoutInputs?.['selectedPaymentPaystationId'],
            javaEnabled: 'false',
            language: 'fr-FR',
            screenColorDepth: '24',
            screenHeight: '1080',
            screenWidth: '1920',
            timeZone: '-120',
            purchaseLevelMessageIds: 'nullPromotion',
            submitFromSPC: '1',
            pickupType: '',
            searchCriterion: '',
            storeZip: '',
            storeZip2: '',
            searchLockerFormAction: '',
            claimCode: '',
            primeMembershipTestData: 'NULL',
            fasttrackExpiration: this.checkoutInputs?.['fasttrackExpiration'],
            countdownThreshold: this.checkoutInputs?.['countdownThreshold'],
            countdownId: '0',
            showSimplifiedCountdown: '0',
            'gift-message-text': 'Grettings from the Ignite team',
            dupOrderCheckArgs: this.checkoutInputs?.['dupOrderCheckArgs'],
            order0: this.checkoutInputs?.['order0'],
            previousshippingofferingid0: this.checkoutInputs?.['previousshippingofferingid0'],
            previousguaranteetype0: this.checkoutInputs?.['previousguaranteetype0'],
            previousissss0: this.checkoutInputs?.['previousissss0'],
            previousshippriority0: this.checkoutInputs?.['previousshippriority0'],
            lineitemids0: this.checkoutInputs?.['lineitemids0'],
            previousShippingSpeed0: this.checkoutInputs?.['previousShippingSpeed0'],
            currentshipsplitpreference: this.checkoutInputs?.['currentshipsplitpreference'],
            'shippriority.0.shipWhenComplete': this.checkoutInputs?.['shippriority.0.shipWhenComplete'],
            groupcount: this.checkoutInputs?.['groupcount'],
            snsUpsellTotalCount: '',
            onmlUpsellSuppressedCount: '',
            vasClaimBasedModel: '0',
            isfirsttimecustomer: '0',
            isTFXEligible: '',
            isFxEnabled: '',
            isFXTncShown: '',
            hasWorkingJavascript: '1',
            placeYourOrder1: '1',
        };
        const res: any[] = [];
        for (let i in this.checkoutPayload)
            if (this.checkoutPayload[i] !== '' && (!this.checkoutPayload[i] || this.checkoutPayload[i] === 'undefined')) res.push(i);
        return res;
    }

    private async browserLogin() {
        this.setStatus('Awaiting browser login');

        const loginQueries = encodeQueries({
            _encoding: 'UTF8',
            'openid.assoc_handle': 'usflex',
            'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
            'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
            'openid.mode': 'checkid_setup',
            'openid.ns': 'http://specs.openid.net/auth/2.0',
            'openid.ns.pape': 'http://specs.openid.net/extensions/pape/1.0',
            'openid.pape.max_auth_age': '0',
            'openid.return_to': `https://${this.host}/ref=nav_logo`,
        });
        const puppeteer = getPuppeteer(true);
        const browser = await puppeteer.launch({
            headless: false,
            ignoreHTTPSErrors: true,
            args: [`--window-size=600,600`],
        } as LaunchOptions);
        const page = await browser.newPage();

        let cookies: any[] = [];
        let err: boolean = false;

        await page.goto(`https://${this.host}/ap/signin?${loginQueries}`);

        await page.waitForSelector('#ap_email');
        await page.type('#ap_email', this.account.email);
        await page.click('#continue');
        await page.waitForSelector('#ap_password');
        await page.type('#ap_password', this.account.password);
        await page.click('#signInSubmit');

        while (!page.isClosed() && browser.isConnected() && !err) {
            try {
                cookies = await page.cookies();
            } catch (e) {
                err = true;
            }
            await this.pause();
        }
        cookies.forEach((cookie) => {
            if (cookie.name === 'session-id') this.sessionId = cookie.value;
            this.cookieJar.setCookie(`${cookie.name}=${cookie.value};`, `https://${this.host}/`);
        });
    }

    private async getMetadata() {
        const qs = encodeQueries({
            email: this.account.email,
            passwordLength: this.account.password.length,
            apiKey: '6c6855e5-a6d5-4c03-a568-73a414ee41b6',
        });
        const { body } = await got.post(`https://botbypass.com/metadata_api?${qs}`, { throwHttpErrors: false });
        this.metadata = JSONParseSafely(body)?.metadata1;
    }

    private async getLoginPage() {
        const loginQueries = encodeQueries({
            _encoding: 'UTF8',
            ie: 'UTF8',
            'openid.assoc_handle': 'amzn_smile',
            'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
            'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
            'openid.mode': 'checkid_setup',
            'openid.ns': 'http://specs.openid.net/auth/2.0',
            'openid.ns.pape': 'http://specs.openid.net/extensions/pape/1.0',
            'openid.pape.max_auth_age': '0',
            'openid.return_to': 'https://smile.amazon.com/gp/charity/homepage.html?ie=UTF8&newts=1&orig=%2F',
        });
        let response: any;
        this.updateStatus('Init login', TaskStatusColor.Neutral);
        try {
            response = await got.get(`https://smile.amazon.com/ap/signin/ref=smi_ge2_ul_si_rl?${loginQueries}`, {
                headers: {
                    Connection: 'keep-alive',
                    'Cache-Control': 'max-age=0',
                    rtt: '50',
                    downlink: '10',
                    ect: '4g',
                    'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                    'sec-ch-ua-mobile': '?0',
                    'Upgrade-Insecure-Requests': '1',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.106 Safari/537.36',
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                    'Sec-Fetch-Site': 'same-origin',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-User': '?1',
                    'Sec-Fetch-Dest': 'document',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
                },
                agent: { https: this.proxy?.getHttpsProxyAgent() },
                cookieJar: this.cookieJar,
            });
        } catch (e) {
            console.log(e.message);
            throw new RetryExecutor(this.getLoginPage.bind(this), `Unknown Error`);
        }

        if (response.statusCode !== 200) {
            throw new RetryExecutor(this.getLoginPage.bind(this), `Failed to get login page (${response.statusCode})`);
        }

        try {
            const $ = cheerio.load(response.body);
            $('input').each((x, input) => {
                const name = $(input).attr('name');
                const value = $(input).attr('value');
                this.emailInputs[name as string] = value;
            });
        } catch (ex) {
            throw new RetryExecutor(this.getLoginPage.bind(this), `Failed to parse login page`);
        }
    }

    private async submitEmail() {
        let response: any;
        this.updateStatus('Logging in #1', TaskStatusColor.Neutral);
        try {
            response = await request({
                url: `https://smile.amazon.com/ap/signin`,
                method: 'POST',
                body: encodeQueries({
                    appActionToken: this.emailInputs['appActionToken'],
                    appAction: this.emailInputs['appAction'],
                    subPageType: this.emailInputs['subPageType'],
                    'openid.return_to': this.emailInputs['openid.return_to'],
                    prevRID: this.emailInputs['prevRID'],
                    workflowState: this.emailInputs['workflowState'],
                    email: this.account.email,
                    password: '',
                    create: '0',
                    metadata1: this.metadata.email,
                }),
                headers: {
                    Host: this.host,
                    Connection: 'keep-alive',
                    'Cache-Control': 'max-age=0',
                    rtt: '50',
                    downlink: '10',
                    ect: '4g',
                    'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                    'sec-ch-ua-mobile': '?0',
                    'Upgrade-Insecure-Requests': '1',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.106 Safari/537.36',
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                    'Sec-Fetch-Site': 'same-origin',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-User': '?1',
                    'Sec-Fetch-Dest': 'document',
                    Referer: `https://${this.host}/ap/signin`,
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
                },
                jar: this.cookieJar,
            });
        } catch (e) {
            throw new RetryExecutor(this.submitEmail.bind(this), `Unknown Error`);
        }

        if (response.statusCode !== 200) {
            throw new RetryExecutor(this.submitEmail.bind(this), `Failed to login #1 (${response.statusCode})`);
        }
        try {
            const $ = cheerio.load(response.body);
            $('input').each((x, input) => {
                const name = $(input).attr('name');
                const value = $(input).attr('value');
                this.passwordInputs[name as string] = value;
            });
        } catch (ex) {
            throw new RetryExecutor(this.submitEmail.bind(this), `Failed to parse login page`);
        }
    }

    private async completeLogin() {
        let response: any;
        this.updateStatus('Logging in #2', TaskStatusColor.Neutral);
        const body = encodeQueries({
            appActionToken: this.passwordInputs['appActionToken'],
            appAction: this.passwordInputs['appAction'],
            metadata1: this.metadata.password,
            'openid.return_to': this.passwordInputs['openid.return_to'],
            prevRID: this.passwordInputs['prevRID'],
            workflowState: this.passwordInputs['workflowState'],
            email: this.account.email,
            password: this.account.password,
        });
        try {
            response = await request({
                url: `https://smile.amazon.com/ap/signin`,
                method: 'POST',
                body,
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                    'accept-encoding': 'gzip, deflate, br',
                    'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
                    'cache-control': 'no-cache',
                    'content-length': body.length,
                    'content-type': 'application/x-www-form-urlencoded',
                    downlink: '10',
                    ect: '4g',
                    origin: `https://${this.host}`,
                    pragma: 'no-cache',
                    referer: `https://${this.host}/ap/signin`,
                    rtt: '50',
                    'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-fetch-dest': 'document',
                    'sec-fetch-mode': 'navigate',
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-user': '?1',
                    'upgrade-insecure-requests': '1',
                    'user-agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
                },
                jar: this.cookieJar,
            });
        } catch (e) {
            throw new RetryExecutor(this.completeLogin.bind(this), `Unknown Error`);
        }
        switch (response.statusCode) {
            case 429:
                this.tries.login++;
                if (this.tries.login > 5) {
                    throw new StopTask('Ratelimited, stopping');
                }
                this.rotateProxy();
                throw new RetryExecutor(this.completeLogin.bind(this), `Ratelimited, Retrying`);
            case 503:
                this.rotateProxy();
                throw new RetryExecutor(this.completeLogin.bind(this), `Proxy soft ban, Retrying`);
            case 302:
                if (!response.headers.location?.includes('?ref_=nav_signin&')) {
                    this.tries.login++;
                    if (this.tries.login > 5) {
                        throw new StopTask(`Failed to login, Stopping`);
                    }
                    throw new RetryExecutor(this.completeLogin.bind(this), `Unable to login (Bad Redirect), Retrying`);
                } else return this.updateStatus(`Logged in ${this.account.email}`, TaskStatusColor.Info);
            case 201:
            case 200:
                this.tries.login++;
                if (this.tries.login > 5) {
                    throw new StopTask(`Failed to login, Stopping`);
                }
                throw new RetryExecutor(this.completeLogin.bind(this), `Unable to login (Challenge), Retrying`);
            default:
                this.tries.login++;
                if (this.tries.login > 5) {
                    throw new StopTask(`Failed to login, Stopping`);
                }
                throw new RetryExecutor(this.addToCart.bind(this), `Unable to login (${response.statusCode}), Retrying`);
        }
    }

    private async initTurbo() {
        let response: any;
        this.updateStatus('Init Checkout', TaskStatusColor.Neutral);
        try {
            response = await this.httpClient.post(
                `https://www.amazon.com/checkout/turbo-initiate?ref_=dp_start-bbf_1_glance_buyNow_2-1&referrer=detail&pipelineType=turbo&clientId=retailwebsite&weblab=RCX_CHECKOUT_TURBO_DESKTOP_NONPRIME_87784&temporaryAddToCart=1`,
                {
                    form: {
                        isAsync: '1',
                        addressID: 'add-new',
                        'asin.1': this.asin,
                        'offerListing.1': this.offerId,
                        'quantity.1': '1',
                    },
                    headers: {
                        accept: '*/*',
                        'accept-encoding': 'gzip, deflate, br',
                        'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
                        'cache-control': 'no-cache',
                        'content-type': 'application/x-www-form-urlencoded',
                        downlink: '10',
                        ect: '4g',
                        origin: 'https://www.amazon.com',
                        pragma: 'no-cache',
                        referer: 'https://www.amazon.com/gp/product/B08N68GBQD/ref=ewc_pr_img_1?smid=A26PVB3960EU85&psc=1',
                        rtt: '50',
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'sec-ch-ua-mobile': '?0',
                        'sec-fetch-dest': 'empty',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-site': 'same-origin',
                        'user-agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'x-amz-checkout-csrf-token': this.sessionId,
                        'x-amz-checkout-entry-referer-url': 'https://www.amazon.com/gp/product/B08N68GBQD/ref=ewc_pr_img_1?smid=A26PVB3960EU85&psc=1',
                        'x-amz-support-custom-signin': '1',
                        'x-amz-turbo-checkout-dp-url': 'https://www.amazon.com/gp/product/B08N68GBQD/ref=ewc_pr_img_1?smid=A26PVB3960EU85&psc=1',
                        'x-requested-with': 'XMLHttpRequest',
                    },
                    agent: { https: this.proxy?.getHttpsProxyAgent() },
                    cookieJar: this.cookieJar,
                }
            );
        } catch (e) {
            throw new RetryExecutor(this.addToCart.bind(this), `Unknown Error`);
        }

        switch (response.statusCode) {
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.addToCart.bind(this), `Ratelimited, Retrying`);
            case 503:
                this.rotateProxy();
                throw new RetryExecutor(this.addToCart.bind(this), `Proxy soft ban, Retrying`);
            case 201:
            case 200:
            case 204:
                this.setStatus('Turbo init done');
                break;
            default:
                this.tries.atc++;
                if (this.tries.atc > 5) {
                    throw new StopTask(`Failed to add to cart, Stopping`);
                }
                throw new RetryExecutor(this.addToCart.bind(this), `Unable to cart (${response.statusCode}), Retrying`);
        }
    }

    private async addToCart() {
        let response: any;
        this.updateStatus('Adding to cart', TaskStatusColor.Neutral);
        try {
            response = await got.post(`https://${this.host}/gp/product/handle-buy-box/ref=dp_start-bbf_1_glance`, {
                form: {
                    CSRF: this.csrf,
                    offerListingID: this.offerId,
                    'session-id': this.sessionId,
                    ASIN: this.asin,
                    isMerchantExclusive: 0,
                    merchantID: this.merchantId,
                    isAddon: 0,
                    nodeID: '',
                    sellingCustomerID: '',
                    qid: Date.now(),
                    sr: '1-5',
                    storeID: '',
                    tagActionCode: '',
                    viewID: 'glance',
                    rebateId: '',
                    ctaDeviceType: 'desktop',
                    ctaPageType: 'detail',
                    usePrimeHandler: '0',
                    rsid: this.sessionId,
                    sourceCustomerOrgListID: '',
                    sourceCustomerOrgListItemID: '',
                    wlPopCommand: '',
                    quantity: 1,
                    'submit.buy-now': '',
                    'dropdown-selection': 'add-new',
                    'dropdown-selection-ubb': 'add-new',
                    itemCount: 1,
                },
                headers: {
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
                    'Cache-Control': 'max-age=0',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Connection: 'keep-alive',
                    downlink: '10',
                    ect: '4g',
                    Host: this.host,
                    rtt: '400',
                    'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                    'sec-ch-ua-mobile': '?0',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-origin',
                    'Upgrade-Insecure-Requests': '1',
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.106 Safari/537.36',
                },
                agent: { https: this.proxy?.getHttpsProxyAgent() },
                cookieJar: this.cookieJar,
            });
        } catch (e) {
            console.log(e.message);
            throw new RetryExecutor(this.addToCart.bind(this), `Unknown Error`);
        }

        switch (response.statusCode) {
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.addToCart.bind(this), `Ratelimited, Retrying`);
            case 503:
                this.rotateProxy();
                throw new RetryExecutor(this.addToCart.bind(this), `Proxy soft ban, Retrying`);
            case 201:
            case 200:
                try {
                    const $ = cheerio.load(response.body);
                    this.task.product.name = $('.asin-title')?.first()?.text();
                    $('img').each((_, img) => {
                        if ($(img).attr('src')?.includes('150')) this.task.product.image = $(img).attr('src');
                    });
                    this.task.product.price = $('.a-color-price.a-size-medium.a-text-right.grand-total-price.aok-nowrap.a-text-bold.a-nowrap')
                        ?.first()
                        ?.text();
                    $('input').each((_, input) => {
                        const name = $(input).attr('name');
                        const value = $(input).attr('value');
                        this.checkoutInputs[name as string] = value;
                    });
                } catch (ex) {}
                const payloadCheck = this.checkOrderPayload();
                if (payloadCheck.length > 0) {
                    const $ = cheerio.load(response?.body);
                    let isPaymentSet = true;
                    $('h1').each((_, h1) => {
                        const text = $(h1).text();
                        if (text.includes('Sign-In')) throw new StopTask('Login session expired, Stopping');
                        switch (text) {
                            case 'Select a payment method':
                                isPaymentSet = false;
                                break;
                            case 'Choose where to ship each item':
                                throw new StopTask('No default address set, Stopping');
                        }
                    });
                    if (!isPaymentSet) {
                        this.setStatus('Default payment not applied, setting payment and retrying', TaskStatusColor.Info);
                        await this.initTurbo();
                        throw new RetryExecutor(this.addToCart.bind(this));
                    }

                    let failedToCart = false;

                    $('h2').each((_, h2) => {
                        if ($(h2).text().includes('Your Amazon Cart is empty')) {
                            failedToCart = true;
                        }
                    });

                    if (failedToCart) {
                        this.setStatus(`${this.sku} is currently OOS, waiting for cloud monitor ...`, TaskStatusColor.Warning);
                        const { supported, stockEvent } = await this.manager.awaitMonitor(this.task.product);
                        const { offerID, inStock } = stockEvent!;
                        this.offerId = offerID;
                        throw new RetryExecutor(this.addToCart.bind(this), `Cloud monitor found stock, resuming task`);
                    }

                    const errorMessage =
                        payloadCheck.length > 3
                            ? 'Login session expired, Retrying'
                            : `Unable to fill checkout payload (${payloadCheck.join(', ')}), Retrying`;
                    this.tries.atc++;
                    if (this.tries.atc > 5) {
                        throw new StopTask(`Failed to add to cart (Session Error), Stopping`);
                    }
                    //  Env.isDev && console.log(response.body)
                    throw new RetryExecutor(this.addToCart.bind(this), errorMessage);
                }
                this.setStatus(`Added ${this.task.product.name} to cart !`, TaskStatusColor.Cart, TaskEvent.Carted);
                break;
            default:
                this.tries.atc++;
                if (this.tries.atc > 5) {
                    throw new StopTask(`Failed to add to cart, Stopping`);
                }
                throw new RetryExecutor(this.addToCart.bind(this), `Unable to cart (${response.statusCode}), Retrying`);
        }
    }

    private async placeOrder() {
        let response: any;
        this.updateStatus('Placing order', TaskStatusColor.Neutral);
        try {
            response = await got.post(
                `https://${this.host}/gp/buy/spc/handlers/static-submit-decoupled.html/ref=ox_spc_place_order?ie=UTF8&hasWorkingJavascript=`,
                {
                    form: this.checkoutPayload,
                    headers: {
                        Host: this.host,
                        Connection: 'keep-alive',
                        'Cache-Control': 'max-age=0',
                        rtt: '50',
                        downlink: '10',
                        ect: '4g',
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'sec-ch-ua-mobile': '?0',
                        'Upgrade-Insecure-Requests': '1',
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.106 Safari/537.36',
                        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                        'Sec-Fetch-Site': 'same-origin',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-User': '?1',
                        'Sec-Fetch-Dest': 'document',
                        Referer: `https://${this.host}/gp/buy/spc/handlers/display.html?hasWorkingJavascript=1`,
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
                    },
                    agent: { https: this.proxy?.getHttpsProxyAgent() },
                    cookieJar: this.cookieJar,
                }
            );
        } catch (e) {
            throw new RetryExecutor(this.placeOrder.bind(this), `Unknown Error`);
        }

        switch (response.statusCode) {
            case 429:
                this.tries.placeOrder++;
                if (this.tries.placeOrder > 5) {
                    throw new StopTask('Ratelimited, stopping');
                }
                this.rotateProxy();
                throw new RetryExecutor(this.placeOrder.bind(this), `Ratelimited, Retrying`);
            case 503:
                this.rotateProxy();
                throw new RetryExecutor(this.placeOrder.bind(this), `Proxy soft ban, Retrying`);
            case 201:
            case 200:
                if (response?.body?.includes('thankyou'))
                    this.setStatus('Successfully checked out, check email !', TaskStatusColor.Success, TaskEvent.CheckoutSuccess);
                else {
                    this.setStatus('Checkout failure', TaskStatusColor.Error, TaskEvent.CheckoutDecline);
                }
                break;
            default:
                this.tries.placeOrder++;
                if (this.tries.placeOrder > 5) {
                    throw new StopTask(`Failed to place order, Stopping`);
                }
                throw new RetryExecutor(this.addToCart.bind(this), `Unable to place order (${response.statusCode}), Retrying`);
        }
    }
}
