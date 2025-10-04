import { RetryExecutor, StopTask } from '../../../lib/errors';
import { TaskEvent, TaskStatusColor } from '../../../lib/models/taskUpdate';
import BotTask, { BotTaskProperties } from '../models/tasks/botTask';
import FormData from 'form-data';
import Size from '../../../lib/models/size';
import { stopRequestHook } from '../utils/hooks';
import isFormData from '../utils/isFormData';
import getBodySize from '../utils/getBodySize';
import is from '@sindresorhus/is';
import got, { Options } from 'got';
import { randomNumber } from '../../../cli/src/utils/helpers';
import creditCardType from 'credit-card-type';
import Logger from '../../../cli/src/utils/logger';
import Env from '../env';
import Akamai from '../utils/akamai';

import * as cheerio from 'cheerio';

// const customClient = require('@ignitesoftware/http-client');
// const customClientRequest = customClient.request;
// const customClientCookieJar = customClient.CookieJar;

enum StatusCode {
    SUCCESS = 200,
    BLOCK = 403,
}

enum ConnectionError {
    Request = 'RequestError: tunneling socket could not be established',
    Timeout = 'TimeoutError',
}

enum METHOD {
    GET = 'GET',
    HEAD = 'HEAD',
    POST = 'POST',
    PUT = 'PUT',
    DELETE = 'DELETE',
    CONNECT = 'CONNECT',
    OPTIONS = 'OPTIONS',
    TRACE = 'TRACE',
    PATCH = 'PATCH',
}

enum SizeCodes {
    XXSmall = 9000,
    XSmall = 9100,
    Small = 9200,
    Medium = 9300,
    Large = 9400,
    XLarge = 9500,
    XXLarge = 9600,
}

export enum PacsunSizes {
    XXSmall = 'XXS',
    XSmall = 'XS',
    Small = 'S',
    Medium = 'M',
    Large = 'L',
    XLarge = 'XL',
    XXLarge = 'XXL',
}

export default class Pacsun extends BotTask {
    private parsedPID?: string;

    private colorCode?: string;

    private akamaiMethodBypass = false;

    private akamai: Akamai;

    private currentAbck?: string;
    private sensorData?: string;

    private blockMessages = ['Access Denied'];

    private pacsunData: {
        csrfToken?: string;
        profileKey?: string;
        shippingKey?: string;
        billingKey?: string;
    };

    private customCookieJar: any;

    private httpClientType: 'IGNITE' | 'GOT';

    protected *execute() {
        const debug = () => {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        };
        if (Env.isDev) debug(); //TODO remove this for production}

        this.rotateProxy();

        let size;
        let sizes;
        if (this.task.sizes.isRandom()) {
            sizes = [...this.task.sizes.siteSupportedSizes].filter((size) => size !== 'random');
        } else {
            sizes = [...this.task.sizes.userSelectedSizes];
        }
        size = sizes[randomNumber(0, sizes.length - 1)];
        this.task.product.size = new Size(`${this.getSizeCode(size as PacsunSizes)}`, size);

        //(pdi:colorCode) and pid with color code includesd
        [this.task.product.id, this.colorCode] = /:/.test(this.task.product.id)
            ? this.task.product.id.split(':')
            : [this.task.product.id, this.task.product.id.slice(-3)];

        yield this.initialAkamai();

        yield this.parseProduct();

        yield this.addToCart();

        // yield this.startCheckout();

        yield this.submitDetails();

        yield this.checkout();
    }

    constructor(botTaskProps: BotTaskProperties) {
        super(botTaskProps);

        // this.customCookieJar = customClientCookieJar;
        // this.customCookieJar.rejectPublicSuffixes = false;
        // this.cookieJar = this.customCookieJar;

        this.httpClientType = 'GOT';
        // this.httpClientType = 'IGNITE';

        this.akamai = new Akamai();

        this.pacsunData = {};
    }

    /**
     * gets product name, image, price, colorCode and parsed PID
     */
    private async parseProduct() {
        const message = this.colorCode ? 'Getting Product...' : 'Getting Product Details...';
        this.updateStatus(message, TaskStatusColor.Neutral);

        const sizeCode = this.task.product.size?.value;
        if (!this.task.product.id || !sizeCode) {
            let message = 'Invalid task parameters ';
            message += !this.task.product.id ? `product ID: ${this.task.product.id}, ` : '';
            message += !sizeCode ? `size: ${this.task.product.size?.name}, ` : '';
            throw new StopTask(message.substr(0, message.length - 2));
        }

        const endpoint = `on/demandware.store/Sites-pacsun-Site/default/Product-Variation?pid=${this.task.product.id}&dwvar_${this.task.product.id}_size=${sizeCode}&dwvar_${this.task.product.id}_color=${this.colorCode}&format=ajax`;

        const headers = {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.190 Safari/537.36',
            accept: '*/*',
            'accept-language': 'en-US,en;q=0.9',
            origin: 'https://www.pacsun.com',
            referer: `https://www.pacsun.com/${this.task.product.id}.html`,
            // referer: `https://www.pacsun.com/.html`,
            'x-requested-with': 'XMLHttpRequest',
        };

        let response;
        try {
            const method = this.akamaiMethodBypass ? METHOD.PATCH : METHOD.GET;

            response = await this.request(endpoint, method, { headers });
        } catch (e) {
            this.handleConnectionErrorCustom(e, this.parseProduct);
        }

        const statusCode = response?.statusCode as StatusCode;
        switch (statusCode) {
            case StatusCode.SUCCESS:
                this.task.product.name = response.body?.match(/<h1 class="rwd-pdp-name dms-bold"[\w\s-="]*>([\w\s-]*)/)?.[1] || '';
                this.task.product.image = response.body?.split(`<div class="rwd-pdp-image">\n<img src="`)?.[1]?.split('"')?.[0] || '';
                this.task.product.image = `${this.task.product.image?.split('.jpg')?.[0]}.jpg?sw=54&sh=83&sm=fit`; //resize image

                this.task.product.price = response.body?.split(`<div class="usd-price"`)?.[1]?.split(`">`)?.[1]?.split('</div>')?.[0] || '';

                this.parsedPID = response.body?.split(`name="pid" id="pid" value="`)?.[1]?.split(`"/>`)?.[0] || '';
                const parsedColorCode = response?.body?.split(`class="rwd-swatch-value" data-default-id="`)?.[1]?.split('"/>')?.[0]?.split(`">`)?.[0];

                const parsedOptinonalFields = !this.task.product.name || !this.task.product.image || !this.task.product.price;
                if (parsedOptinonalFields) {
                    let message = 'Unable to parse product details ';
                    message += !this.task.product.name ? 'name, ' : '';
                    message += !this.task.product.image ? 'image, ' : '';
                    this.updateStatus(message.substr(0, message.length - 2), TaskStatusColor.Warning);
                }

                const parsedRequiredFields = !!this.parsedPID;

                if (!parsedRequiredFields) {
                    throw new RetryExecutor(this.parseProduct.bind(this), `Unable to parse pid...`);
                } else if (this.parsedPID == this.task.product.id && !this.colorCode) {
                    this.colorCode = parsedColorCode;
                    this.updateStatus('Found product details', TaskStatusColor.Neutral);
                    return this.parseProduct();
                } else if (!this.colorCode) {
                    throw new RetryExecutor(this.parseProduct.bind(this), 'Could not find product details');
                }
                Env.isDev && this.updateStatus(`Found product`, TaskStatusColor.Neutral);

                break;

            case StatusCode.BLOCK:
                let blockedMessage;
                for (const message of this.blockMessages) {
                    if (response?.body?.includes(message)) {
                        blockedMessage = message;
                        break;
                    }
                }

                if (blockedMessage) {
                    this.updateStatus(`Blocked by akamai, generating...`);

                    let responseCookies = response?.headers?.['set-cookie'] || [];
                    responseCookies.forEach((cookie) => {
                        if (cookie.includes('_abck=')) {
                            this.currentAbck = cookie.split('_abck')[1].split(';')[0];
                        }
                    });

                    await this.handleAkamai();
                    throw new RetryExecutor(this.parseProduct.bind(this), 'Retrying - parse product');
                }

                throw new RetryExecutor(this.parseProduct.bind(this), 'Unknown 403 error, retrying to parse product...');

            default:
                // Env.isDev && this.debugHttpResponse(response);
                throw new RetryExecutor(this.parseProduct.bind(this), `Unable to parse product... Status Code: ${statusCode}`);
        }
    }

    private async addToCart() {
        this.updateStatus(`Adding to cart...`, TaskStatusColor.Neutral);

        let response;

        try {
            const form = new FormData();

            form.append('cartAction', 'add');
            form.append('Quantity', this.task.atcQuantity);
            form.append('pid', this.parsedPID || this.task.product.id);

            const ep = 'on/demandware.store/Sites-pacsun-Site/default/Cart-AddProduct?format=ajax';

            const headers = {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.190 Safari/537.36',
                accept: '*/*',
                'accept-language': 'en-US,en;q=0.9',
                origin: 'https://www.pacsun.com',
                referer: `https://www.pacsun.com/${this.task.product.id}.html`,
                // referer: `https://www.pacsun.com/.html`,
                'x-requested-with': 'XMLHttpRequest',
                ...form.getHeaders(),
                'accept-encoding': 'gzip, deflate',
            };

            const body = form.getBuffer().toString();

            const method = this.akamaiMethodBypass ? METHOD.PUT : METHOD.POST;

            response = await this.request(ep, method, { headers, body });
        } catch (e) {
            this.handleConnectionErrorCustom(e, this.addToCart);
        }

        const statusCode = response?.statusCode as StatusCode;

        switch (statusCode) {
            case StatusCode.SUCCESS:
                // const $ = cheerio.load(response.body);
                // const cartedTest = parseInt($('span.minicart-quantity')?.text()) || 0;
                const carted = response.body?.match(/\<span class="minicart-quantity">\n(\d*)\n<\/span\>/)?.[1]?.trim() || 0;
                // console.assert(cartedTest == carted, 'num carted', [cartedTest, carted]);

                if (carted > 0) {
                    const body = response?.body?.toString();

                    this.task.product.name = body?.match(/data-name="([^"]*)">/)?.[1]?.trim() || '';

                    // const productSizeC = $('span.value.Size')?.text()?.trim() || '';
                    const productSize = body?.match(/<span class="value Size">\n([^\n]*)\n<\/span>/)?.[1]?.trim() || '';
                    // console.assert(productSizeC == productSize, 'product size', [productSizeC, productSize]);

                    // const imgC = $('div.mini-cart-image img')?.attr('src') || '';
                    this.task.product.image = body.match(/<img src="([^"]*)"/)?.[1]?.trim() || '';
                    // console.assert(imgC == this.task.product.image, 'image', [imgC, this.task.product.image]);

                    this.task.product.image = `https://imageresize.24i.com/?w=300&url=${this.task.product.image}`; //resize image

                    // const productColorC = $('span.value.Color')?.text()?.trim() || '';
                    const productColor = body.match(/<span class="value Color">\n([^\n]*)\n<\/span>/)?.[1]?.trim() || '';
                    // console.assert(productColorC == productColor, 'color', [productColorC, productColorC]);

                    // const productC = $('div.mini-cart-subtotals span.value')?.text()?.trim() || '';
                    this.task.product.price = body.match(/<span class="value">\n([^\n]*)\n<\/span>/)?.[1]?.trim() || '';
                    // console.assert(productC == this.task.product.price, 'price', [productC, this.task.product.price]);

                    this.task.product.size = new Size(productSize);

                    this.setStatus(
                        `Carted: ${carted} x ${this.task.product.name} Size: ${productSize} Color: ${productColor} Total Price: ${this.task.product.price}`,
                        TaskStatusColor.Cart,
                        TaskEvent.Carted
                    );
                } else {
                    throw new RetryExecutor(this.addToCart.bind(this), 'Waiting for product...');
                }
                break;

            case StatusCode.BLOCK:
                let blockedMessage;
                for (const message of this.blockMessages) {
                    if (response?.body?.includes(message)) {
                        blockedMessage = message;
                        break;
                    }
                }

                if (blockedMessage) {
                    this.updateStatus(`Blocked by akamai, generating...`);

                    let responseCookies = response?.headers?.['set-cookie'] || [];
                    responseCookies.forEach((cookie) => {
                        if (cookie.includes('_abck=')) {
                            this.currentAbck = cookie?.split('_abck')?.[1]?.split(';')?.[0];
                        }
                    });

                    await this.handleAkamai();
                    throw new RetryExecutor(this.addToCart.bind(this), 'Retrying - add to cart');
                }

                throw new RetryExecutor(this.addToCart.bind(this), 'Unknown 403 error, retrying to add to cart...');

            default:
                Env.isDev && this.debugHttpResponse(response);
                throw new RetryExecutor(this.addToCart.bind(this), `Unable to add to cart... Status Code: ${statusCode}`);
        }
    }

    private async startCheckout() {
        this.updateStatus(`Starting checkout...`, TaskStatusColor.Neutral);

        let response;

        try {
            const method = this.akamaiMethodBypass ? METHOD.PATCH : METHOD.GET;
            response = await this.request('on/demandware.store/Sites-pacsun-Site/default/COCheckout-Start', method, {
                headers: {
                    accept: '*/*',
                    'accept-language': 'en-US,en;q=0.9',
                    origin: 'https://www.pacsun.com',
                    'user-agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.190 Safari/537.36',
                    'accept-encoding': 'gzip, deflate',
                },
            });
        } catch (e) {
            this.handleConnectionErrorCustom(e, this.startCheckout);
        }

        const statusCode = response?.statusCode as StatusCode;

        switch (statusCode) {
            case StatusCode.SUCCESS:
                const isWaitingForRestock = () => {
                    const waitingForRestockMessages = [
                        "We're sorry, but this item is out of stock. It will be automatically removed from your shopping bag when you begin checkout.",
                        '<li class="notavailable">This item is currently not available.</li>',
                        'My Bag: 0 Items',
                    ];
                    const restockMessage = waitingForRestockMessages.find((message) => response.body.includes(message));
                    // Env.isDev && restockMessage && console.log(restockMessage);
                    let cartEmpty =
                        response.body
                            ?.split(`<div class="opc-summary-qty clearfix">\n<span class="label">Qty:</span>\n<span class="value">`)?.[0]
                            ?.split(`</span>`)?.[0] == 0;
                    return !!restockMessage || cartEmpty;
                };

                if (isWaitingForRestock()) {
                    throw new RetryExecutor(this.startCheckout.bind(this), 'Waiting for product to restock');
                }

                this.pacsunData.csrfToken = response?.body?.split(`type="hidden" name="csrf_token" value=`)?.[1]?.split(`" />`)?.[0] || '';
                this.pacsunData.profileKey =
                    response?.body?.split(`type="hidden" name="dwfrm_profile_securekey" value="`)?.[1]?.split(`" />`)?.[0] || '';
                this.pacsunData.shippingKey = response?.body
                    ?.split(`type="hidden" name="dwfrm_singleshipping_securekey" value="`)?.[1]
                    ?.split(`" />`)?.[0];
                this.pacsunData.billingKey = response?.body?.split(`type="hidden" name="dwfrm_billing_securekey" value="`)?.[1]?.split(`" />`)?.[0];

                if (!this.pacsunData.csrfToken || !this.pacsunData.profileKey || !this.pacsunData.shippingKey || !this.pacsunData.billingKey) {
                    throw new RetryExecutor(this.startCheckout.bind(this), `Unable to get start checkout...`);
                }
                break;

            case StatusCode.BLOCK:
                let blockedMessage;
                for (const message of this.blockMessages) {
                    if (response?.body?.includes(message)) {
                        blockedMessage = message;
                        break;
                    }
                }

                if (blockedMessage) {
                    this.updateStatus(`Blocked by akamai, generating...`);

                    let responseCookies = response?.headers?.['set-cookie'] || [];
                    responseCookies.forEach((cookie) => {
                        if (cookie.includes('_abck=')) {
                            this.currentAbck = cookie?.split('_abck')?.[1]?.split(';')?.[0];
                        }
                    });

                    await this.handleAkamai();
                    throw new RetryExecutor(this.startCheckout.bind(this), 'Retrying - start checkout');
                }

                throw new RetryExecutor(this.startCheckout.bind(this), 'Unknown 403 error, retrying to start checkout...');

            default:
                // Env.isDev && this.debugHttpResponse(response);

                throw new RetryExecutor(this.startCheckout.bind(this), `Unable to start checkout... Status code: ${statusCode}`);
        }
    }

    private async submitDetails() {
        this.updateStatus(`Submitting checkout information...`, TaskStatusColor.Neutral);

        let response;

        try {
            const form = this.getDetailsForm();
            const method = this.akamaiMethodBypass ? METHOD.PUT : METHOD.POST;
            response = await this.request('on/demandware.store/Sites-pacsun-Site/default/COCheckout-OrderSubmit', method, {
                headers: {
                    accept: 'application/json, text/javascript, */*; q=0.01',
                    'accept-language': 'en-US,en;q=0.9',
                    origin: 'https://www.pacsun.com',
                    referer: 'https://www.pacsun.com/on/demandware.store/Sites-pacsun-Site/default/COSummary-Submit',
                    'user-agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.190 Safari/537.36',
                    'x-requested-with': 'XMLHttpRequest',
                    'accept-encoding': 'gzip, deflate',
                    ...form.getHeaders(),
                },
                body: form.getBuffer().toString(),
                json: true,
            });
        } catch (e) {
            this.handleConnectionErrorCustom(e, this.submitDetails);
        }
        const statusCode = response?.statusCode as StatusCode;

        switch (statusCode) {
            case StatusCode.SUCCESS:
                const success: boolean = response.body?.success;
                const optInOrigin = response.body?.optInOrigin;
                const messages: string[] = response.body?.message || [];
                const errorState: string = response.body?.errorState || '';

                if (!success || optInOrigin !== 'null') {
                    const errorMessage =
                        errorState || (messages.length > 0 && messages?.reduce((acc, item) => (acc.length > 0 ? `${acc}, ${item}` : `${item}`)));
                    throw new RetryExecutor(this.submitDetails.bind(this), `Checkout information error... Error(s): ${errorMessage}`);
                }
                // submitted successfully
                break;

            case StatusCode.BLOCK:
                let blockedMessage;
                for (const message of this.blockMessages) {
                    if (response?.body?.includes(message)) {
                        blockedMessage = message;
                        break;
                    }
                }

                if (blockedMessage) {
                    this.updateStatus(`Blocked by akamai, generating...`);

                    let responseCookies = response?.headers?.['set-cookie'] || [];
                    responseCookies.forEach((cookie) => {
                        if (cookie.includes('_abck=')) {
                            this.currentAbck = cookie.split('_abck')[1].split(';')[0];
                        }
                    });

                    await this.handleAkamai();
                    throw new RetryExecutor(this.submitDetails.bind(this), 'Retrying - submit details');
                }

                throw new RetryExecutor(this.submitDetails.bind(this), 'Unknown 403 error, retrying to submit details...');

            default:
                Env.isDev && this.debugHttpResponse(response);
                throw new RetryExecutor(this.submitDetails.bind(this), `Unable to submit checkout information... Status Code: ${statusCode}`);
        }
    }

    private async logEvent(eventType, sku, title, quantity) {
        // console.log('logging', eventType);
        try {
            let url = encodeURI(
                `https://ignite-logger.herokuapp.com/event?event_type=${eventType}&product_sku=${sku}&product_title=${title}&timestamp=${Date.now()}&quantity=${quantity}`
            );
            await got(url, {
                method: METHOD.POST,
                headers: {
                    'content-type': 'application/json',
                },
            });
        } catch (e) {
            // console.log(e);
        }
    }

    private async checkout() {
        this.updateStatus('Checking out...', TaskStatusColor.Neutral);

        let response;

        try {
            const method = this.akamaiMethodBypass ? METHOD.PATCH : METHOD.GET;
            response = await this.request('on/demandware.store/Sites-pacsun-Site/default/COSummary-Submit', method, {
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                    'accept-language': 'en-US,en;q=0.9',
                    referer: 'https://www.pacsun.com/on/demandware.store/Sites-pacsun-Site/default/COSummary-Submit',
                    'sec-fetch-user': '?1',
                    'upgrade-insecure-requests': '1',
                    'user-agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.190 Safari/537.36',
                },
            });
        } catch (e) {
            this.handleConnectionErrorCustom(e, this.checkout);
        }

        const statusCode = response?.statusCode as StatusCode;

        switch (statusCode) {
            case StatusCode.SUCCESS:
                const paymentDeclinedMessage = 'Payment method declined by issuing bank.';
                const body = response?.body?.toString();
                if (body?.includes(paymentDeclinedMessage)) {
                    this.setStatus('Payment declined', TaskStatusColor.Error, TaskEvent.CheckoutDecline);
                    !Env.isDev && (await this.logEvent('failure', this.task.product.id, this.task.product.name, this.task.atcQuantity));
                    break;
                }

                const $ = cheerio.load(response.body);
                const orderNumber = $('div.order-confirmation div.order-data div.order-number span.value')?.text() || '';

                // const orderNumber =
                //     body
                //         .match(
                //             /<div class="order-confrimation>\n?<div class="order-data">\n?<div class="order-number">\n?<span class="value">\n?([^\n<])/
                //         )?.[1]
                //         ?.trim() || '';

                if (orderNumber) {
                    !Env.isDev && (await this.logEvent('checkout', this.task.product.id, this.task.product.name, this.task.atcQuantity));
                    this.setStatus(`Payment Successful. Order Number ${orderNumber}`, TaskStatusColor.Success, TaskEvent.CheckoutSuccess);
                    break;
                } else {
                    Env.isDev && this.debugHttpResponse(response);
                    throw new RetryExecutor(this.checkout.bind(this), 'Failed to checkout');
                }
                break;

            case StatusCode.BLOCK:
                let blockedMessage;
                for (const message of this.blockMessages) {
                    if (response?.body?.includes(message)) {
                        blockedMessage = message;
                        break;
                    }
                }

                if (blockedMessage) {
                    this.updateStatus(`Blocked by akamai, generating...`);

                    let responseCookies = response?.headers?.['set-cookie'] || [];
                    responseCookies.forEach((cookie) => {
                        if (cookie.includes('_abck=')) {
                            this.currentAbck = cookie.split('_abck')[1].split(';')[0];
                        }
                    });

                    await this.handleAkamai();
                    throw new RetryExecutor(this.checkout.bind(this), 'Retrying - submit order');
                }

                throw new RetryExecutor(this.checkout.bind(this), 'Unknown 403 error, retrying to submit order...');

            default:
                Env.isDev && this.debugHttpResponse(response);
                throw new RetryExecutor(this.checkout.bind(this), `Unable to submit order... Status Code: ${statusCode}`);
        }
    }

    private getDetailsForm() {
        let cardType = creditCardType(this.profile.payment.number)[0].niceType;
        switch (cardType) {
            case 'Visa':
                cardType = 'Visa';
                break;
            case 'Mastercard':
                cardType = 'MasterCard';
                break;
            case 'American Express':
                cardType = 'Amex';
                break;
            case 'Discover':
                cardType = 'Discover';
                break;
            default:
                this.updateStatus(
                    "Unsupported card type, but we'll do our best to make it work. Contact support to get it added :)",
                    TaskStatusColor.Warning
                );
        }
        const month = this.profile.payment.month.toString();
        const form = new FormData();
        form.append('dwfrm_profile_securekey', this.pacsunData.profileKey);
        form.append(
            'dwfrm_billing_billingAddress_addressFields_email_emailAddress',
            this.profile.billingAddress?.email || this.profile.shippingAddress.email
        );
        form.append('dwfrm_billing_billingAddress_addressFields_phone', this.profile.billingAddress?.phone || this.profile.shippingAddress.phone);
        form.append('dwfrm_singleshipping_shippingAddress_optInEmail', 'true');
        form.append('dwfrm_singleshipping_shippingAddress_alternateFirstName', '');
        form.append('dwfrm_singleshipping_shippingAddress_alternateLastName', '');
        form.append('dwfrm_singleshipping_securekey', this.pacsunData.shippingKey);
        form.append('dwfrm_singleshipping_shippingAddress_addressFields_firstName', this.profile.shippingAddress.firstName);
        form.append('dwfrm_singleshipping_shippingAddress_addressFields_lastName', this.profile.shippingAddress.lastName);
        form.append('dwfrm_singleshipping_shippingAddress_addressFields_address1', this.profile.shippingAddress.address);
        form.append('dwfrm_singleshipping_shippingAddress_addressFields_address2', this.profile.shippingAddress.secondaryAddress);
        form.append('dwfrm_singleshipping_shippingAddress_addressFields_city', this.profile.shippingAddress.city);
        form.append('dwfrm_singleshipping_shippingAddress_addressFields_states_state', this.profile.shippingAddress.stateCode);
        form.append('dwfrm_singleshipping_shippingAddress_addressFields_country', this.profile.shippingAddress.country);
        form.append('dwfrm_singleshipping_shippingAddress_addressFields_postal', this.profile.shippingAddress.zip);
        form.append('dwfrm_singleshipping_originID', 'DSK');
        form.append('dwfrm_billing_paymentMethods_selectedPaymentMethodID', 'CREDIT_CARD');
        form.append('dwfrm_billing_paymentMethods_creditCard_number', this.profile.payment.number);
        form.append('dwfrm_billing_paymentMethods_creditCard_owner', this.profile.name);
        form.append('dwfrm_billing_paymentMethods_creditCard_type', cardType);
        form.append('expDate', `${month.length === 1 ? '0' + month : month}` + '/' + this.profile.payment.year);
        form.append('dwfrm_billing_paymentMethods_creditCard_expiration_month', month);
        form.append('dwfrm_billing_paymentMethods_creditCard_expiration_year', this.profile.payment.year);
        form.append('dwfrm_billing_paymentMethods_creditCard_cvn', this.profile.payment.code);
        form.append('dwfrm_billing_save', 'true');
        form.append('dwfrm_billing_securekey', this.pacsunData.billingKey);
        form.append('ltkSubscriptionCode', 'checkoutbilling');
        form.append(
            'dwfrm_billing_billingAddress_addressFields_firstName',
            this.profile.billingAddress?.firstName || this.profile.shippingAddress.firstName
        );
        form.append(
            'dwfrm_billing_billingAddress_addressFields_lastName',
            this.profile.billingAddress?.lastName || this.profile.shippingAddress.lastName
        );
        form.append(
            'dwfrm_billing_billingAddress_addressFields_address1',
            this.profile.billingAddress?.address || this.profile.shippingAddress.address
        );
        form.append(
            'dwfrm_billing_billingAddress_addressFields_address2',
            this.profile.billingAddress?.secondaryAddress || this.profile.shippingAddress.secondaryAddress
        );
        form.append('dwfrm_billing_billingAddress_addressFields_city', this.profile.billingAddress?.city || this.profile.shippingAddress.city);
        form.append(
            'dwfrm_billing_billingAddress_addressFields_states_state',
            this.profile.billingAddress?.stateCode || this.profile.shippingAddress.stateCode
        );
        form.append('dwfrm_billing_billingAddress_addressFields_postal', this.profile.billingAddress?.zip || this.profile.shippingAddress.zip);
        form.append(
            'dwfrm_billing_billingAddress_addressFields_country',
            this.profile.billingAddress?.country || this.profile.shippingAddress.country
        );
        form.append('csrf_token', this.pacsunData.csrfToken);
        form.append('shippingID', 'SP');
        return form;
    }

    private beforeHook() {
        stopRequestHook(this.shouldStopTask);
    }

    private async request(endpoint: string, method: METHOD, options: { headers?: any; body?: any; json?: boolean }) {
        this.beforeHook();
        let headers = {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.190 Safari/537.36',
            accept: 'text/html, */*; q=0.01',
            'accept-language': 'en-US,en;q=0.9,fr;q=0.8',
            ...options.headers,
        };
        const bodyObj = options.body ? { body: options.body } : {};

        const noContentType = !is.string(headers['content-type']);

        if (options.body && isFormData(options.body) && noContentType) {
            headers['content-type'] = `multipart/form-data; boundary=${options.body.getBoundary()}`;
            bodyObj.body = bodyObj.body.getBuffer().toString();
        }

        const uploadBodySize = await getBodySize(options.body, options.headers);
        if (bodyObj && is.undefined(headers['content-length']) && is.undefined(headers['transfer-encoding']) && !is.undefined(uploadBodySize)) {
            headers['Content-Length'] = String(uploadBodySize);
        }

        headers = { ...headers, Host: 'www.pacsun.com', Connection: 'close' };

        const responseTypeCustom = options.json ? { json: true } : {};
        const url = endpoint.includes('https') ? endpoint : `https://www.pacsun.com/${endpoint}`;

        // const customRequestOptions = {
        //     method,
        //     url,
        //     headers,
        //     ...bodyObj,
        //     jar: this.customCookieJar,
        //     proxy: this.proxy?.getUrl(),
        //     ...responseTypeCustom,
        // };

        // if (this.httpClientType === 'GOT') {
        const gotRequestOptions = {
            http2: false,
            method,
            headers: options.headers,
            ...bodyObj,
            responseType: options.json ? 'json' : undefined,
            timeout: 15_000,
        } as Options;
        return this.httpClient(url, gotRequestOptions);
        // }
        // return customClientRequest(customRequestOptions);
    }

    private getSizeCode = (size: PacsunSizes) => {
        switch (size) {
            case PacsunSizes.XXSmall:
                return SizeCodes.XXSmall;
            case PacsunSizes.XSmall:
                return SizeCodes.XSmall;
            case PacsunSizes.Small:
                return SizeCodes.Small;
            case PacsunSizes.Medium:
                return SizeCodes.Medium;
            case PacsunSizes.Large:
                return SizeCodes.Large;
            case PacsunSizes.XLarge:
                return SizeCodes.XLarge;
            case PacsunSizes.XXLarge:
                return SizeCodes.XXLarge;
        }
    };

    protected handleConnectionErrorCustom(e: any, retry?: () => Promise<void>) {
        let errorMsg;
        const error = e?.toString() || '';

        if (error.includes(ConnectionError.Request)) {
            this.rotateProxy();
            errorMsg = `Failed to connect to proxy, rotating...`;
        } else if (error.includes(ConnectionError.Timeout)) {
            Logger.log(e, Env.isDev);
            errorMsg = 'Connection timed out, site is overloaded...';
        } else {
            Logger.log(e, Env.isDev);
            errorMsg = 'Unknown';
        }

        if (retry) {
            throw new RetryExecutor(retry.bind(this), `Connection Error Occurred: ${errorMsg}`);
        }
        this.updateStatus(`Connection Error Occurred: ${errorMsg}`, TaskStatusColor.Warning);
    }

    private async handleAkamai() {
        await this.getSensor();
        await this.postSensor();
        this.updateStatus('Generated Akamai', TaskStatusColor.Neutral);
        return;
    }

    private async initialAkamai() {
        await this.getInvalidAbck();
        await this.getSensor();
        await this.postSensor();
        this.updateStatus('Generated Akamai', TaskStatusColor.Neutral);
        return;
    }

    private async getInvalidAbck() {
        this.updateStatus('Generating Akamai....');

        let response;
        try {
            const method = METHOD.GET;
            response = await this.request(`https://www.pacsun.com/oKAQWPlExSvLTauY4SB_/Oh5DSkpfb1L9/fRFdDCcC/DT/cXdWoDZn0`, method, {
                headers: {
                    authority: 'www.pacsun.com',
                    'x-sec-clge-req-type': 'ajax',
                    'sec-ch-ua-mobile': '?0',
                    'user-agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.190 Safari/537.36',
                    'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
                    'content-type': 'text/plain;charset=UTF-8',
                    accept: '*/*',
                    origin: 'https://www.pacsun.com',
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    referer: 'https://www.pacsun.com/',
                    'accept-language': 'en-US,en;q=0.9',
                },
            });
        } catch (e) {
            this.handleConnectionErrorCustom(e, this.getSensor.bind(this));
        }

        if (response.statusCode === 200) {
            try {
                let responseCookies = response?.headers?.['set-cookie'] || [];
                responseCookies.forEach((cookie) => {
                    if (cookie.includes('_abck=')) {
                        this.currentAbck = cookie.split('_abck')[1].split(';')[0];
                    }
                });
                return;
            } catch (e) {
                throw new RetryExecutor(this.getSensor.bind(this), `Failed to fetch invaliid abck...`);
            }
        } else if (response.statusCode === 401) {
            throw new RetryExecutor(this.getSensor.bind(this), `Unauthorized akamai api...`);
        }
    }

    private async getSensor() {
        let response;
        try {
            const method = METHOD.POST;
            response = await this.request(`https://ak01-eu.hwkapi.com/akamai/generate`, method, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept-Encoding': 'gzip, deflate',
                    'X-Api-Key': '022921a2-ae7a-11eb-8529-0242ac130003',
                    'X-Sec': 'low',
                },
                body: JSON.stringify({
                    site: 'www.pacsun.com',
                    abck: this.currentAbck,
                    type: 'sensor',
                    events: '1,1',
                }),
            });
        } catch (e) {
            this.handleConnectionErrorCustom(e, this.getSensor);
        }

        if (response.statusCode === 200) {
            this.sensorData = response.body.split('*')[0];
            return;
        } else if (response.statusCode === 401) {
            throw new RetryExecutor(this.getSensor.bind(this), `Unauthorized akamai api...`);
        }
    }

    private async postSensor() {
        let response;
        try {
            const method = METHOD.POST;
            let akamaiEndpoint = `https://www.pacsun.com/oKAQWPlExSvLTauY4SB_/Oh5DSkpfb1L9/fRFdDCcC/DT/cXdWoDZn0`;
            response = await this.request(akamaiEndpoint, method, {
                headers: {
                    authority: 'www.pacsun.com',
                    'x-sec-clge-req-type': 'ajax',
                    'sec-ch-ua-mobile': '?0',
                    'user-agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.190 Safari/537.36',
                    'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
                    'content-type': 'text/plain;charset=UTF-8',
                    accept: '*/*',
                    origin: 'https://www.pacsun.com',
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    referer: 'https://www.pacsun.com/',
                    'accept-language': 'en-US,en;q=0.9',
                },
                body: JSON.stringify({
                    sensor_data: this.sensorData,
                }),
            });
        } catch (e) {
            this.handleConnectionErrorCustom(e, this.postSensor);
        }

        if (response.statusCode === 200 || 201) {
            return;
        } else {
            throw new RetryExecutor(this.postSensor.bind(this), `Error posting sensor data...`);
        }
    }

    // private async cfTest() {
    //     const ep =
    //         'on/demandware.store/Sites-pacsun-Site/default/Product-Variation?pid=0172517080008&dwvar_0172517080008_size=9600&dwvar_0172517080008_color=067&source=detail&uuid=';

    //     let response: any;
    //     try {
    //         const headers = {
    //             'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.190 Safari/537.36',
    //             accept: '*/*',
    //             'accept-language': 'en-US,en;q=0.9',
    //             origin: 'https://www.pacsun.com',
    //         };

    //         response = await this.request(ep, METHOD.GET, { headers });
    //     } catch (e) {
    //         // console.log(e);
    //         this.handleConnectionErrorCustom(e, this.addToCart);
    //     }

    //     const statusCode = response.statusCode as StatusCode;

    //     // console.log(statusCode);
    //     switch (statusCode) {
    //         case StatusCode.SUCCESS:
    //             this.updateStatus('Success');
    //         case StatusCode.BLOCK:
    //             await this.handleAkamai(response);
    //     }
    // }

    // private async handleCloudflare(response?: any) {
    //     // this.debugHttpResponse(response);
    //     console.log(response);
    //     this.updateStatus("fuck fuck fuck it's cf", TaskStatusColor.Warning);
    //     // await sleep(220);
    //     // this.rotateProxy();
    //     // console.log(response.requestUrl);
    //     // const url = response.requestUrl;

    //     // const config = {
    //     //     url,
    //     //     proxy: this.proxy,
    //     //     jar: this.customCookieJar,
    //     //     hCaptchaSolver: this.solveHCaptcha.bind(this),
    //     //     // url: response.url
    //     // };
    //     // const hawk = new HawkCloudflare(config);
    //     // try {
    //     //     const res = await hawk.solve();
    //     //     // console.log(res);
    //     // } catch (e) {
    //     //     console.log(e);
    //     // }
    // }

    // private async solveHCaptcha(url: string) {
    //     this.updateStatus('Solving HCaptcha', TaskStatusColor.Neutral);
    //     const captchaTask: CaptchaTask = {
    //         taskID: this.task.id,
    //         type: CaptchaType.HCaptcha,
    //         URL: url,
    //         siteKey: `33f96e6a-38cd-421b-bb68-7806e1764460`,
    //         proxy: this.proxy,
    //         // userAgent:
    //         // cookies:
    //     };
    //     while (!this.shouldStopTask) {
    //         try {
    //             const solution = await this.solveCaptcha(captchaTask);
    //             const token = solution;
    //             this.updateStatus(`Solved Captcha ${solution.substring(0, 10)}`, TaskStatusColor.Neutral);
    //             return token;
    //         } catch (e) {
    //             this.updateStatus('Error Solving Captcha: ' + e, TaskStatusColor.Error);
    //         }
    //     }
    // }
}
