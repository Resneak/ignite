import { RetryExecutor, StopTask } from '../../../lib/errors';
import { TaskEvent, TaskStatusColor } from '../../../lib/models/taskUpdate';
import BotTask, { BotTaskProperties } from '../models/tasks/botTask';
// const FormData = require('form-data');
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
const cheerio = require('cheerio');
import { Cookie } from 'tough-cookie';

// const customClient = require('@ignitesoftware/http-client');
// const customClientRequest = customClient.request;
// const customClientCookieJar = customClient.CookieJar;

enum StatusCode {
    SUCCESS = 200,
    BLOCK = 403,
}

enum ConnectionError {
    Request = 'RequestError: tunneling socket could not be established, statusCode=407',
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

// enum SizeCodes {
//     XXSmall = 9000,
//     XSmall = 9100,
//     Small = 9200,
//     Medium = 9300,
//     Large = 9400,
//     XLarge = 9500,
//     XXLarge = 9600,
// }

// export enum PacsunSizes {
//     XXSmall = 'XXS',
//     XSmall = 'XS',
//     Small = 'S',
//     Medium = 'M',
//     Large = 'L',
//     XLarge = 'XL',
//     XXLarge = 'XXL',
// }

export default class AMD extends BotTask {
    private akamaiMethodBypass = false;

    private akamai: Akamai;

    private currentAbck?: string;
    private sensorData?: string;

    private blockMessages = ['Access Denied'];

    private captchaToken = '';
    private formBuildId = '';
    private sessionId = '';
    private clientSecret = '';
    private upstreamId = '';
    private productPrice = '';
    private hasSubmittedAtcCaptcha = false;
    private productPageLibraries = '';
    private captchaUrl = '';
    private getBlockLibraries = '';

    private customCookieJar: any;

    private httpClientType: 'IGNITE' | 'GOT';

    protected *execute() {
        const debug = () => {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        };
        if (Env.isDev) debug(); //TODO remove this for production}

        this.rotateProxy();

        yield this.handleAkamai();
        yield this.getProductPage();

        // yield this.getBlock();

        this.captchaUrl = 'https://www.amd.com/en/direct-buy/validate-recaptcha';

        while (!this.hasSubmittedAtcCaptcha) {
            // yield this.solveRecaptcha();
            yield this.submitCartCaptcha();
        }
        yield this.addToCart();
        yield this.getCheckout();
        yield this.checkoutPaymentForm();
        yield this.submitPaymentSource();
        yield this.registerPaymentSource();
        yield this.getShippingPage();
        yield this.selectShipping();
    }

    constructor(botTaskProps: BotTaskProperties) {
        super(botTaskProps);

        // this.customCookieJar = customClientCookieJar;
        // this.customCookieJar.rejectPublicSuffixes = false;
        // this.cookieJar = this.customCookieJar;

        this.httpClientType = 'GOT';
        // this.httpClientType = 'IGNITE';

        this.akamai = new Akamai();
    }

    private async getProductPage() {
        this.updateStatus('Getting product page...', TaskStatusColor.Neutral);

        const endpoint = `https://www.amd.com/en/direct-buy/products/us`;

        const headers = {
            authority: 'www.amd.com',
            'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
            accept: 'application/json, text/javascript, */*; q=0.01',
            'x-requested-with': 'XMLHttpRequest',
            'sec-ch-ua-mobile': '?0',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36',
            'content-type': 'application/json; charset=UTF-8',
            origin: 'https://www.amd.com',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-mode': 'cors',
            'sec-fetch-dest': 'empty',
            referer: 'https://www.amd.com/en/direct-buy/5450881700/us',
            'accept-language': 'en-US,en;q=0.9',
            dnt: '1',
        };

        let response;
        try {
            response = await this.request(endpoint, METHOD.GET, {
                headers: headers,
            });
        } catch (e) {
            this.handleConnectionErrorCustom(e, this.getProductPage);
        }

        const statusCode = response?.statusCode as StatusCode;

        switch (statusCode) {
            case StatusCode.SUCCESS:
                const $ = cheerio.load(response.body);
                $('script')
                    .get()
                    .forEach((script) => {
                        if (script.attribs['data-drupal-selector']) {
                            let productPageDataJson = JSON.parse(script.children[0].data);
                            this.productPageLibraries = productPageDataJson.ajaxPageState.libraries;
                        }
                    });

                this.updateStatus(`Got product page`, TaskStatusColor.Neutral);
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

                    let responseCookies = response?.headers['set-cookie'];
                    responseCookies.forEach((cookie) => {
                        if (cookie.includes('_abck=')) {
                            this.currentAbck = cookie.split('_abck')[1].split(';')[0];
                        }
                    });

                    if (!this.currentAbck) {
                        await this.handleAkamai();
                    } else {
                        await this.handleAkamai();
                    }

                    throw new RetryExecutor(this.getProductPage.bind(this), 'Retrying - get product page');
                }

                throw new RetryExecutor(this.getProductPage.bind(this), 'Unknown 403 error, retrying to get product page...');

            default:
                Env.isDev && this.debugHttpResponse(response);
                throw new RetryExecutor(this.getProductPage.bind(this), `Unable to get product page... Status Code: ${statusCode}`);
        }
    }

    private async getBlock() {
        this.updateStatus('Getting block...', TaskStatusColor.Neutral);

        const endpoint = `https://www.amd.com/en/direct-buy/add-to-cart/5450881700?_wrapper_format=drupal_ajax`;

        const headers = {
            authority: 'www.amd.com',
            'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
            accept: 'application/json, text/javascript, */*; q=0.01',
            'x-requested-with': 'XMLHttpRequest',
            'sec-ch-ua-mobile': '?0',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36',
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            origin: 'https://www.amd.com',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-mode': 'cors',
            'sec-fetch-dest': 'empty',
            referer: 'https://www.amd.com/en/direct-buy/5450881700/us',
            'accept-language': 'en-US,en;q=0.9',
            dnt: '1',
        };

        let form = new FormData();
        form.append('js', 'true');
        form.append('_drupal_ajax', '1');
        form.append('ajax_page_state[theme]', 'amd');
        form.append('ajax_page_state[theme_token]', '');
        // form.append('ajax_page_state[libraries]', '');
        form.append('ajax_page_state[libraries]', this.productPageLibraries);

        let response;
        try {
            const method = this.akamaiMethodBypass ? METHOD.PATCH : METHOD.POST;

            response = await this.request(endpoint, method, {
                headers: headers,
                body: form.getBuffer().toString(),
            });
        } catch (e) {
            this.handleConnectionErrorCustom(e, this.getBlock);
        }

        const statusCode = response?.statusCode as StatusCode;

        switch (statusCode) {
            case StatusCode.SUCCESS:
                try {
                    const $ = cheerio.load(response.body);
                    $('script')
                        .get()
                        .forEach((script) => {
                            if (script.attribs['data-drupal-selector']) {
                                let productPageDataJson = JSON.parse(script.children[0].data);
                                this.getBlockLibraries = productPageDataJson.ajaxPageState.libraries;
                            }
                        });

                    return;
                } catch (e) {
                    throw new RetryExecutor(this.addToCart.bind(this), 'Retrying to get block...');
                }

            case StatusCode.BLOCK:
                console.log(response?.body);
                // let blockedMessage;
                // for (const message of this.blockMessages) {
                //     if (response?.body?.includes(message)) {
                //         blockedMessage = message;
                //         break;
                //     }
                // }

                // if (blockedMessage) {
                //     this.updateStatus(`Blocked by akamai, generating...`);

                //     let responseCookies = response?.headers['set-cookie'];

                //     if (!responseCookies === undefined) {
                //         responseCookies.forEach((cookie) => {
                //             if (cookie.includes('_abck=')) {
                //                 this.currentAbck = cookie.split('_abck')[1].split(';')[0];
                //             }
                //         });
                //     }

                //     if (!this.currentAbck) {
                //         await this.handleAkamai();
                //     } else {
                //         await this.handleAkamai();
                //     }

                //     throw new RetryExecutor(this.getBlock.bind(this), 'Retrying - get block');
                // }

                throw new RetryExecutor(this.getBlock.bind(this), 'Unknown 403 error, retrying to get block...');

            default:
                Env.isDev && this.debugHttpResponse(response);
                throw new RetryExecutor(this.getBlock.bind(this), `Unable to get block... Status Code: ${statusCode}`);
        }
    }

    private async submitCartCaptcha() {
        this.updateStatus('Submitting cart captcha...', TaskStatusColor.Neutral);

        const endpoint = `https://www.amd.com/en/direct-buy/validate-recaptcha`;

        const headers = {
            authority: 'www.amd.com',
            'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
            accept: 'application/json, text/javascript, */*; q=0.01',
            'x-requested-with': 'XMLHttpRequest',
            'sec-ch-ua-mobile': '?0',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36',
            'content-type': 'application/json; charset=UTF-8',
            origin: 'https://www.amd.com',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-mode': 'cors',
            'sec-fetch-dest': 'empty',
            'accept-encoding': 'gzip, deflate, br',
            referer: 'https://www.amd.com/en/direct-buy//us',
            'accept-language': 'en-US,en;q=0.9',
            dnt: '1',
        };

        await this.cookieJar.setCookie(
            new Cookie({
                key: '_gali',
                value: 'confirm-add-to-cart-btn',
                domain: 'amd.com',
            }),
            'https://amd.com/'
        );

        await this.cookieJar.setCookie(
            new Cookie({
                key: 'fonce_current_day',
                value: '1,2021-06-12',
                domain: 'amd.com',
            }),
            'https://amd.com/'
        );

        await this.cookieJar.setCookie(
            new Cookie({
                key: 'fonce_current_user',
                value: '1',
                domain: 'amd.com',
            }),
            'https://amd.com/'
        );

        await this.cookieJar.setCookie(
            new Cookie({
                key: 'fonce_current_session',
                value: '1',
                domain: 'amd.com',
            }),
            'https://amd.com/'
        );

        await this.cookieJar.setCookie(
            new Cookie({
                key: 'c_rurl',
                value: 'https%3A//www.amd.com/en/direct-buy//us/',
                domain: 'amd.com',
            }),
            'https://amd.com/'
        );

        let response;
        try {
            const method = this.akamaiMethodBypass ? METHOD.PUT : METHOD.POST;
            response = await this.request(endpoint, METHOD.POST, {
                headers: headers,
                body: JSON.stringify({
                    'g-recaptcha-response':
                        '03AGdBq24H-XSKnYs4McSNcCY9HwJ3jQbih2b7304UKIHQnJKY8PJA3BDVkNq0Y26H8i1lLMGjhwjwS4lN300IUKn8EThlStnZqBTMY7lmHQKmQVlGGKxEflcdcGiEVG-G9RbzJjNACd_iSgsENXKpp-whApfxlZVJdC6myUH_2ibMBFjeZ1GwBqdwz5ByoIPrb4HjwkTTX5-zRAWfmY-tqrAE7mC2hyg9BZY3MOvBIearTgZkHIQBpHV2rzE5f9S6G6usCVRtZtUuIbo-0FYCjCMsrvLSHPJWNqFnm6svHEJnoxjlCA9e8-OdOZWJvEmnnfzk7Djz5S25U_8oYQbGQHAT3JAdtlKc9x-aQirtwxvZQqVy1XVe0tlr0QmZ_LYnfKHIgUMoyyE-BoWWrw_M8Y07tPLhX7-KF13nvO8gCMtHv8Uo5D3JFPOZJ4pyAdbugZ80CIXJWEC2EutLw7peyKHbZ3K_nnOazfyzuWJLVLFvzk5mQsfpRzwG80lNqGd0zfJUXNwhlaJNtbtNwUN1uzRBAgSp1A1fnYb5VXYTW0k1-lNtrmNBGZOpnFxT61txlsfZlw8oWTyeaax-zehabdHDwlQkygIJWqexAqLv9K4duYgn1Bc8hL7t7qOtBKope-jIzA8pLGBiQV3GjXEcco6kmus3XR2NU8e8VJ-U1ZqtVojIWEUWt1nTMHql7AiB23WqPNeW2F45xbDG-vaNtCluMNja6aJBGyUFvbC5v_KG7KfUZ55D1bv2pv-jD2G9I2UuaGzWyCFYgAfDtAyzg85QyxLuhSOrAsvGwKDR0riqY-vvPobQqVFavvVfz3pTgh-jVi8P595S0FnmPcDLZzZP92pv1E1JQdae4fOgZ72npzQ1_slqiMv_4C_pXipb7dB_GroJ-AKGciV7gzXL6arJr7rX0CzhZXN3PGfSSFsvEahyYwp4YZGBnFxX8nEhU1kWwfuKLluYl0EyzGjKcUQqEF68PFm636JZRsReLFv5B4wU9zYDNzvCXI2gvvVPxfbQ7NAwSPbcomQc_rZkf8POjvyRxjNGZxHEBVMKEmShwGV8y_PcE1tLz4VqXajpRf_QkX1pXbv1I6yMYyajRJeFV72ZchTih6I_RXY_UpEE-84sdK9qyEBosu12frytIq7J8rgilIqVeTI5zsUNs4bZBmyGYmLZ0MoDo8q9MPCoVHvGWGHs_ZBGVNmkiRFIXVB1gf5OIIri77tAMoAQklctRtRFynB1D4deaMCJTQ_HLL_K7zVDjzI',
                    action: 'ADD_TO_CART',
                }),
            });
        } catch (e) {
            this.handleConnectionErrorCustom(e, this.submitCartCaptcha);
        }

        const statusCode = response?.statusCode as StatusCode;

        switch (statusCode) {
            case StatusCode.SUCCESS:
                console.log(response.body, typeof response.body);
                let responseJson = JSON.parse(response.body);
                if (responseJson.userIsValid === true) {
                    this.hasSubmittedAtcCaptcha = true;
                    this.updateStatus(`Submitted cart captcha`, TaskStatusColor.Neutral);
                    return;
                } else {
                    this.updateStatus(`Error validating cart captcha...`, TaskStatusColor.Error);
                    return;
                }

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

                    let responseCookies = response?.headers['set-cookie'];
                    responseCookies.forEach((cookie) => {
                        if (cookie.includes('_abck=')) {
                            this.currentAbck = cookie.split('_abck')[1].split(';')[0];
                        }
                    });

                    if (!this.currentAbck) {
                        await this.handleAkamai();
                    } else {
                        await this.handleAkamai();
                    }

                    throw new RetryExecutor(this.submitCartCaptcha.bind(this), 'Retrying - submit cart captcha');
                }

                throw new RetryExecutor(this.submitCartCaptcha.bind(this), 'Unknown 403 error, retrying to submit cart captcha...');

            default:
                Env.isDev && this.debugHttpResponse(response);
                throw new RetryExecutor(this.submitCartCaptcha.bind(this), `Unable to submit cart captcha... Status Code: ${statusCode}`);
        }
    }

    private async addToCart() {
        this.updateStatus('Adding to cart...', TaskStatusColor.Neutral);

        const endpoint = `https://www.amd.com/en/direct-buy/add-to-cart/5450881700?_wrapper_format=drupal_ajax`;

        const headers = {
            authority: 'www.amd.com',
            'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
            accept: 'application/json, text/javascript, */*; q=0.01',
            'x-requested-with': 'XMLHttpRequest',
            'sec-ch-ua-mobile': '?0',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36',
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            origin: 'https://www.amd.com',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-mode': 'cors',
            'sec-fetch-dest': 'empty',
            referer: 'https://www.amd.com/en/direct-buy/5450881700/us',
            'accept-language': 'en-US,en;q=0.9',
            dnt: '1',
        };

        let bruh = `js=true&_drupal_ajax=1&ajax_page_state[theme]=amdajax_page_state[theme_token]=&ajax_page_state[libraries]=${this.productPageLibraries}`;

        let form = new FormData();
        form.append('js', 'true');
        form.append('_drupal_ajax', '1');
        form.append('ajax_page_state[theme]', 'amd');
        form.append('ajax_page_state[theme_token]', '');
        // form.append('ajax_page_state[libraries]', '');
        form.append('ajax_page_state[libraries]', this.getBlockLibraries);

        let response;
        try {
            const method = this.akamaiMethodBypass ? METHOD.PATCH : METHOD.POST;

            response = await this.request(endpoint, method, {
                headers: headers,
                body: bruh,
            });
        } catch (e) {
            this.handleConnectionErrorCustom(e, this.addToCart);
        }

        const statusCode = response?.statusCode as StatusCode;

        switch (statusCode) {
            case StatusCode.SUCCESS:
                if (response.body.includes('Product added to cart')) {
                    JSON.parse(response.body).forEach((x) => {
                        if (x.method === 'addToCartAnalyticsEvent') {
                            this.upstreamId = x.args[0].id.toString();
                        } else if (x.method === '') {
                            this.productPrice = x.args[0].pricing.formattedSalePrice.toString();
                        }
                    });

                    this.updateStatus(`Added to cart`, TaskStatusColor.Cart);
                    return;
                } else {
                    throw new RetryExecutor(this.addToCart.bind(this), 'Retrying to add to cart...');
                }

            case StatusCode.BLOCK:
                console.log(response?.body);
                let blockedMessage;
                for (const message of this.blockMessages) {
                    if (response?.body?.includes(message)) {
                        blockedMessage = message;
                        break;
                    }
                }

                if (blockedMessage) {
                    this.updateStatus(`Blocked by akamai, generating...`);

                    let responseCookies = response?.headers['set-cookie'];

                    if (!responseCookies === undefined) {
                        responseCookies.forEach((cookie) => {
                            if (cookie.includes('_abck=')) {
                                this.currentAbck = cookie.split('_abck')[1].split(';')[0];
                            }
                        });
                    }

                    if (!this.currentAbck) {
                        await this.handleAkamai();
                    } else {
                        await this.handleAkamai();
                    }

                    throw new RetryExecutor(this.addToCart.bind(this), 'Retrying - atc');
                }

                throw new RetryExecutor(this.addToCart.bind(this), 'Unknown 403 error, retrying to atc...');

            default:
                Env.isDev && this.debugHttpResponse(response);
                throw new RetryExecutor(this.addToCart.bind(this), `Unable to atc... Status Code: ${statusCode}`);
        }
    }

    private async getCheckout() {
        this.updateStatus('Getting checkout...', TaskStatusColor.Neutral);

        const endpoint = `https://www.amd.com/en/direct-buy/checkout/payment/${this.upstreamId}/us`;

        const headers = {
            authority: 'www.amd.com',
            'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
            accept: 'application/json, text/javascript, */*; q=0.01',
            'x-requested-with': 'XMLHttpRequest',
            'sec-ch-ua-mobile': '?0',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36',
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            origin: 'https://www.amd.com',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-mode': 'cors',
            'sec-fetch-dest': 'empty',
            referer: 'https://www.amd.com/en/direct-buy/5450881700/us',
            'accept-language': 'en-US,en;q=0.9',
            dnt: '1',
        };

        let response;
        try {
            const method = this.akamaiMethodBypass ? METHOD.PATCH : METHOD.GET;

            response = await this.request(endpoint, method, {
                headers: headers,
            });
        } catch (e) {
            this.handleConnectionErrorCustom(e, this.getCheckout);
        }

        const statusCode = response?.statusCode as StatusCode;

        switch (statusCode) {
            case StatusCode.SUCCESS:
                this.formBuildId =
                    response?.body
                        ?.split(
                            `value="Next Step" class="button js-form-submit form-submit" />\n</div><input autocomplete="off" data-drupal-selector="`
                        )[1]
                        .split(`" type="hidden" name="form_build_id" value="`)[1]
                        .split(`" />`)[0] || '';
                this.updateStatus(`Got checkout`, TaskStatusColor.Neutral);
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

                    let responseCookies = response?.headers['set-cookie'];
                    responseCookies.forEach((cookie) => {
                        if (cookie.includes('_abck=')) {
                            this.currentAbck = cookie.split('_abck')[1].split(';')[0];
                        }
                    });

                    if (!this.currentAbck) {
                        await this.handleAkamai();
                    } else {
                        await this.handleAkamai();
                    }

                    throw new RetryExecutor(this.getCheckout.bind(this), 'Retrying - get checkout');
                }

                throw new RetryExecutor(this.getCheckout.bind(this), 'Unknown 403 error, retrying to get checkout...');

            default:
                Env.isDev && this.debugHttpResponse(response);
                throw new RetryExecutor(this.getCheckout.bind(this), `Unable to get checkout... Status Code: ${statusCode}`);
        }
    }

    private async checkoutPaymentForm() {
        this.updateStatus('Checkout payment form...', TaskStatusColor.Neutral);

        const endpoint = `https://www.amd.com/en/direct-buy/checkout/payment/${this.upstreamId}/us?ajax_form=1&_wrapper_format=drupal_ajax`;

        const headers = {
            authority: 'www.amd.com',
            'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
            accept: 'application/json, text/javascript, */*; q=0.01',
            'x-requested-with': 'XMLHttpRequest',
            'sec-ch-ua-mobile': '?0',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36',
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            origin: 'https://www.amd.com',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-mode': 'cors',
            'sec-fetch-dest': 'empty',
            referer: 'https://www.amd.com/en/direct-buy/5450881700/us',
            'accept-language': 'en-US,en;q=0.9',
            dnt: '1',
        };

        let form = new FormData();
        form.append('email', this.profile.shippingAddress.email);
        form.append('phone_number', this.profile.shippingAddress.phone);
        form.append('first_name', this.profile.shippingAddress.firstName);
        form.append('last_name', this.profile.shippingAddress.lastName);
        form.append('shop_country', 'US');
        form.append('address_line', this.profile.shippingAddress.address);
        form.append('address_line_1', this.profile.shippingAddress.secondaryAddress);
        form.append('city', this.profile.shippingAddress.city);
        form.append('state', this.profile.shippingAddress.stateCode);
        form.append('province', '');
        form.append('postal_code', this.profile.shippingAddress.zip);
        form.append('form_build_id', this.formBuildId);
        form.append('form_id', 'amd_shop_checkout_payment_form');
        form.append('_triggering_element_name', 'op');
        form.append('_triggering_element_value', 'Next Step');
        form.append('_drupal_ajax', '1');
        form.append('ajax_page_state[theme]', 'amd');
        form.append('ajax_page_state[theme_token]', '');
        form.append(
            'ajax_page_state[libraries]',
            'amd/amd-analytics,amd/amd-scripts,amd/global-styling,amd_core/analytics_secondary,amd_core/forms,amd_enterprise_recaptcha/google-enterprise-recaptcha,amd_shop_product/dr-terms-and-conditions,amd_shop_product/payment-form,amd_shop_product/set-cart-token,amd_shop_product/shopping-cart-actions,amd_shop_product/trigger-analytics-checkout-start,chosen/drupal.chosen,chosen_lib/chosen.css,core/drupal.states,core/html5shiv,core/jquery.form,system/base'
        );

        let response;
        try {
            const method = this.akamaiMethodBypass ? METHOD.PATCH : METHOD.POST;

            response = await this.request(endpoint, method, {
                headers: headers,
                body: form.getBuffer().toString(),
            });
        } catch (e) {
            this.handleConnectionErrorCustom(e, this.checkoutPaymentForm);
        }

        const statusCode = response?.statusCode as StatusCode;

        switch (statusCode) {
            case StatusCode.SUCCESS:
                const $ = cheerio.load(response.body);
                $('script')
                    .get()
                    .forEach((script) => {
                        if (script.attribs['data-drupal-selector']) {
                            let checkoutDataJson = JSON.parse(script.children[0].data);
                            this.sessionId = checkoutDataJson.cart.paymentSession.id;
                            this.clientSecret = checkoutDataJson.cart.paymentSession.clientSecret;
                            // checkoutDataJson.cart.paymentSession.id
                        }
                    });

                this.updateStatus(`Submitted payment form`, TaskStatusColor.Neutral);
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

                    let responseCookies = response?.headers['set-cookie'];
                    responseCookies.forEach((cookie) => {
                        if (cookie.includes('_abck=')) {
                            this.currentAbck = cookie.split('_abck')[1].split(';')[0];
                        }
                    });

                    if (!this.currentAbck) {
                        await this.handleAkamai();
                    } else {
                        await this.handleAkamai();
                    }

                    throw new RetryExecutor(this.checkoutPaymentForm.bind(this), 'Retrying - submit payment form');
                }

                throw new RetryExecutor(this.checkoutPaymentForm.bind(this), 'Unknown 403 error, retrying to submit payment form...');

            default:
                Env.isDev && this.debugHttpResponse(response);
                throw new RetryExecutor(this.checkoutPaymentForm.bind(this), `Unable to submit payment form... Status Code: ${statusCode}`);
        }
    }

    private async submitPaymentSource() {
        this.updateStatus('Submitting payment source...', TaskStatusColor.Neutral);

        const endpoint = `https://api.digitalriver.com/payments/sources`;

        const headers = {
            authority: 'www.digitalriver.com',
            'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
            accept: 'application/json, text/javascript, */*; q=0.01',
            'x-requested-with': 'XMLHttpRequest',
            'sec-ch-ua-mobile': '?0',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36',
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            origin: 'https://www.digitalriver.com',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-mode': 'cors',
            'sec-fetch-dest': 'empty',
            'accept-language': 'en-US,en;q=0.9',
            dnt: '1',
        };

        let response;
        try {
            const method = this.akamaiMethodBypass ? METHOD.PATCH : METHOD.POST;

            response = await this.request(endpoint, method, {
                headers: headers,
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    type: 'creditCard',
                    owner: {
                        firstName: this.profile.shippingAddress.firstName,
                        lastName: this.profile.shippingAddress.lastName,
                        email: this.profile.shippingAddress.email,
                        phoneNumber: this.profile.shippingAddress.phone,
                        address: {
                            line1: this.profile.shippingAddress.address,
                            line2: this.profile.shippingAddress.secondaryAddress,
                            city: this.profile.shippingAddress.city,
                            postalCode: this.profile.shippingAddress.zip,
                            country: 'US',
                            state: this.profile.shippingAddress.stateCode,
                        },
                    },
                    browserInfo: {
                        language: 'en-US',
                        colorDepth: 24,
                        screenHeight: 1080,
                        screenWidth: 1920,
                        timeZoneOffset: 480,
                        javaEnabled: false,
                        referrer: '',
                    },
                    creditCard: {
                        number: this.profile.payment.number.match(/.{1,4}/g)!.join(' '),
                        expirationMonth:
                            `${this.profile.payment.month}`.length === 1 ? `0${this.profile.payment.month}` : `${this.profile.payment.month}`, //'MM'
                        expirationYear:
                            `${this.profile.payment.year}`.length === 2 ? `20${this.profile.payment.year}` : `${this.profile.payment.year}`, // 'YYYY'
                        cvv: this.profile.payment.code,
                        returnUrl: '',
                    },
                }),
            });
        } catch (e) {
            this.handleConnectionErrorCustom(e, this.submitPaymentSource);
        }

        switch (response.statusCode) {
            case response.statusCode === 201:
                this.updateStatus(`Submitted payment source`, TaskStatusColor.Neutral);
                break;

            case response.statusCode === 403:
                let blockedMessage;
                for (const message of this.blockMessages) {
                    if (response?.body?.includes(message)) {
                        blockedMessage = message;
                        break;
                    }
                }

                if (blockedMessage) {
                    this.updateStatus(`Blocked by akamai, generating...`);

                    let responseCookies = response?.headers['set-cookie'];
                    responseCookies.forEach((cookie) => {
                        if (cookie.includes('_abck=')) {
                            this.currentAbck = cookie.split('_abck')[1].split(';')[0];
                        }
                    });

                    if (!this.currentAbck) {
                        await this.handleAkamai();
                    } else {
                        await this.handleAkamai();
                    }

                    throw new RetryExecutor(this.submitPaymentSource.bind(this), 'Retrying - submit payment source');
                }

                throw new RetryExecutor(this.submitPaymentSource.bind(this), 'Unknown 403 error, retrying to submit payment source...');

            default:
                Env.isDev && this.debugHttpResponse(response);
                throw new RetryExecutor(
                    this.submitPaymentSource.bind(this),
                    `Unable to submit payment source... Status Code: ${response.statusCode}`
                );
        }
    }

    private async registerPaymentSource() {
        this.updateStatus('Registering payment source...', TaskStatusColor.Neutral);

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

        const endpoint = `https://www.amd.com/en/register-source`;

        const headers = {
            authority: 'www.amd.com',
            'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
            accept: 'application/json, text/javascript, */*; q=0.01',
            'x-requested-with': 'XMLHttpRequest',
            'sec-ch-ua-mobile': '?0',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36',
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            origin: 'https://www.amd.com',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-mode': 'cors',
            'sec-fetch-dest': 'empty',
            'accept-language': 'en-US,en;q=0.9',
            dnt: '1',
        };

        let response;
        try {
            const method = this.akamaiMethodBypass ? METHOD.PATCH : METHOD.POST;

            response = await this.request(endpoint, method, {
                headers: headers,
                body: JSON.stringify({
                    PaymentMethod: {
                        clientId: 'gc',
                        channelId: 'amd',
                        liveMode: true,
                        id: this.clientSecret,
                        sessionId: this.sessionId,
                        clientSecret: this.clientSecret,
                        type: 'creditCard',
                        reusable: false,
                        owner: {
                            firstName: this.profile.shippingAddress.firstName,
                            lastName: this.profile.shippingAddress.lastName,
                            email: this.profile.shippingAddress.email,
                            phoneNumber: this.profile.shippingAddress.phone,
                            address: {
                                line1: this.profile.shippingAddress.address,
                                line2: this.profile.shippingAddress.secondaryAddress,
                                city: this.profile.shippingAddress.city,
                                state: this.profile.shippingAddress.stateCode,
                                country: 'US',
                                postalCode: this.profile.shippingAddress.zip,
                            },
                        },
                        amount: this.productPrice,
                        currency: 'USD',
                        state: 'chargeable',
                        upstreamId: this.upstreamId,
                        creationIp: '107.77.210.137',
                        createdTime: new Date().toISOString(),
                        updatedTime: new Date().toISOString(),
                        flow: 'standard',
                        creditCard: {
                            brand: cardType,
                            expirationMonth:
                                `${this.profile.payment.month}`.length === 1 ? `0${this.profile.payment.month}` : `${this.profile.payment.month}`, //'MM'
                            expirationYear:
                                `${this.profile.payment.year}`.length === 2 ? `20${this.profile.payment.year}` : `${this.profile.payment.year}`, // 'YYYY'
                            lastFourDigits: this.profile.payment.number.slice(this.profile.payment.number.length - 4),
                        },
                    },
                }),
            });
        } catch (e) {
            this.handleConnectionErrorCustom(e, this.registerPaymentSource);
        }

        switch (response.statusCode) {
            case response.statusCode === 201:
                this.updateStatus(`Submitted payment source`, TaskStatusColor.Neutral);
                break;

            case response.statusCode === 403:
                let blockedMessage;
                for (const message of this.blockMessages) {
                    if (response?.body?.includes(message)) {
                        blockedMessage = message;
                        break;
                    }
                }

                if (blockedMessage) {
                    this.updateStatus(`Blocked by akamai, generating...`);

                    let responseCookies = response?.headers['set-cookie'];
                    responseCookies.forEach((cookie) => {
                        if (cookie.includes('_abck=')) {
                            this.currentAbck = cookie.split('_abck')[1].split(';')[0];
                        }
                    });

                    if (!this.currentAbck) {
                        await this.handleAkamai();
                    } else {
                        await this.handleAkamai();
                    }

                    throw new RetryExecutor(this.registerPaymentSource.bind(this), 'Retrying - register payment source');
                }

                throw new RetryExecutor(this.registerPaymentSource.bind(this), 'Unknown 403 error, retrying to regiister payment source...');

            default:
                Env.isDev && this.debugHttpResponse(response);
                throw new RetryExecutor(
                    this.registerPaymentSource.bind(this),
                    `Unable to register payment source... Status Code: ${response.statusCode}`
                );
        }
    }

    private async getShippingPage() {
        this.updateStatus('Getting shipping...', TaskStatusColor.Neutral);

        const endpoint = `https://www.amd.com/en/direct-buy/checkout/shipping/${this.upstreamId}/us`;

        const headers = {
            authority: 'www.amd.com',
            'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
            accept: 'application/json, text/javascript, */*; q=0.01',
            'x-requested-with': 'XMLHttpRequest',
            'sec-ch-ua-mobile': '?0',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36',
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            origin: 'https://www.amd.com',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-mode': 'cors',
            'sec-fetch-dest': 'empty',
            referer: 'https://www.amd.com/en/direct-buy/5450881700/us',
            'accept-language': 'en-US,en;q=0.9',
            dnt: '1',
        };

        let response;
        try {
            const method = this.akamaiMethodBypass ? METHOD.PATCH : METHOD.GET;

            response = await this.request(endpoint, method, {
                headers: headers,
            });
        } catch (e) {
            this.handleConnectionErrorCustom(e, this.getShippingPage);
        }

        const statusCode = response?.statusCode as StatusCode;

        switch (statusCode) {
            case StatusCode.SUCCESS:
                this.formBuildId =
                    response?.body
                        ?.split(
                            `value="Next Step" class="button js-form-submit form-submit" />\n</div><input autocomplete="off" data-drupal-selector="`
                        )[1]
                        .split(`" type="hidden" name="form_build_id" value="`)[1]
                        .split(`" />`)[0] || '';
                this.updateStatus(`Got shipping`, TaskStatusColor.Neutral);
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

                    let responseCookies = response?.headers['set-cookie'];
                    responseCookies.forEach((cookie) => {
                        if (cookie.includes('_abck=')) {
                            this.currentAbck = cookie.split('_abck')[1].split(';')[0];
                        }
                    });

                    if (!this.currentAbck) {
                        await this.handleAkamai();
                    } else {
                        await this.handleAkamai();
                    }

                    throw new RetryExecutor(this.getShippingPage.bind(this), 'Retrying - get shipping');
                }

                throw new RetryExecutor(this.getShippingPage.bind(this), 'Unknown 403 error, retrying to get shipping...');

            default:
                Env.isDev && this.debugHttpResponse(response);
                throw new RetryExecutor(this.getShippingPage.bind(this), `Unable to get shipping... Status Code: ${statusCode}`);
        }
    }

    private async selectShipping() {
        this.updateStatus('Selecting shipping...', TaskStatusColor.Neutral);

        const endpoint = `https://www.amd.com/en/direct-buy/checkout/shipping/${this.upstreamId}/us?ajax_form=1&_wrapper_format=drupal_ajax`;

        const headers = {
            authority: 'www.amd.com',
            'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
            accept: 'application/json, text/javascript, */*; q=0.01',
            'x-requested-with': 'XMLHttpRequest',
            'sec-ch-ua-mobile': '?0',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36',
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            origin: 'https://www.amd.com',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-mode': 'cors',
            'sec-fetch-dest': 'empty',
            referer: 'https://www.amd.com/en/direct-buy/5450881700/us',
            'accept-language': 'en-US,en;q=0.9',
            dnt: '1',
        };

        let form = new FormData();
        form.append('email', this.profile.shippingAddress.email);
        form.append('phone_number', this.profile.shippingAddress.phone);
        form.append('first_name', this.profile.shippingAddress.firstName);
        form.append('last_name', this.profile.shippingAddress.lastName);
        form.append('shop_country', 'US');
        form.append('address_line', this.profile.shippingAddress.address);
        form.append('address_line_1', this.profile.shippingAddress.secondaryAddress);
        form.append('city', this.profile.shippingAddress.city);
        form.append('state', this.profile.shippingAddress.stateCode);
        form.append('province', '');
        form.append('postal_code', this.profile.shippingAddress.zip);
        // Parse shipping TODO
        form.append('shipping_option', '4857023900');
        form.append('form_build_id', this.formBuildId);
        form.append('form_id', 'amd_shop_checkout_payment_form');
        form.append('_triggering_element_name', 'op');
        form.append('_triggering_element_value', 'Next Step');
        form.append('_drupal_ajax', '1');
        form.append('ajax_page_state[theme]', 'amd');
        form.append('ajax_page_state[theme_token]', '');
        form.append(
            'ajax_page_state[libraries]',
            'amd/amd-analytics,amd/amd-scripts,amd/global-styling,amd_core/analytics_secondary,amd_core/forms,amd_enterprise_recaptcha/google-enterprise-recaptcha,amd_shop_product/dr-terms-and-conditions,amd_shop_product/payment-form,amd_shop_product/set-cart-token,amd_shop_product/shopping-cart-actions,amd_shop_product/trigger-analytics-checkout-start,chosen/drupal.chosen,chosen_lib/chosen.css,core/drupal.states,core/html5shiv,core/jquery.form,system/base'
        );

        let response;
        try {
            const method = this.akamaiMethodBypass ? METHOD.PATCH : METHOD.POST;

            response = await this.request(endpoint, method, {
                headers: headers,
                body: form.getBuffer().toString(),
            });
        } catch (e) {
            this.handleConnectionErrorCustom(e, this.selectShipping);
        }

        const statusCode = response?.statusCode as StatusCode;

        switch (statusCode) {
            case StatusCode.SUCCESS:
                // this.formBuildId = response?.body?.split(`value="Next Step" class="button js-form-submit form-submit" />\n</div><input autocomplete="off" data-drupal-selector="`)[1].split(`" type="hidden" name="form_build_id" value="`)[1].split(`" />`)[0] || '';
                this.updateStatus(`Selected shipping`, TaskStatusColor.Neutral);
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

                    let responseCookies = response?.headers['set-cookie'];
                    responseCookies.forEach((cookie) => {
                        if (cookie.includes('_abck=')) {
                            this.currentAbck = cookie.split('_abck')[1].split(';')[0];
                        }
                    });

                    await this.handleAkamai();
                    throw new RetryExecutor(this.selectShipping.bind(this), 'Retrying - select shipping');
                }

                throw new RetryExecutor(this.selectShipping.bind(this), 'Unknown 403 error, retrying to select shipping...');

            default:
                Env.isDev && this.debugHttpResponse(response);
                throw new RetryExecutor(this.selectShipping.bind(this), `Unable to select shipping... Status Code: ${statusCode}`);
        }
    }

    private async submitCheckoutCaptcha() {
        this.updateStatus('Submitting checkout captcha...', TaskStatusColor.Neutral);

        const endpoint = `https://www.amd.com/en/direct-buy/validate-recaptcha`;

        const headers = {
            authority: 'www.amd.com',
            'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
            accept: 'application/json, text/javascript, */*; q=0.01',
            'x-requested-with': 'XMLHttpRequest',
            'sec-ch-ua-mobile': '?0',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36',
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            origin: 'https://www.amd.com',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-mode': 'cors',
            'sec-fetch-dest': 'empty',
            referer: 'https://www.amd.com/en/direct-buy/5450881700/us',
            'accept-language': 'en-US,en;q=0.9',
            dnt: '1',
        };

        let response;
        try {
            const method = this.akamaiMethodBypass ? METHOD.PUT : METHOD.POST;

            response = await this.request(endpoint, method, {
                headers: headers,
                body: JSON.stringify({ 'g-recaptcha-response': this.captchaToken, action: 'SUBMIT_ORDER' }),
            });
        } catch (e) {
            this.handleConnectionErrorCustom(e, this.submitCheckoutCaptcha);
        }

        const statusCode = response?.statusCode as StatusCode;

        switch (statusCode) {
            case StatusCode.SUCCESS:
                try {
                    let responseJson = JSON.parse(response.body);
                    if (responseJson.userIsValid === true) {
                        this.updateStatus(`Submitted checkout captcha`, TaskStatusColor.Neutral);
                        break;
                    } else {
                        throw new RetryExecutor(
                            this.submitCheckoutCaptcha.bind(this),
                            `Unable to submit checkout captch... Status code: ${statusCode}`
                        );
                    }
                } catch (e) {
                    throw new RetryExecutor(this.submitCheckoutCaptcha.bind(this), `Unable to submit checkout captch... Status code: ${statusCode}`);
                }

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

                    let responseCookies = response?.headers['set-cookie'];
                    responseCookies.forEach((cookie) => {
                        if (cookie.includes('_abck=')) {
                            this.currentAbck = cookie.split('_abck')[1].split(';')[0];
                        }
                    });

                    if (!this.currentAbck) {
                        await this.handleAkamai();
                    } else {
                        await this.handleAkamai();
                    }

                    throw new RetryExecutor(this.submitCheckoutCaptcha.bind(this), 'Retrying - submit checkout captcha');
                }

                throw new RetryExecutor(this.submitCheckoutCaptcha.bind(this), 'Unknown 403 error, retrying to submit checkout captcha...');

            default:
                Env.isDev && this.debugHttpResponse(response);
                throw new RetryExecutor(this.submitCheckoutCaptcha.bind(this), `Unable to submit checkout captcha... Status Code: ${statusCode}`);
        }
    }

    async solveRecaptcha() {
        const { body } = await got.get('http://localhost:8080/fetch');
        this.captchaToken = body;
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

        headers = { ...headers, Host: 'www.amd.com', Connection: 'close' };

        const responseTypeCustom = options.json ? { json: true } : {};
        const url = endpoint.includes('https') ? endpoint : `https://www.amd.com/${endpoint}`;

        const customRequestOptions = {
            method,
            url,
            headers,
            ...bodyObj,
            jar: this.customCookieJar,
            proxy: this.proxy?.getUrl(),
            ...responseTypeCustom,
        };

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

    private handleConnectionErrorCustom(e: any, retry?: () => Promise<void>) {
        let errorMsg;
        switch (e?.toString()) {
            case ConnectionError.Request:
                this.rotateProxy();
                errorMsg = `Failed to connect to proxy, rotating...`;
                break;
            // bad proxy ?
            case ConnectionError.Timeout:
                Logger.log(e, Env.isDev);
                errorMsg = 'Connection timed out, site is overloaded...';
                break;

            default:
                Logger.log(e, Env.isDev);
                errorMsg = 'Unknown';
                break;
        }

        if (retry) {
            throw new RetryExecutor(retry.bind(this), `Connection Error Occurred: ${errorMsg}`);
        }
        this.updateStatus(`Connection Error Occurred: ${errorMsg}`, TaskStatusColor.Warning);
    }

    private async handleAkamai() {
        let solvedChallenge = true;

        if (!this.currentAbck) {
            await this.getInvalidAbck();
        }

        await this.getSensor();
        let firstSolvedAbck = await this.postSensor();

        console.log(firstSolvedAbck);
        if (firstSolvedAbck.includes('||')) {
            if (firstSolvedAbck.includes('|-1|')) {
                solvedChallenge = true;
            } else {
                solvedChallenge = false;
            }
        }

        while (!solvedChallenge) {
            console.log('hi');

            // await this.getChallengeSensor();
            await this.getSensor();
            // let challengeResponseCookie = await this.postChallengeSensor();
            let challengeResponseCookie = await this.postSensor();
            console.log(challengeResponseCookie);
            if (challengeResponseCookie.includes('||')) {
                if (challengeResponseCookie.includes('|-1|')) {
                    solvedChallenge = true;
                } else {
                    solvedChallenge = false;
                }
            }
        }
        this.updateStatus('Generated Akamai', TaskStatusColor.Neutral);
        return;
    }

    private async getInvalidAbck() {
        this.updateStatus('Generating Akamai....');

        let response;
        try {
            const method = METHOD.GET;
            response = await this.request(`https://www.amd.com/_wk5Z3za7pbMKvi7xfxU/V1f3NzwDta/bxsOIQlM/Tk44J2s/fYUI`, method, {
                headers: {
                    authority: 'www.amd.com',
                    'x-sec-clge-req-type': 'ajax',
                    'sec-ch-ua-mobile': '?0',
                    'user-agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.190 Safari/537.36',
                    'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
                    'content-type': 'text/plain;charset=UTF-8',
                    accept: '*/*',
                    origin: 'https://www.amd.com',
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    referer: 'https://www.amd.com/',
                    'accept-language': 'en-US,en;q=0.9',
                },
            });
        } catch (e) {
            this.handleConnectionErrorCustom(e, this.getSensor);
        }

        if (response.statusCode === 200) {
            try {
                let responseCookies = response?.headers['set-cookie'];
                responseCookies.forEach((cookie) => {
                    if (cookie.includes('_abck=')) {
                        this.currentAbck = cookie.split('_abck=')[1].split(';')[0];
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
                    site: 'www.amd.com',
                    abck: this.currentAbck,
                    type: 'sensor',
                    events: '0,1',
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
            let akamaiEndpoint = `https://www.amd.com/_wk5Z3za7pbMKvi7xfxU/V1f3NzwDta/bxsOIQlM/Tk44J2s/fYUI`;
            response = await this.request(akamaiEndpoint, method, {
                headers: {
                    authority: 'www.amd.com',
                    'x-sec-clge-req-type': 'ajax',
                    'sec-ch-ua-mobile': '?0',
                    'user-agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.190 Safari/537.36',
                    'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
                    'content-type': 'text/plain;charset=UTF-8',
                    accept: '*/*',
                    origin: 'https://www.amd.com',
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    referer: 'https://www.amd.com/',
                    'accept-language': 'en-US,en;q=0.9',
                },
                body: JSON.stringify({
                    sensor_data: this.sensorData,
                }),
            });
        } catch (e) {
            this.handleConnectionErrorCustom(e, this.postSensor);
        }

        if (response.statusCode === 200 || response.statusCode === 201) {
            let abck;

            response.headers['set-cookie'].forEach((cookie) => {
                if (cookie.includes('_abck')) {
                    abck = cookie.split('_abck=')[1].split('; Domain')[0];
                    this.currentAbck = cookie.split('_abck=')[1].split('; Domain')[0];
                }
            });

            return abck;
        } else {
            throw new RetryExecutor(this.postSensor.bind(this), `Error posting sensor data...`);
        }
    }

    private async getChallengeSensor() {
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
                    site: 'www.amd.com',
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
}
