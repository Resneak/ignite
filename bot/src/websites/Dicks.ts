import { JSONParseSafely, sleep } from '../../../lib/helpers';
import { TaskEvent, TaskStatusColor } from '../../../lib/models/taskUpdate';
import BotTask, { BotTaskProperties } from '../models/tasks/botTask';
import { RetryExecutor, StopTask } from '../../../lib/errors';
import { cyberSourceEncryptV1 } from '../utils/cryptography/encryptDSG';

import { CookieJar } from 'tough-cookie';
import { request } from '../../../http-client';
import Product from '../../../lib/models/product';

const akamaiCookies = ['_abck', 'bm_sv', 'bm_mi', 'ak_bmsc', 'bm_sz'];
const btoa = (text: string) => Buffer.from(text).toString('base64');

export default class Dicks extends BotTask {
    private readonly userAgent: string =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36';

    private host: string;

    private checkoutId?: string;
    private encryptionKey?: object;
    private token?: object;

    private sku: string;

    private currentAbck?: string;
    private sensorData?: string;

    protected *execute() {
        yield this.handleAkamai();
        yield this.addToCart();
        yield this.getCheckout();
        yield this.submitShipping1();
        yield this.submitShipping();
        yield this.getPublicKey();
        yield this.getToken();
        yield this.submitCard();
        yield this.placeOrder();
    }

    constructor(botTaskProps: BotTaskProperties) {
        super(botTaskProps);

        this.host = `www.${this.task.websiteName}.com`;

        this.sku = this.task.product.id;
    }

    private async handleAkamai() {
        const cookies = this.cookieJar.getCookiesSync(`https://${this.host}/`);
        const cleanJar = new CookieJar();
        cookies
            .filter((x) => !akamaiCookies.includes(x.key))
            .forEach((cookie) => cleanJar.setCookie(`${cookie.key}=${cookie.value};`, `https://${this.host}/`));
        this.cookieJar = cleanJar;
        this.setStatus(`Generating akamai ...`);
        await this.getInvalidAbck();
        for (let i = 0; i < 3; i++) {
            await this.getSensor();
            await this.postSensor();
        }
        if (this.currentAbck?.includes('||')) {
            this.updateStatus('Akamai challenge detected, solving ...', TaskStatusColor.Warning);
            await this.handleAkamai.bind(this);
        }
        this.setStatus('Generated akamai', TaskStatusColor.Info);
    }

    private async getInvalidAbck() {
        const { headers } = await request({
            url: 'https://www.dickssportinggoods.com/0J9hTh/745k9/VTbJv/BQ/3Yz3Q4aQ9t/c2JaKg/Wx4jZnA/OEwY',
            method: 'GET',
            headers: {
                connection: 'keep-alive',
                'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                'sec-ch-ua-mobile': '?0',
                'user-agent': this.userAgent,
                'content-Type': 'text/plain;charset=UTF-8',
                accept: '*/*',
                origin: `https://${this.host}`,
                'sec-fetch-site': 'same-origin',
                'sec-fetch-mode': 'cors',
                'sec-fetch-dest': 'empty',
                referer: `https://${this.host}/login?target=/myaccount/`,
                'accept-encoding': 'gzip, deflate, br',
                'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
            },
            jar: this.cookieJar,
            proxy: this.proxy?.getUrl(),
        });
        headers['set-cookie']?.forEach((cookie) => {
            const key = cookie.split('=')[0];
            const value = cookie.split(`${key}=`)[1]?.split(';')[0];
            if (key === '_abck') this.currentAbck = value;
        });
    }

    private async getSensor() {
        const { body } = await request({
            url: 'https://ak01-eu.hwkapi.com/akamai/generate',
            body: JSON.stringify({
                site: this.host,
                abck: this.currentAbck,
                type: 'sensor',
                events: '1,1',
            }),
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': '022921a2-ae7a-11eb-8529-0242ac130003',
                'X-Sec': 'low',
            },
        });
        this.sensorData = body.split('*')[0];
    }

    private async postSensor() {
        const json = JSON.stringify({ sensor_data: this.sensorData });
        const { headers } = await request({
            url: 'https://www.dickssportinggoods.com/0J9hTh/745k9/VTbJv/BQ/3Yz3Q4aQ9t/c2JaKg/Wx4jZnA/OEwY',
            method: 'POST',
            body: json,
            headers: {
                connection: 'keep-alive',
                'content-Length': json.length,
                'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                'sec-ch-ua-mobile': '?0',
                'user-agent': this.userAgent,
                'content-Type': 'text/plain;charset=UTF-8',
                accept: '*/*',
                origin: `https://${this.host}`,
                'sec-fetch-site': 'same-origin',
                'sec-fetch-mode': 'cors',
                'sec-fetch-dest': 'empty',
                referer: `https://${this.host}/login?target=/myaccount/`,
                'accept-encoding': 'gzip, deflate, br',
                'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
            },
            jar: this.cookieJar,
            proxy: this.proxy?.getUrl(),
        });
        headers['set-cookie']?.forEach((cookie) => {
            const key = cookie.split('=')[0];
            const value = cookie.split(`${key}=`)[1]?.split(';')[0];
            if (key === '_abck') this.currentAbck = value;
        });
    }

    private async getIp() {
        const { body } = await this.httpClient.get('https://api.ipify.org', { agent: { https: this.proxy?.getHttpsProxyAgent() } });
        console.log(body);
    }

    private async addToCart() {
        let response: any;
        this.updateStatus('Adding to cart', TaskStatusColor.Neutral);
        try {
            response = await this.httpClient.put(
                `https://www.dickssportinggoods.com/api/v1/carts/contents/${this.sku}?qty=${this.task.atcQuantity}`,
                {
                    headers: {
                        'content-length': '0',
                        dnt: '1',
                        'sec-ch-ua-mobile': '?0',
                        'user-agent': this.userAgent,
                        accept: '*/*',
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        origin: 'https://www.dickssportinggoods.com',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        referer:
                            'https://www.dickssportinggoods.com/p/birkenstock-womens-arizona-essentials-eva-sandals-16birwrznssntlsvpfot/16birwrznssntlsvpfot?recid=home_PageElement_home3_rr_2_19280_&rrec=true',
                        'accept-encoding': 'gzip, deflate, br',
                        'accept-language': 'en-US,en;q=0.9',
                    },
                    agent: { https: this.proxy?.getHttpsProxyAgent() },
                    cookieJar: this.cookieJar,
                }
            );
        } catch (e) {
            this.handleConnectionError(e, this.addToCart.bind(this), 'Submitting shipping');
            return;
        }
        switch (response.statusCode) {
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.addToCart.bind(this), `Ratelimited, Rotating proxy and retrying`);
            case 201:
            case 200:
                this.setStatus('Added to cart !', TaskStatusColor.Cart, TaskEvent.Carted);
                break;
            default:
                throw new RetryExecutor(this.addToCart.bind(this), `Unable to add to cart (${response.statusCode}), Retrying`);
        }
    }

    private async getCheckout() {
        let response: any;
        this.updateStatus('Getting checkout session', TaskStatusColor.Neutral);
        try {
            response = await this.httpClient.post('https://www.dickssportinggoods.com/api/v1/checkouts/order-summary', {
                json: { headers: { normalizedNames: {}, lazyUpdate: null }, withCredentials: true },
                headers: {
                    dnt: '1',
                    'sec-ch-ua-mobile': '?0',
                    'user-agent': this.userAgent,
                    accept: 'application/json, text/plain, */*',
                    'content-type': 'application/json',
                    'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                    origin: 'https://www.dickssportinggoods.com',
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    referer:
                        'https://www.dickssportinggoods.com/p/birkenstock-womens-arizona-essentials-eva-sandals-16birwrznssntlsvpfot/16birwrznssntlsvpfot?recid=home_PageElement_home3_rr_2_19280_&rrec=true',
                    'accept-encoding': 'gzip, deflate, br',
                    'accept-language': 'en-US,en;q=0.9',
                },
                agent: { https: this.proxy?.getHttpsProxyAgent() },
                cookieJar: this.cookieJar,
            });
        } catch (e) {
            this.handleConnectionError(e, this.getCheckout.bind(this), 'Getting checkout session');
            return;
        }
        switch (response.statusCode) {
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.getCheckout.bind(this), `Ratelimited, Rotating proxy and retrying`);
            case 201:
            case 200:
                const checkoutObj = JSONParseSafely(response?.body);
                this.checkoutId = checkoutObj?.checkout_key;
                this.task.product = new Product({
                    ...this.task.product,
                    name: checkoutObj?.cart?.items?.[0]?.description?.[0],
                    price: checkoutObj?.pricing?.total,
                    image: `https:${checkoutObj?.cart?.items?.[0]?.images[0]}`,
                });
                break;
            default:
                throw new RetryExecutor(this.getCheckout.bind(this), `Unable to get checkout session (${response.statusCode}), Retrying`);
        }
    }

    private async submitShipping1() {
        let response: any;
        this.updateStatus('Submitting Shipping Round 1', TaskStatusColor.Neutral);
        try {
            response = await this.httpClient.put(`https://www.dickssportinggoods.com/api/v1/checkouts/${this.checkoutId}/addresses`, {
                json: {
                    first_name: this.profile.shippingAddress.firstName,
                    last_name: this.profile.shippingAddress.lastName,
                    address: this.profile.shippingAddress.address,
                    city: this.profile.shippingAddress.city,
                    state: this.profile.shippingAddress.stateCode,
                    zipcode: this.profile.shippingAddress.zip,
                    country: this.profile.shippingAddress.country,
                    phone: this.profile.shippingAddress.phone,
                    email: this.profile.shippingAddress.email,
                },
                headers: {
                    dnt: '1',
                    'sec-ch-ua-mobile': '?0',
                    'user-agent': this.userAgent,
                    accept: 'application/json, text/plain, */*',
                    'content-type': 'application/json',
                    'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                    origin: 'https://www.dickssportinggoods.com',
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    referer: 'https://www.dickssportinggoods.com/DSGBillingAddressView',
                    'accept-encoding': 'gzip, deflate, br',
                    'accept-language': 'en-US,en;q=0.9',
                },
                agent: { https: this.proxy?.getHttpsProxyAgent() },
                cookieJar: this.cookieJar,
            });
        } catch (e) {
            this.handleConnectionError(e, this.getCheckout.bind(this), 'Getting checkout session');
            return;
        }

        switch (response.statusCode) {
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.getCheckout.bind(this), `Ratelimited, Rotating proxy and retrying`);
            case 201:
            case 200:
                console.log(response.body);
                break;
            default:
                throw new RetryExecutor(this.getCheckout.bind(this), `Unable to get checkout session (${response.statusCode}), Retrying`);
        }
    }

    private async submitShipping() {
        let response: any;
        this.updateStatus('Submitting Shipping Round 2', TaskStatusColor.Neutral);
        try {
            response = await this.httpClient.post(`https://www.dickssportinggoods.com/api/v1/checkouts/${this.checkoutId}/addresses`, {
                json: {
                    first_name: this.profile.shippingAddress.firstName,
                    last_name: this.profile.shippingAddress.lastName,
                    address: this.profile.shippingAddress.address,
                    city: this.profile.shippingAddress.city,
                    state: this.profile.shippingAddress.stateCode,
                    zipcode: this.profile.shippingAddress.zip,
                    country: this.profile.shippingAddress.country,
                    phone: this.profile.shippingAddress.phone,
                    email: this.profile.shippingAddress.email,
                },
                headers: {
                    dnt: '1',
                    'sec-ch-ua-mobile': '?0',
                    'user-agent': this.userAgent,
                    accept: 'application/json, text/plain, */*',
                    'content-type': 'application/json',
                    'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                    origin: 'https://www.dickssportinggoods.com',
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    referer: 'https://www.dickssportinggoods.com/DSGBillingAddressView',
                    'accept-encoding': 'gzip, deflate, br',
                    'accept-language': 'en-US,en;q=0.9',
                },
                agent: { https: this.proxy?.getHttpsProxyAgent() },
                cookieJar: this.cookieJar,
            });
        } catch (e) {
            this.handleConnectionError(e, this.submitShipping.bind(this), 'Getting checkout session');
            return;
        }

        switch (response.statusCode) {
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.submitShipping.bind(this), `Ratelimited, Rotating proxy and retrying`);
            case 201:
            case 200:
                console.log(response.body);
                break;
            default:
                console.log(response.body);
                throw new RetryExecutor(this.submitShipping.bind(this), `Unable to submit shipping (${response.statusCode}), Retrying`);
        }
    }

    private async getPublicKey() {
        let response: any;
        this.updateStatus('Getting encryption key', TaskStatusColor.Neutral);
        try {
            response = await this.httpClient.get(
                `https://www.dickssportinggoods.com/api/v1/checkouts/${this.checkoutId}/payment/payment-processor/cybersource/public-key`,
                {
                    headers: {
                        Connection: 'keep-alive',
                        'Access-Control-Allow-Origin': '*',
                        Accept: 'application/json',
                        'Cache-Control': 'no-cache,no-store,must-revalidate,max-age=0',
                        'Content-Type': 'application/json',
                        'User-Agent':
                            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36',
                        Pragma: 'no-cache',
                        Expires: 'Sat, 01 Jan 2000 00:00:00 GMT',
                        'Sec-Fetch-Site': 'same-origin',
                        'Sec-Fetch-Mode': 'cors',
                        'Sec-Fetch-Dest': 'empty',
                        Referer: 'https://www.dickssportinggoods.com/DSGPaymentViewCmd?catalogId=12301&langId=-1&storeId=15108',
                        'Accept-Language': 'en-US,en;q=0.9',
                    },
                    agent: { https: this.proxy?.getHttpsProxyAgent() },
                    cookieJar: this.cookieJar,
                }
            );
        } catch (e) {
            this.handleConnectionError(e, this.getCheckout.bind(this), 'Getting checkout session');
            return;
        }
        switch (response.statusCode) {
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.getCheckout.bind(this), `Ratelimited, Rotating proxy and retrying`);
            case 201:
            case 200:
                this.encryptionKey = JSONParseSafely(response?.body);
                break;
            default:
                throw new RetryExecutor(this.getCheckout.bind(this), `Unable to get checkout session (${response.statusCode}), Retrying`);
        }
    }

    private async getToken() {
        let response: any;
        const json = {
            keyId: this.encryptionKey?.['key_id'],
            cardInfo: {
                cardNumber: cyberSourceEncryptV1(this.profile.payment.number, this.encryptionKey?.['der']?.public_key),
                cardType: '001',
                cardExpirationMonth: '06',
                cardExpirationYear: '2026',
            },
        };
        this.updateStatus('Getting encrypted credit card', TaskStatusColor.Neutral);
        try {
            response = await this.httpClient.post(`https://flex.cybersource.com/cybersource/flex/v1/tokens`, {
                json,
                headers: {
                    Connection: 'keep-alive',
                    'Access-Control-Allow-Origin': '*',
                    Accept: 'application/json',
                    'Cache-Control': 'no-cache,no-store,must-revalidate,max-age=0',
                    'Content-Type': 'application/json',
                    'User-Agent':
                        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36',
                    Pragma: 'no-cache',
                    Expires: 'Sat, 01 Jan 2000 00:00:00 GMT',
                    'Sec-Fetch-Site': 'same-origin',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Dest': 'empty',
                    Referer: 'https://www.dickssportinggoods.com/DSGPaymentViewCmd?catalogId=12301&langId=-1&storeId=15108',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                agent: { https: this.proxy?.getHttpsProxyAgent() },
                cookieJar: this.cookieJar,
            });
        } catch (e) {
            this.handleConnectionError(e, this.getCheckout.bind(this), 'Getting checkout session');
            return;
        }
        switch (response.statusCode) {
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.getCheckout.bind(this), `Ratelimited, Rotating proxy and retrying`);
            case 201:
            case 200:
                this.token = JSONParseSafely(response?.body);
                break;
            default:
                throw new RetryExecutor(this.getCheckout.bind(this), `Unable to get checkout session (${response.statusCode}), Retrying`);
        }
    }

    private async submitCard() {
        let response: any;
        this.updateStatus('Processing order', TaskStatusColor.Neutral);
        try {
            response = await this.httpClient.put(`https://www.dickssportinggoods.com/api/v1/checkouts/${this.checkoutId}/payment/payment-processor`, {
                json: {
                    expireMonth: this.profile.payment.month,
                    expireYear: this.profile.payment.year,
                    cvv: this.profile.payment.code,
                    accountDisplay: null,
                    cardType: '001',
                    flexPublicKey: this.encryptionKey,
                    token: this.token,
                },
                headers: {
                    Connection: 'keep-alive',
                    'Access-Control-Allow-Origin': '*',
                    Accept: 'application/json',
                    'Cache-Control': 'no-cache,no-store,must-revalidate,max-age=0',
                    'Content-Type': 'application/json',
                    'User-Agent':
                        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36',
                    Pragma: 'no-cache',
                    Expires: 'Sat, 01 Jan 2000 00:00:00 GMT',
                    'Sec-Fetch-Site': 'same-origin',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Dest': 'empty',
                    Referer: 'https://www.dickssportinggoods.com/DSGPaymentViewCmd?catalogId=12301&langId=-1&storeId=15108',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                agent: { https: this.proxy?.getHttpsProxyAgent() },
                cookieJar: this.cookieJar,
            });
        } catch (e) {
            this.handleConnectionError(e, this.submitCard.bind(this), 'Processing order');
            return;
        }

        switch (response.statusCode) {
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.submitCard.bind(this), `Ratelimited, Rotating proxy and retrying`);
            case 201:
            case 200:
                //this.setStatus('Processing ')
                break;
            default:
                console.log(response.body);
                throw new RetryExecutor(this.submitCard.bind(this), `Unable process order (${response.statusCode}), Retrying`);
        }
    }

    private async placeOrder() {
        this.task.checkoutProxy = this.proxy?.getUrl();
        let response: any;
        this.updateStatus('Checking order', TaskStatusColor.Info);
        try {
            response = await this.httpClient.post(`https://www.dickssportinggoods.com/api/v1/checkouts/${this.checkoutId}`, {
                headers: {
                    Connection: 'keep-alive',
                    'Access-Control-Allow-Origin': '*',
                    Accept: 'application/json',
                    'Cache-Control': 'no-cache,no-store,must-revalidate,max-age=0',
                    'Content-Type': 'application/json',
                    'User-Agent':
                        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36',
                    Pragma: 'no-cache',
                    Expires: 'Sat, 01 Jan 2000 00:00:00 GMT',
                    'Sec-Fetch-Site': 'same-origin',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Dest': 'empty',
                    Referer: 'https://www.dickssportinggoods.com/DSGPaymentViewCmd?catalogId=12301&langId=-1&storeId=15108',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                agent: { https: this.proxy?.getHttpsProxyAgent() },
                cookieJar: this.cookieJar,
            });
        } catch (e) {
            this.handleConnectionError(e, this.placeOrder.bind(this), 'Getting checkout session');
            return;
        }

        switch (response.statusCode) {
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.placeOrder.bind(this), `Ratelimited, Rotating proxy and retrying`);
            case 201:
            case 200:
                this.setStatus('Successfully checked out, check email!', TaskStatusColor.Success, TaskEvent.CheckoutSuccess);
                break;
            case 402:
                const declinedObj = JSONParseSafely(response.body);
                const message = declinedObj?.message || 'Payment declined';
                this.setStatus(message, TaskStatusColor.Error, TaskEvent.CheckoutDecline);
                break;
            default:
                throw new RetryExecutor(this.placeOrder.bind(this), `Unable to check order (${response.statusCode}), Retrying`);
        }
    }
}
