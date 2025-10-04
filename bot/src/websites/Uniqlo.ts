import { sleep } from '../../../lib/helpers';
import { TaskEvent, TaskStatusColor } from '../../../lib/models/taskUpdate';
import BotTask, { BotTaskProperties } from '../models/tasks/botTask';
import { CaptchaTask, CaptchaType } from '../models/captchaSolvers/captchaSolver';
import TwoCaptcha from '../models/captchaSolvers/twoCaptcha';
import { RetryExecutor, StopTask } from '../../../lib/errors';
import { stopRequestHook } from '../utils/hooks';
import isFormData from '../utils/isFormData';
import getBodySize from '../utils/getBodySize';
import FormData from 'form-data';
import Size from '../../../lib/models/size';
import is from '@sindresorhus/is';
import got, { Options } from 'got';
import { randomNumber } from '../../../cli/src/utils/helpers';
import creditCardType from 'credit-card-type';
import Logger from '../../../cli/src/utils/logger';
import Env from '../env';
import Akamai from '../utils/akamai';
import fs from 'fs';
import { env } from 'process';

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
    XXSmall = 1000,
    XSmall = 2000,
    Small = 3000,
    Medium = 4000,
    Large = 5000,
    XLarge = 6000,
    XXLarge = 7000,
    XXXLarge = 8000,
}

export enum UniqloSizes {
    XXSmall = 'XXS',
    XSmall = 'XS',
    Small = 'S',
    Medium = 'M',
    Large = 'L',
    XLarge = 'XL',
    XXLarge = 'XXL',
    XXXLarge = 'XXXL',
}


export default class Uniqlo extends BotTask {
    
    private beforeHook() {
        stopRequestHook(this.shouldStopTask);
    }

    private shippingSecureKey: string = '';
    private billingSecureKey: string = '';
    private cardNumberFieldNameExtension: string = '';
    private cardCvvFieldNameExtension: string = '';
    
    protected *execute() {
        yield this.starting();

        let size;
        let sizes;
        if (this.task.sizes.userSelectedSizes.size === 0 && !this.task.sizes.isRandom()) {

        } else if (this.task.sizes.isRandom()) {
            sizes = [...this.task.sizes.siteSupportedSizes].filter((size) => size !== 'random');
            size = sizes[randomNumber(0, sizes.length - 1)];
            this.task.product.size = new Size(`${this.getSizeCode(size as UniqloSizes)}`, size);
            this.task.product.id = this.task.product.id.substring(0, this.task.product.id.length-4) + this.task.product.size.value
        } else {
            sizes = [...this.task.sizes.userSelectedSizes];
            size = sizes[randomNumber(0, sizes.length - 1)];
            this.task.product.size = new Size(`${this.getSizeCode(size as UniqloSizes)}`, size);
            this.task.product.id = this.task.product.id.substring(0, this.task.product.id.length-4) + this.task.product.size.value
        }
        

        yield this.addToCart();
        yield this.getShipping();
        yield this.submitShipping();
        yield this.getCardNumberFieldName();
        yield this.submitBilling();
        yield this.placeOrder();
    }


    private lag: number;
    private tries = 0;
    private monitorTries = 0;

    constructor(botTaskProps: BotTaskProperties) {
        super(botTaskProps);
        this.lag = parseInt(botTaskProps.profile.id, 10) * 1000;
    }

    private async starting() {
        this.updateStatus('Starting', TaskStatusColor.Neutral);
        await sleep(1000 + this.lag);
    }

    /**
     *
     * monitor must be a while loop (retry executors will cause the script to pause)
     */

    private async addToCart() {
        this.updateStatus('Adding to cart...', TaskStatusColor.Neutral);
        let failedAttempts = 0;
        loop: while (!this.shouldStopTask) {

            let response;

            try {
                const method = METHOD.POST;
                let  url = `https://www.uniqlo.com/on/demandware.store/Sites-UniqloUS-Site/default/Cart-AddProduct?format=ajax`;
                let headers = {
                        'authority': 'www.uniqlo.com',
                        'pragma': 'no-cache',
                        'cache-control': 'no-cache',
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'x-i1ysm4mm-z': 'q',
                        'sec-ch-ua-mobile': '?0',
                        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'accept': '*/*',
                        'x-requested-with': 'XMLHttpRequest',
                        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
                        'origin': 'https://www.uniqlo.com',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'accept-language': 'en-US,en;q=0.9',
                }
                let body = `cartAction=add&pid=${this.task.product.id}&name=&test=&alterationProductCheck=&alterationProductPrice=&alterationProductName=&alterationProductLength=&alterationProductSleeveLength=&Quantity=${this.task.atcQuantity}`;

                response = await this.request(url, method, { headers, body });

                // fs.appendFile('bruh.txt', response.body, function (err) {
                //     if (err) throw err;
                //   });
                if (response.statusCode == 200) {
                    if (response.body?.length > 1) {
                        this.task.product.name = response.body.split("Go to Product: ")[1].split('">')[0];
                        this.task.product.price = response.body.split('<span class="label"></span>\n\n<span class="value">')[1].split("</span>")[0];
                        this.task.product.image = response.body.split('.html"><img src="')[1].split('" alt="')[0];
                        this.updateStatus(`Added to cart.`, TaskStatusColor.Info);
                        return;
                    } else {
                        failedAttempts += 1;
                        this.setStatus(`Failed to add to cart`, TaskStatusColor.Warning);
                        await sleep(this.retryDelay)
                        continue loop;
                    }
                } else {
                    console.log(response.statusCode)
                    this.setStatus(`Error adding to cart`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    await sleep(this.retryDelay)
                    continue loop;
                }
            } catch (e) {
                failedAttempts += 1;
                this.setStatus(`Failed to add to cart`, TaskStatusColor.Warning);
                await sleep(this.retryDelay)
                continue loop;
            }
        }
    }

    private async getCheckout() {
        this.updateStatus('Getting checkout...', TaskStatusColor.Neutral);
        let failedAttempts = 0;
        loop: while (!this.shouldStopTask) {

            let response;

            try {
                const method = METHOD.GET;
                let  url = `https://www.uniqlo.com/us/en/checkout/`;
                let headers = {
                        'authority': 'www.uniqlo.com',
                        'pragma': 'no-cache',
                        'cache-control': 'no-cache',
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'sec-ch-ua-mobile': '?0',
                        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'accept': '*/*',
                        'x-requested-with': 'XMLHttpRequest',
                        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
                        'origin': 'https://www.uniqlo.com',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'accept-language': 'en-US,en;q=0.9',
                }

                response = await this.request(url, method, { headers });

                if (response.statusCode == 200) {
                    if (response.body?.length > 1) {
                        this.updateStatus(`Got checkout.`, TaskStatusColor.Info);
                        return;
                    } else {
                        failedAttempts += 1;
                        this.setStatus(`Failed to get checkout page`, TaskStatusColor.Warning);
                        await sleep(this.retryDelay)
                        continue loop;
                    }
                } else {
                    console.log(response.statusCode)
                    this.setStatus(`Error getting checkout`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    await sleep(this.retryDelay)
                    continue loop;
                }
            } catch (e) {
                console.log(e)
                failedAttempts += 1;
                this.setStatus(`Failed to get checkout`, TaskStatusColor.Warning);
                await sleep(this.retryDelay)
                continue loop;
            }
        }
    }

    private async getShipping() {
        this.updateStatus('Getting shipping...', TaskStatusColor.Neutral);
        let failedAttempts = 0;
        loop: while (!this.shouldStopTask) {

            let response;

            try {
                const method = METHOD.GET;
                let  url = `https://www.uniqlo.com/us/en/shipping-checkout/`;
                let headers = {
                        'authority': 'www.uniqlo.com',
                        'pragma': 'no-cache',
                        'cache-control': 'no-cache',
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'sec-ch-ua-mobile': '?0',
                        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'accept': '*/*',
                        'x-requested-with': 'XMLHttpRequest',
                        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
                        'origin': 'https://www.uniqlo.com',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'accept-language': 'en-US,en;q=0.9',
                }

                response = await this.request(url, method, { headers });

                if (response.statusCode == 200) {
                    if (response.body.includes("Due to low stock, the quantity of one or more of your items below has been updated")) {
                        failedAttempts += 1;
                        // fs.appendFile('bruh.txt', response.body, function (err) {
                        //     if (err) throw err;
                        //   });
                        this.setStatus(`Product OOS, retrying...`, TaskStatusColor.Warning);
                        await sleep(this.retryDelay)
                        continue loop;
                    } else if (response.body?.length > 1) {
                       
                        this.shippingSecureKey = response.body?.split('name="dwfrm_singleshipping_securekey" value="')[1].split('"')[0];
                        this.updateStatus(`Got shipping.`, TaskStatusColor.Info);
                        return;
                    } else {
                        failedAttempts += 1;
                        this.setStatus(`Failed to get shipping`, TaskStatusColor.Warning);
                        await sleep(this.retryDelay)
                        continue loop;
                    }
                } else {
                    this.setStatus(`Error getting shipping`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    await sleep(this.retryDelay)
                    continue loop;
                }
            } catch (e) {
                failedAttempts += 1;
                this.setStatus(`Failed to get shipping`, TaskStatusColor.Warning);
                await sleep(this.retryDelay)
                continue loop;
            }
        }
    }

    private async submitShipping() {
        this.updateStatus('Submitting shipping...', TaskStatusColor.Neutral);
        let failedAttempts = 0;
        loop: while (!this.shouldStopTask) {

            let response;

            try {
                // POSTing to the billing URL but it is actually submitting shipping information
                const method = METHOD.POST;
                let  url = `https://www.uniqlo.com/us/en/billing-checkout/`;
                let headers = {
                        'authority': 'www.uniqlo.com',
                        'pragma': 'no-cache',
                        'cache-control': 'no-cache',
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'sec-ch-ua-mobile': '?0',
                        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'accept': '*/*',
                        'x-requested-with': 'XMLHttpRequest',
                        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
                        'origin': 'https://www.uniqlo.com',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'accept-language': 'en-US,en;q=0.9',
                        'referer': 'https://www.uniqlo.com/us/en/shipping-checkout/'
                }

                let month = this.profile.payment.month.toString();
                response = await this.request(url, method, { 
                    headers,
                    body: `isStorePickupDisabled=false&isOWS=false&isBillingClick=false&isGuestCustomerNewsletterSubscribe=false&isshippingPayPal=null&dwfrm_singleshipping_deliveryMethods_selectedDeliveryMethodID=homedelivery&dwfrm_storelocator_postalCode=&zipCode=&dwfrm_singleshipping_shippingAddress_addressFields_firstName=${this.profile.shippingAddress.firstName}&dwfrm_singleshipping_shippingAddress_addressFields_lastName=${this.profile.shippingAddress.lastName}&dwfrm_singleshipping_shippingAddress_addressFields_address1=${this.profile.shippingAddress.address}&dwfrm_singleshipping_shippingAddress_addressFields_address2=${this.profile.shippingAddress.secondaryAddress}&dwfrm_singleshipping_shippingAddress_addressFields_country=${this.profile.shippingAddress.country}&dwfrm_singleshipping_shippingAddress_addressFields_states_state=${this.profile.shippingAddress.stateCode}&dwfrm_singleshipping_shippingAddress_addressFields_city=${this.profile.shippingAddress.city}&dwfrm_singleshipping_shippingAddress_addressFields_postal=${this.profile.shippingAddress.zip}&dwfrm_singleshipping_shippingAddress_addressFields_phone=${this.profile.shippingAddress.phone}&dwfrm_singleshipping_shippingAddress_email_emailAddress=${this.profile.shippingAddress.email}&smallQuantity=0&mediumQuantity=0&largeQuantity=0&isCustAuthenticated=false&poaddress=false&dwfrm_singleshipping_shippingAddress_shippingMethodID=001&dwfrm_singleshipping_shippingAddress_create_password=&dwfrm_singleshipping_shippingAddress_create_passwordconfirm=&dwfrm_singleshipping_shippingAddress_save=Continue&dwfrm_singleshipping_securekey=${this.shippingSecureKey}&bypassDAV=false`
                });

                if (response.statusCode == 200) {
                    if (response.body?.length > 1) {
                        this.updateStatus(`Submitted shipping.`, TaskStatusColor.Info);
                        return;
                    } else {
                        failedAttempts += 1;
                        this.setStatus(`Failed to submit shipping info`, TaskStatusColor.Warning);
                        await sleep(this.retryDelay)
                        continue loop;
                    }
                } else {
                    console.log(response.statusCode)
                    console.log(response.headers['location'])
                    this.setStatus(`Error submitting shipping`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    continue loop;
                }
            } catch (e) {
                console.log(e)
                failedAttempts += 1;
                this.setStatus(`Failed to submit shipping`, TaskStatusColor.Warning);
                await sleep(this.retryDelay)
                continue loop;
            }
        }
    }

    private async getCardNumberFieldName() {
        this.updateStatus('Getting fields...', TaskStatusColor.Neutral);
        let failedAttempts = 0;
        loop: while (!this.shouldStopTask) {

            let response;

            try {
                // The card number field has a weird value added to the end in browser, here we grab it. Example: "dwfrm_billing_paymentMethods_creditCard_number_d0xbxemsphtg"
                const method = METHOD.GET;
                let  url = `https://www.uniqlo.com/us/en/Billing/`;
                let headers = {
                        'authority': 'www.uniqlo.com',
                        'pragma': 'no-cache',
                        'cache-control': 'no-cache',
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'sec-ch-ua-mobile': '?0',
                        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'accept': '*/*',
                        'x-requested-with': 'XMLHttpRequest',
                        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
                        'origin': 'https://www.uniqlo.com',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'accept-language': 'en-US,en;q=0.9',
                }

                response = await this.request(url, method, { headers });

                if (response.statusCode == 200) {
                    if (response.body?.length > 1) {
                        this.cardNumberFieldNameExtension = response.body?.split('dwfrm_billing_paymentMethods_creditCard_number_')[1].split('"')[0];
                        this.cardCvvFieldNameExtension = response.body?.split('dwfrm_billing_paymentMethods_creditCard_cvn_')[1].split('"')[0];
                        this.billingSecureKey = response.body?.split('name="dwfrm_billing_securekey" value="')[1].split('"')[0];

                        this.updateStatus(`Got fields.`, TaskStatusColor.Info);
                        return;
                    } else {
                        failedAttempts += 1;
                        this.setStatus(`Failed to get fields`, TaskStatusColor.Warning);
                        await sleep(this.retryDelay)
                        continue loop;
                    }
                } else {
                    console.log(response.statusCode)
                    this.setStatus(`Error getting fields`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    await sleep(this.retryDelay)
                    continue loop;
                }
            } catch (e) {
                failedAttempts += 1;
                this.setStatus(`Failed to get fields`, TaskStatusColor.Warning);
                await sleep(this.retryDelay)
                continue loop;
            }
        }
    }

    private async submitBilling() {
        this.updateStatus('Submitting billing...', TaskStatusColor.Neutral);
        let failedAttempts = 0;
        loop: while (!this.shouldStopTask) {

            let response;
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
            try {
                const method = METHOD.POST;
                let  url = `https://www.uniqlo.com/us/en/billing-form/`;
                let headers = {
                        'authority': 'www.uniqlo.com',
                        'pragma': 'no-cache',
                        'cache-control': 'no-cache',
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'sec-ch-ua-mobile': '?0',
                        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'accept': '*/*',
                        'x-requested-with': 'XMLHttpRequest',
                        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
                        'origin': 'https://www.uniqlo.com',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'accept-language': 'en-US,en;q=0.9',
                        'referer': 'https://www.uniqlo.com/us/en/shipping-checkout/'
                }


                response = await this.request(url, method, { 
                    headers,
                    body: `dwfrm_billing_save=true&dwfrm_billing_billingAddress_useAsBillingAddress=true&dwfrm_billing_billingAddress_addressFields_firstName=${this.profile.billingAddress?.firstName}&dwfrm_billing_billingAddress_addressFields_lastName=${this.profile.billingAddress?.lastName}&dwfrm_billing_billingAddress_addressFields_address1=${this.profile.billingAddress?.address}&dwfrm_billing_billingAddress_addressFields_address2=${this.profile.billingAddress?.secondaryAddress}&dwfrm_billing_billingAddress_addressFields_country=${this.profile.billingAddress?.country}&dwfrm_billing_billingAddress_addressFields_states_state=${this.profile.billingAddress?.stateCode}&dwfrm_billing_billingAddress_addressFields_otherstate=&dwfrm_billing_billingAddress_addressFields_city=${this.profile.billingAddress?.city}&dwfrm_billing_billingAddress_addressFields_postal=${this.profile.billingAddress?.zip}&dwfrm_billing_billingAddress_addressFields_phone=${this.profile.billingAddress?.phone}&dwfrm_billing_securekey=${this.billingSecureKey}&isOWS=false&dwfrm_billing_giftCertCode=&dwfrm_billing_giftCertPin=&dwfrm_billing_paymentMethods_selectedPaymentMethodID=CREDIT_CARD&dwfrm_billing_paymentMethods_creditCard_owner=${this.profile.billingAddress?.firstName}+${this.profile.billingAddress?.lastName}&dwfrm_billing_paymentMethods_creditCard_type=${cardType}&dwfrm_billing_paymentMethods_creditCard_number_${this.cardNumberFieldNameExtension}=${this.profile.payment.number}&dwfrm_billing_paymentMethods_creditCard_expiration_month=${this.profile.payment.month}&dwfrm_billing_paymentMethods_creditCard_expiration_year=${this.profile.payment.year}&dwfrm_billing_paymentMethods_creditCard_cvn_${this.cardCvvFieldNameExtension}=${this.profile.payment.code}&dwfrm_billing_paymentMethods_bml_year=&dwfrm_billing_paymentMethods_bml_month=&dwfrm_billing_paymentMethods_bml_day=&dwfrm_billing_paymentMethods_bml_ssn=&dwfrm_billing_save=Continue&bypassDAV=false&isCustAuthenticated=false`
                });

                if (response.statusCode == 200) {
                    if (response.body?.length > 1) {
                        this.updateStatus(`Submitted billing.`, TaskStatusColor.Info);
                        return;
                    } else {
                        failedAttempts += 1;
                        this.setStatus(`Failed to submit billing info`, TaskStatusColor.Warning);
                        await sleep(this.retryDelay)
                        continue loop;
                    }
                } else {
                    this.setStatus(`Error submitting billing`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    continue loop;
                }
            } catch (e) {
                console.log(e)
                failedAttempts += 1;
                this.setStatus(`Failed to submit billing`, TaskStatusColor.Warning);
                await sleep(this.retryDelay)
                continue loop;
            }
        }
    }

    private async placeOrder() {
        this.updateStatus('Placing order...', TaskStatusColor.Neutral);
        let failedAttempts = 0;
        loop: while (!this.shouldStopTask) {

            let response;

            try {
                const method = METHOD.POST;
                let  url = `https://www.uniqlo.com/us/en/order-confirmation/`;
                let headers = {
                        'authority': 'www.uniqlo.com',
                        'pragma': 'no-cache',
                        'cache-control': 'no-cache',
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'sec-ch-ua-mobile': '?0',
                        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'accept': '*/*',
                        'x-requested-with': 'XMLHttpRequest',
                        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
                        'origin': 'https://www.uniqlo.com',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'accept-language': 'en-US,en;q=0.9',
                        'referer': 'https://www.uniqlo.com/us/en/shipping-checkout/'
                }


                response = await this.request(url, method, { 
                    headers,
                    body: `dwfrm_singleshipping_securekey=${this.shippingSecureKey}&recaptchaTokenValue=&isShippingSelected=false&meSelected=&customeremailSelected=${this.profile.shippingAddress.email}`
                });



                if (response.statusCode === 200 && response.body.includes("Thank you for your order")) {
                    this.task.orderId = response.body.split('<span class="label">Order Number:</span>\n<span class="value">')[1].split("</span>")[0];
                    this.setStatus(`Payment Successful`, TaskStatusColor.Success, TaskEvent.CheckoutSuccess);
                    return;
                } else {
                    this.setStatus(`Payment Failure`, TaskStatusColor.Error, TaskEvent.CheckoutDecline);
                    return
                }
            } catch (e) {
                console.log(e)
                failedAttempts += 1;
                this.setStatus(`Failed to submit billing`, TaskStatusColor.Warning);
                await sleep(this.retryDelay)
                continue loop;
            }
        }
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

    private getSizeCode = (size: UniqloSizes) => {
        switch (size) {
            case UniqloSizes.XXSmall:
                return SizeCodes.XXSmall;
            case UniqloSizes.XSmall:
                return SizeCodes.XSmall;
            case UniqloSizes.Small:
                return SizeCodes.Small;
            case UniqloSizes.Medium:
                return SizeCodes.Medium;
            case UniqloSizes.Large:
                return SizeCodes.Large;
            case UniqloSizes.XLarge:
                return SizeCodes.XLarge;
            case UniqloSizes.XXLarge:
                return SizeCodes.XXLarge;
        }
    };
}
