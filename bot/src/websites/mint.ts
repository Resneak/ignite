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
import { footsiteSizes } from '../../../lib/data/sizes';
import fs from 'fs';
import { HawkPerimeterX } from '../utils/perimeterx';
import { Cookie } from 'tough-cookie';

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


export default class Mint extends BotTask {
    
    private beforeHook() {
        stopRequestHook(this.shouldStopTask);
    }

    private loginSecureKey: string = '';
    private loginDwcont: string = '';
    private dwcont: string = '';
    private shippingSecureKey: string = '';
    private billingSecureKey: string = '';
    private cardNumberFieldNameExtension: string = '';
    private cardCvvFieldNameExtension: string = '';
    private userAgent: string = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36';

    private isHoldCaptchaEnabled = true;
    private HawkSolver: HawkPerimeterX = new HawkPerimeterX('PXycad5FBr', 'https://catalog.usmint.gov');
    private PXService?: 'hawk';

    private captchacount = 0;

    private pxTries = 0;
    protected *execute() {
        yield this.starting();
        this.rotateProxy();
        this.userAgent = 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1';

        // yield this.getProduct();
        // yield this.getcookie();
        yield this.getSignInPage();
        yield this.signIn();

        yield this.addToCart();
        this.pxTries = 0;
        // yield this.selectGuest();
        yield this.getCart();
        this.pxTries = 0;
        yield this.submitShipping();
        this.pxTries = 0;
        yield this.submitBilling();
        this.pxTries = 0;
        yield this.placeOrder();
        this.pxTries = 0;
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

    private async getSignInPage() {
        this.updateStatus('Getting sign in page...', TaskStatusColor.Neutral);
        let failedAttempts = 0;
        loop: while (!this.shouldStopTask) {

            let response;

            try {
                const method = METHOD.GET;
                let  url = `https://catalog.usmint.gov/account-login`;
                let headers = {
                    'authority': 'catalog.usmint.gov',
                    'pragma': 'no-cache',
                    'cache-control': 'no-cache',
                    'sec-ch-ua': '"Chromium";v="92", " Not A;Brand";v="99", "Google Chrome";v="92"',
                    'accept': '*/*',
                    'x-requested-with': 'XMLHttpRequest',
                    'sec-ch-ua-mobile': '?0',
                    'user-agent': this.userAgent,
                    'origin': 'https://catalog.usmint.gov',
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    'accept-language': 'en-US,en;q=0.9',
                    'dnt': '1',
                    'x-px-bypass-reason': `The%20certificate%20for%20this%20server%20is%20invalid.%20You%20might%20be%20connecting%20to%20a%20server%20that%20is%20pretending%20to%20be%20%E2%80%9Cpx-conf.perimeterx.net%E2%80%9D%20which%20could%20put%20your%20confidential%20information%20at%20risk.`,
                    'x-px-authorization': '3'
                }

                response = await this.request(url, method, { headers });

                if (response.statusCode == 200) {
                    if (response.body?.length > 1) {
                        this.loginDwcont = response.body.split('<form action="https://catalog.usmint.gov/account-login?dwcont=')[1].split('"')[0];
                        this.loginSecureKey = response.body.split('name="dwfrm_login_securekey" value="')[1].split('"')[0];
                        this.updateStatus(`Got sign in page.`, TaskStatusColor.Info);
                        return;
                    } else {
                        failedAttempts += 1;
                        this.setStatus(`Failed getting sign in page`, TaskStatusColor.Warning);
                        await sleep(this.retryDelay)
                        continue loop;
                    }
                } else if (response.statusCode === 302 && response.headers['location']?.includes("verify-show")){
                    this.setStatus(`Blocked by PX, rotating...`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    // await this.onCaptcha();
                    continue loop;
                } else {
                    console.log(response.statusCode)
                    this.setStatus(`Error getting sign in page`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    await sleep(this.retryDelay)
                    continue loop;
                }
            } catch (e) {
                console.log(e)
                failedAttempts += 1;
                this.setStatus(`Failed to get sign in page`, TaskStatusColor.Warning);
                await sleep(this.retryDelay)
                continue loop;
            }
        }
    }

    private async signIn() {
        this.updateStatus('Signing in...', TaskStatusColor.Neutral);
        let failedAttempts = 0;
        loop: while (!this.shouldStopTask) {

            let response;

            try {
                const method = METHOD.POST;
                let  url = `https://catalog.usmint.gov/account-login?dwcont=${this.loginDwcont}`;
                let headers = {
                    'authority': 'catalog.usmint.gov',
                    'pragma': 'no-cache',
                    'cache-control': 'no-cache',
                    'sec-ch-ua': '"Chromium";v="92", " Not A;Brand";v="99", "Google Chrome";v="92"',
                    'sec-ch-ua-mobile': '?0',
                    'upgrade-insecure-requests': '1',
                    'origin': 'https://catalog.usmint.gov',
                    'content-type': 'application/x-www-form-urlencoded',
                    'user-agent': this.userAgent,
                    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'navigate',
                    'sec-fetch-user': '?1',
                    'sec-fetch-dest': 'document',
                    'referer': 'https://catalog.usmint.gov/account-login',
                    'accept-language': 'en-US,en;q=0.9',
                    'x-px-bypass-reason': `The%20certificate%20for%20this%20server%20is%20invalid.%20You%20might%20be%20connecting%20to%20a%20server%20that%20is%20pretending%20to%20be%20%E2%80%9Cpx-conf.perimeterx.net%E2%80%9D%20which%20could%20put%20your%20confidential%20information%20at%20risk.`,
                    'x-px-authorization': '3'
                  }

                response = await this.request(url, method, {
                    headers,
                    body: `dwfrm_login_username=${this.task.username}&dwfrm_login_password=${this.task.password}&dwfrm_login_login=Login&dwfrm_login_securekey=${this.loginSecureKey}`
                });

                if (response.statusCode.toString().charAt(0) === '3' && response.headers['location'].includes('account-login')) {
                    this.updateStatus(`Signed in.`, TaskStatusColor.Info);
                    return;
                } else {
                    console.log(response.body, response.statusCode, response.headers['location'])
                    this.setStatus(`Error signing in`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    await sleep(this.retryDelay)
                    continue loop;
                }
            } catch (e) {
                console.log(e)
                failedAttempts += 1;
                this.setStatus(`Failed to sign in`, TaskStatusColor.Warning);
                await sleep(this.retryDelay)
                continue loop;
            }
        }
    }


    private async getProduct() {
        this.updateStatus('Getting product...', TaskStatusColor.Neutral);
        let failedAttempts = 0;
        loop: while (!this.shouldStopTask) {

            let response;

            try {
                const method = METHOD.GET;
                let  url = `https://catalog.usmint.gov/american-innovation-1-coin-2021-rolls-and-bags-new-hampshire-21GRA.html`;
                let headers = {
                    'authority': 'catalog.usmint.gov',
                    'pragma': 'no-cache',
                    'cache-control': 'no-cache',
                    'sec-ch-ua': '"Chromium";v="92", " Not A;Brand";v="99", "Google Chrome";v="92"',
                    'accept': '*/*',
                    'x-requested-with': 'XMLHttpRequest',
                    'sec-ch-ua-mobile': '?0',
                    'user-agent': this.userAgent,
                    'origin': 'https://catalog.usmint.gov',
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    'accept-language': 'en-US,en;q=0.9',
                    'dnt': '1',
                    'x-px-bypass-reason': `The%20certificate%20for%20this%20server%20is%20invalid.%20You%20might%20be%20connecting%20to%20a%20server%20that%20is%20pretending%20to%20be%20%E2%80%9Cpx-conf.perimeterx.net%E2%80%9D%20which%20could%20put%20your%20confidential%20information%20at%20risk.`,
                    'x-px-authorization': '3'
                }

                response = await this.request(url, method, { headers });

                if (response.statusCode == 200) {
                    console.log(response.body)
                    fs.writeFile("export.txt", response.body, (err) => {
                        console.log(err)
                    });

                    if (response.body?.length > 1) {
                        this.updateStatus(`Got product.`, TaskStatusColor.Info);
                        return;
                    } else {
                        failedAttempts += 1;
                        this.setStatus(`Failed getting product`, TaskStatusColor.Warning);
                        await sleep(this.retryDelay)
                        continue loop;
                    }
                } else if (response.statusCode === 302 && response.headers['location']?.includes("verify-show")){
                    this.setStatus(`Blocked by PX, rotating...`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    // await this.onCaptcha();
                    continue loop;
                } else {
                    console.log(response.statusCode)
                    this.setStatus(`Error getting product`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    await sleep(this.retryDelay)
                    continue loop;
                }
            } catch (e) {
                console.log(e)
                failedAttempts += 1;
                this.setStatus(`Failed to get product`, TaskStatusColor.Warning);
                await sleep(this.retryDelay)
                continue loop;
            }
        }
    }

    private async addToCart() {
        this.updateStatus('Adding to cart...', TaskStatusColor.Neutral);
        let failedAttempts = 0;
        loop: while (!this.shouldStopTask) {

            let response;

            try {
                const method = METHOD.POST;
                let url = `https://catalog.usmint.gov/on/demandware.store/Sites-USM-Site/default/Cart-AddProduct?format=ajax`;
                let headers = {
                    'authority': 'catalog.usmint.gov',
                    'pragma': 'no-cache',
                    'cache-control': 'no-cache',
                    'sec-ch-ua': '"Chromium";v="92", " Not A;Brand";v="99", "Google Chrome";v="92"',
                    'accept': '*/*',
                    'x-requested-with': 'XMLHttpRequest',
                    'sec-ch-ua-mobile': '?0',
                    'user-agent': this.userAgent,
                    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'origin': 'https://catalog.usmint.gov',
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    'referer': 'https://catalog.usmint.gov/american-innovation-1-coin-2021-rolls-and-bags-new-hampshire-21GRA.html',
                    'accept-language': 'en-US,en;q=0.9',
                    'dnt': '1',
                    'x-px-bypass-reason': `The%20certificate%20for%20this%20server%20is%20invalid.%20You%20might%20be%20connecting%20to%20a%20server%20that%20is%20pretending%20to%20be%20%E2%80%9Cpx-conf.perimeterx.net%E2%80%9D%20which%20could%20put%20your%20confidential%20information%20at%20risk.`,
                    'x-px-authorization': '3'
                }
                let body = `cartAction=add&pid=${this.task.product.id}&cgid=null&egc=null&navid=&personalizationSelected=&personalizationColor=&personalizationMessage=&personalizationFont=&Quantity=${this.task.atcQuantity}`;

                response = await this.request(url, method, { headers, body });

                if (response.statusCode == 200) {
                    if (response.body?.length > 1) {
                        this.updateStatus(`Added to cart.`, TaskStatusColor.Info);
                        return;
                    } else {
                        failedAttempts += 1;
                        this.setStatus(`Failed adding to cart`, TaskStatusColor.Warning);
                        await sleep(this.retryDelay)
                        continue loop;
                    }
                } else if (response.statusCode === 302 && response.headers['location']?.includes("verify-show")){
                    this.setStatus(`Blocked by PX, rotating...`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    // await this.onCaptcha();
                    continue loop;
                } else {
                    console.log(response.body, response.statusCode)
                    let locationHeader = response.headers['location'];
                    console.log(locationHeader)
                    
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

    private async selectGuest() {
        this.updateStatus('Selecting guest...', TaskStatusColor.Neutral);
        let failedAttempts = 0;
        loop: while (!this.shouldStopTask) {

            let response;

            try {
                const method = METHOD.GET;
                let  url = `https://catalog.usmint.gov/on/demandware.store/Sites-USM-Site/default/Cart-ValidateBulkLimit`;
                let headers = {
                        'authority': 'catalog.usmint.gov',
                        'pragma': 'no-cache',
                        'cache-control': 'no-cache',
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'sec-ch-ua-mobile': '?0',
                        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'accept': '*/*',
                        'x-requested-with': 'XMLHttpRequest',
                        'user-agent': this.userAgent,
                        'origin': 'https://catalog.usmint.gov',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'accept-language': 'en-US,en;q=0.9',
                        'x-px-bypass-reason': `The%20certificate%20for%20this%20server%20is%20invalid.%20You%20might%20be%20connecting%20to%20a%20server%20that%20is%20pretending%20to%20be%20%E2%80%9Cpx-conf.perimeterx.net%E2%80%9D%20which%20could%20put%20your%20confidential%20information%20at%20risk.`,
                        'x-px-authorization': '3'
                }

                response = await this.request(url, method, { headers });

                if (response.statusCode == 200) {
                    if (response.body?.length > 1) {
                        this.updateStatus(`Selected guest.`, TaskStatusColor.Info);
                        return;
                    } else {
                        failedAttempts += 1;
                        this.setStatus(`Failed to select guest`, TaskStatusColor.Warning);
                        await sleep(this.retryDelay)
                        continue loop;
                    }
                } else if (response.statusCode === 302 && response.headers['location']?.includes("verify-show")){
                    this.setStatus(`Blocked by PX, rotating...`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    // await this.onCaptcha();
                    continue loop;
                } else {
                    console.log(response.statusCode)
                    this.setStatus(`Error selecting guest`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    await sleep(this.retryDelay)
                    continue loop;
                }
            } catch (e) {
                console.log(e)
                failedAttempts += 1;
                this.setStatus(`Failed to select guest`, TaskStatusColor.Warning);
                await sleep(this.retryDelay)
                continue loop;
            }
        }
    }

    private async getCart() {
        this.updateStatus('Getting cart...', TaskStatusColor.Neutral);
        let failedAttempts = 0;
        loop: while (!this.shouldStopTask) {

            let response;

            try {
                const method = METHOD.GET;
                let  url = `https://catalog.usmint.gov/cart`;
                let headers = {
                    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                    'accept-encoding': 'gzip, deflate, br',
                    'accept-language': 'en-US,en;q=0.9',
                    'cache-control': 'no-cache',
                    'pragma': 'no-cache',
                    'referer': 'https://catalog.usmint.gov/american-innovation-1-coin-2021-rolls-and-bags-new-hampshire-21GRA.html',
                    'sec-ch-ua': '"Chromium";v="92", " Not A;Brand";v="99", "Google Chrome";v="92"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-fetch-dest': 'document',
                    'sec-fetch-mode': 'navigate',
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-user': '?1',
                    'upgrade-insecure-requests': '1',
                    'user-agent': this.userAgent,
                    'x-px-bypass-reason': `The%20certificate%20for%20this%20server%20is%20invalid.%20You%20might%20be%20connecting%20to%20a%20server%20that%20is%20pretending%20to%20be%20%E2%80%9Cpx-conf.perimeterx.net%E2%80%9D%20which%20could%20put%20your%20confidential%20information%20at%20risk.`,
                    'x-px-authorization': '3'
                }
                

                response = await this.request(url, method, { headers });

                if (response.statusCode == 200) {
                    if (response.body?.length > 1) {
                        this.dwcont = response.body?.split('<form class="formcheckout" action="https://catalog.usmint.gov/cart?dwcont=')[1].split('" method="post"')[0];
                        this.shippingSecureKey = response.body?.split('name="dwfrm_singleshipping_securekey" value="')[1].split('"')[0];
                        this.billingSecureKey = response.body?.split('name="dwfrm_billing_securekey" value="')[1].split('"')[0];
                        this.updateStatus(`Got cart.`, TaskStatusColor.Info);
                        return;
                    } else {

                        failedAttempts += 1;
                        this.setStatus(`Failed getting cart`, TaskStatusColor.Warning);
                        await sleep(this.retryDelay)
                        continue loop;
                    }
                } else if (response.statusCode === 302 && response.headers['location']?.includes("verify-show")){
                    this.setStatus(`Blocked by PX, rotating...`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    // await this.onCaptcha();
                    continue loop;
                } else {
                    console.log(response.statusCode)
                    this.setStatus(`Error getting cart`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    await sleep(this.retryDelay)
                    continue loop;
                }
            } catch (e) {
                console.log(e)
                failedAttempts += 1;
                this.setStatus(`Failed to get cart`, TaskStatusColor.Warning);
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
                let  url = `https://catalog.usmint.gov/cart?dwcont=${this.dwcont}`;
                let headers = {
                        'authority': 'catalog.usmint.gov',
                        'pragma': 'no-cache',
                        'cache-control': 'no-cache',
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'sec-ch-ua-mobile': '?0',
                        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'accept': '*/*',
                        'x-requested-with': 'XMLHttpRequest',
                        'user-agent': this.userAgent,
                        'origin': 'https://catalog.usmint.gov',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'accept-language': 'en-US,en;q=0.9',
                        'referer': 'https://catalog.usmint.gov/us/en/shipping-checkout/',
                        'x-px-bypass-reason': `The%20certificate%20for%20this%20server%20is%20invalid.%20You%20might%20be%20connecting%20to%20a%20server%20that%20is%20pretending%20to%20be%20%E2%80%9Cpx-conf.perimeterx.net%E2%80%9D%20which%20could%20put%20your%20confidential%20information%20at%20risk.`,
                        'x-px-authorization': '3'
                }

                response = await this.request(url, method, { 
                    headers,
                    body: `dwfrm_singleshipping_shippingAddress_addressFields_selectedAddressID=newaddress&dwfrm_singleshipping_shippingAddress_addressFields_firstName=${this.profile?.shippingAddress?.firstName}&dwfrm_singleshipping_shippingAddress_addressFields_lastName=${this.profile?.shippingAddress?.lastName}&dwfrm_singleshipping_shippingAddress_addressFields_phone=${this.profile?.shippingAddress?.phone}&dwfrm_singleshipping_shippingAddress_email=${this.profile?.shippingAddress?.email}&dwfrm_billing_billingAddress_emailsource=Website+-+Checkout&dwfrm_singleshipping_shippingAddress_addressFields_address1=${this.profile?.shippingAddress?.address}&dwfrm_singleshipping_shippingAddress_addressFields_address2=${this.profile?.shippingAddress?.secondaryAddress}&dwfrm_singleshipping_shippingAddress_addressFields_city=${this.profile?.shippingAddress?.city}&dwfrm_singleshipping_shippingAddress_addressFields_states_state=${this.profile?.shippingAddress?.stateCode}&dwfrm_singleshipping_shippingAddress_addressFields_zip=${this.profile?.shippingAddress?.zip}&dwfrm_singleshipping_shippingAddress_addressFields_country=${this.profile?.shippingAddress?.country}&dwfrm_singleshipping_shippingAddress_isCreateAccountSelected=false&dwfrm_singleshipping_createAccount_password=&dwfrm_singleshipping_createAccount_passwordconfirm=&dwfrm_singleshipping_createAccount_question=1&dwfrm_singleshipping_createAccount_answer=&dwfrm_singleshipping_securekey=${this.shippingSecureKey}&dwfrm_billing_securekey=${this.billingSecureKey}&format=ajax&refresh=shipping&dwfrm_singleshipping_shippingAddress_applyShippingAddress=`
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
                } else if (response.statusCode === 302 && response.headers['location']?.includes("verify-show")){
                    this.setStatus(`Blocked by PX, rotating...`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    // await this.onCaptcha();
                    continue loop;
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

    private async submitBilling() {
        this.updateStatus('Submitting billing...', TaskStatusColor.Neutral);
        let failedAttempts = 0;
        loop: while (!this.shouldStopTask) {

            let response;

            try {
                const method = METHOD.POST;
                let  url = `https://catalog.usmint.gov/cart?dwcont=${this.dwcont}`;
                let headers = {
                        'authority': 'catalog.usmint.gov',
                        'pragma': 'no-cache',
                        'cache-control': 'no-cache',
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'sec-ch-ua-mobile': '?0',
                        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'accept': '*/*',
                        'x-requested-with': 'XMLHttpRequest',
                        'user-agent': this.userAgent,
                        'origin': 'https://catalog.usmint.gov',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'accept-language': 'en-US,en;q=0.9',
                        'referer': 'https://catalog.usmint.gov/us/en/shipping-checkout/',
                        'x-px-bypass-reason': `The%20certificate%20for%20this%20server%20is%20invalid.%20You%20might%20be%20connecting%20to%20a%20server%20that%20is%20pretending%20to%20be%20%E2%80%9Cpx-conf.perimeterx.net%E2%80%9D%20which%20could%20put%20your%20confidential%20information%20at%20risk.`,
                        'x-px-authorization': '3'
                }


                response = await this.request(url, method, { 
                    headers,
                    body: `dwfrm_singleshipping_shippingAddress_useAsBillingAddress=true&dwfrm_billing_billingAddress_addressFields_selectedAddressID=&dwfrm_billing_billingAddress_addressFields_firstName=${this.profile?.billingAddress?.firstName}&dwfrm_billing_billingAddress_addressFields_lastName=${this.profile?.billingAddress?.lastName}&dwfrm_billing_billingAddress_addressFields_address1=${this.profile?.billingAddress?.address}&dwfrm_billing_billingAddress_addressFields_address2=${this.profile?.billingAddress?.secondaryAddress}&dwfrm_billing_billingAddress_addressFields_city=${this.profile?.billingAddress?.city}&dwfrm_billing_billingAddress_addressFields_states_state=${this.profile?.billingAddress?.stateCode}&dwfrm_billing_billingAddress_addressFields_zip=${this.profile?.billingAddress?.zip}&dwfrm_billing_billingAddress_addressFields_country=${this.profile?.billingAddress?.country}&dwfrm_billing_billingAddress_addressFields_phone=${this.profile?.billingAddress?.phone}&dwfrm_billing_billingAddress_email_emailAddress=${this.profile?.billingAddress?.email}&dwfrm_billing_securekey=${this.billingSecureKey}&dwfrm_singleshipping_securekey=${this.shippingSecureKey}&refresh=payment&format=ajax&dwfrm_billing_applyBillingAndPayment=&dwfrm_billing_paymentMethods_selectedPaymentMethodID=CREDIT_CARD&dwfrm_billing_paymentMethods_creditCard_type=Visa&dwfrm_billing_paymentMethods_creditCard_owner=${this.profile?.billingAddress?.firstName} ${this.profile?.billingAddress?.lastName}&dwfrm_billing_paymentMethods_creditCard_number=${this.profile?.payment?.number}&dwfrm_billing_paymentMethods_creditCard_month=${this.profile?.payment?.month}&dwfrm_billing_paymentMethods_creditCard_year=${this.profile?.payment?.year}&dwfrm_billing_paymentMethods_creditCard_cvn=${this.profile?.payment?.code}&dwfrm_billing_securekey=${this.billingSecureKey}&dwfrm_emailsignup_phone=`
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
                } else if (response.statusCode === 302 && response.headers['location']?.includes("verify-show")){
                    this.setStatus(`Blocked by PX, rotating...`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    // await this.onCaptcha();
                    continue loop;
                } else {
                    console.log(response.statusCode)
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
                let  url = `https://catalog.usmint.gov/summary-submit`;
                let headers = {
                    'authority': 'catalog.usmint.gov',
                    'pragma': 'no-cache',
                    'cache-control': 'no-cache',
                    'sec-ch-ua': '"Chromium";v="92", " Not A;Brand";v="99", "Google Chrome";v="92"',
                    'sec-ch-ua-mobile': '?0',
                    'upgrade-insecure-requests': '1',
                    'origin': 'https://catalog.usmint.gov',
                    'content-type': 'application/x-www-form-urlencoded',
                    'user-agent': this.userAgent,
                    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'navigate',
                    'sec-fetch-user': '?1',
                    'sec-fetch-dest': 'document',
                    'referer': 'https://catalog.usmint.gov/cart',
                    'accept-language': 'en-US,en;q=0.9',  
                    'x-px-bypass-reason': `The%20certificate%20for%20this%20server%20is%20invalid.%20You%20might%20be%20connecting%20to%20a%20server%20that%20is%20pretending%20to%20be%20%E2%80%9Cpx-conf.perimeterx.net%E2%80%9D%20which%20could%20put%20your%20confidential%20information%20at%20risk.`,
                    'x-px-authorization': '3'
                }

                response = await this.request(url, method, { 
                    headers,
                    body: `dwfrm_billing_paymentMethods_selectedPaymentMethodID=CREDIT_CARD&dwfrm_billing_paymentMethods_creditCard_type=Visa&dwfrm_billing_paymentMethods_creditCard_owner=${this.profile?.billingAddress?.firstName} ${this.profile?.billingAddress?.lastName}&dwfrm_billing_paymentMethods_creditCard_number=${this.profile?.payment?.number}&dwfrm_billing_paymentMethods_creditCard_month=${this.profile?.payment?.month}&dwfrm_billing_paymentMethods_creditCard_year=${this.profile?.payment?.year}&dwfrm_billing_paymentMethods_creditCard_cvn=${this.profile?.payment?.code}&dwfrm_billing_securekey=${this.billingSecureKey}&dwfrm_emailsignup_phone=`,
                });

                if (response.statusCode === 200) {
                    if (response.body.includes("Order Summary")) {
                        this.setStatus(`Payment Successful`, TaskStatusColor.Success, TaskEvent.CheckoutSuccess);
                        return;
                    } else {
                        this.setStatus(`Error placing order`, TaskStatusColor.Warning);
                        this.rotateProxy();
                        continue loop;
                    }                    
                } else if (response.statusCode === 302 && response.headers['location']?.includes("verify-show")){
                    this.setStatus(`Blocked by PX, rotating... (MAYBE WAS A CHECKOUT REDIRECT)`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    // await this.onCaptcha();
                    continue loop;
                } else {
                    console.log(response.body, response.statusCode, response.headers['location'])
                    this.setStatus(`Error placing order`, TaskStatusColor.Warning);
                    this.rotateProxy();
                    continue loop;
                }
            } catch (e) {
                console.log(e)
                failedAttempts += 1;
                this.setStatus(`Failed to place order`, TaskStatusColor.Warning);
                await sleep(this.retryDelay)
                continue loop;
            }
        }
    }









    private async getcookie() {
        let cookie;
        this.updateStatus(`Getting PX Cookie...`, TaskStatusColor.Neutral);
        cookie = await this.hawkcookie();    
        await this.setPXCookie(cookie);
    }

    private async setPXCookie(cookie: string) {
        await this.cookieJar.setCookie(
            new Cookie({
                key: '_px3',
                value: cookie,
                domain: 'catalog.usmint.gov',
            }),
            'https://catalog.usmint.gov/'
        );
    }

    private async onCaptcha() {
        this.captchacount += 1;
        if (this.captchacount > 5) {
            this.captchacount = 0;
            this.rotateProxy();
        }

        this.updateStatus(`Grabbing PX Cookie...`, TaskStatusColor.Neutral);
        await this.captcha();
        this.updateStatus(`PX Cookie Generated`, TaskStatusColor.Neutral);
    }

    private async captcha() {
        let cookie: string;
        this.pxTries += 1;
        if (this.pxTries > 3) {
            this.updateStatus('Proxy banned');
            this.rotateProxy();
            this.getcookie();
            this.pxTries = 0;
        }

        cookie = await this.hawkcaptcha();

        await this.setPXCookie(cookie);
    }

    private async hawkcookie() {
        const currentStep = 'Getting PX Cookie';
        while (!this.shouldStopTask) {
            let response;
            try {
                response = await this.HawkSolver.solveNormal(this.proxy, this.userAgent);
            } catch (e) {
                this.handleConnectionError(e, undefined, currentStep);
                continue;
            }
            // if (!response.captchaSuccess) {
            //     console.log(response);
            //     this.tries.hawk.cookie++;
            //     // if (this.tries.hawk.cookie % 5 === 0) {
            //     //     this.rotateProxy();
            //     //     this.PXService = 'umasi';
            //     //     return await this.umasicookie();
            //     // }
            //     this.updateStatus('Retrying to Generate PX Cookie.', TaskStatusColor.Warning);
            // }

            return response.cookies['_px3'];
        }
    }

    private async hawkcaptcha() {
        const currentStep = 'Getting PX Captcha';
        this.updateStatus('Solving PX Captcha', TaskStatusColor.Neutral);
        while (!this.shouldStopTask) {
            let response;
            try {
                response = await this.HawkSolver.solveHoldCaptcha(this.proxy, this.userAgent);
            } catch (e) {
                this.handleConnectionError(e, undefined, currentStep);
                continue;
            }

            // console.log(response);
            // if (!response.captchaSuccess) {
            //     this.tries.hawk.captcha++;
            //     // if (this.tries.hawk.captcha % 5 === 0) {
            //     //     this.rotateProxy();
            //     //     this.PXService = 'umasi';
            //     //     await this.getcookie();
            //     //     return await this.captcha();
            //     // }
            //     this.updateStatus('Retrying to Generate PX Captcha Cookie.', TaskStatusColor.Warning);
            // }

            return response.cookies['_px3'];
        }
    }




    private async request(endpoint: string, method: METHOD, options: { headers?: any; body?: any; json?: boolean }) {
        this.beforeHook();
        let headers = {
            'user-agent': this.userAgent,
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
}
