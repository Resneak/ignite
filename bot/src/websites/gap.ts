import BotTask from '../models/tasks/botTask';
import { TaskEvent, TaskStatusColor } from '../../../lib/models/taskUpdate';
import { RetryExecutor } from '../../../lib/errors';
import { CaptchaTask, CaptchaType } from '../models/captchaSolvers/captchaSolver';
import Product from '../../../lib/models/product';
import Size from '../../../lib/models/size';

export default class Gap extends BotTask {
    private token?: string;

    private baseURL = 'https://secure-www.gap.com';

    protected *execute() {
        this.rotateProxy();
        // yield this.signup()
        yield this.addToCart();
        yield this.guestLogin();
        yield this.checkout();
        // yield this.guest();
        // yield this.getCheckoutPage();
        // yield this.selectShippingMethod();
        yield this.shipping();
        yield this.createPayment();
        yield this.submit();
    }
    private async signup() {
        let response: any;
        const url = `${this.baseURL}/my-account/xapi/create-account`;
        this.updateStatus('Creating account', TaskStatusColor.Neutral);
        let email = this.task.username!.split('@')[0] + '+' + Math.floor(Math.random() * 100000) + '@' + this.task.username!.split('@')[1];

        try {
            response = await this.httpClient.post(url, {
                headers: {
                    authority: 'secure-www.gap.com',
                    'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
                    'sec-ch-ua-mobile': '?0',
                    'user-agent':
                        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',
                    'content-type': 'application/json;charset=UTF-8',
                    accept: 'application/json, text/plain, */*',
                    origin: this.baseURL,
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    referer: `${this.baseURL}/my-account/sign-in?targetURL=%2Fshopping-bag`,
                    'accept-language': 'en-US,en;q=0.9',
                    dnt: '1',
                    'Content-Type': 'application/json; charset=UTF-8',
                },
                body: JSON.stringify({
                    emailAddress: email,
                    password: 'Ignite!23k_sfd',
                    firstName: this.profile.shippingAddress.firstName!,
                    lastName: this.profile.shippingAddress.lastName!,
                    registrationBrand: 'GP',
                }),
                responseType: 'json',
            });
        } catch (e) {
            this.handleConnectionError(e, this.signup.bind(this), 'Creating account');
        }
        if (response.statusCode === 200 && response.body.status === 'ok') {
            this.updateStatus('Added to sign up');
            return;
        }

        this.updateStatus('Failed to sign up');
        throw new RetryExecutor(this.signup.bind(this), `Retrying`);
    }

    private async addToCart() {
        let response: any;
        // https://secure-www.gap.com/buy/inlineShoppingBagAddJson.do?skuid=7097400120004&quantity7097400120004=1&sfl7097400120004=false&cid7097400120004
        this.updateStatus('Adding to cart', TaskStatusColor.Neutral);
        const url =
            `${this.baseURL}/buy/inlineShoppingBagAddJson.do?skuid=` +
            this.task.product.id +
            '&quantity' +
            this.task.product.id +
            '=1&sfl' +
            this.task.product.id +
            '=false&cid' +
            this.task.product.id +
            '=';
        try {
            response = await this.httpClient.get(url, {
                headers: {
                    authority: 'secure-www.gap.com',
                    'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
                    'sec-ch-ua-mobile': '?0',
                    'user-agent':
                        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',
                    accept: '*/*',
                    origin: 'https://www.gap.com', //TODO
                    'sec-fetch-site': 'same-site',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    referer: 'https://www.gap.com/', //TODO
                    'accept-language': 'en-US,en;q=0.9',
                    dnt: '1',
                },
                responseType: 'json',
            });
        } catch (e) {
            this.handleConnectionError(e, this.addToCart.bind(this), 'Adding to cart');
        }
        if (response.statusCode === 200) {
            const data = response?.body?.inlineBagModelData;
            const itemsInCart = data?.itemCount;
            const subtotal = data?.subTotal;
            const image = data?.inlineBagItems?.[0]?.siImageURI;
            const name = `${data?.inlineBagItems?.[0]?.styleDescription} - ${data?.inlineBagItems?.[0]?.colorDescription}`;
            const size = data?.inlineBagItems?.[0]?.skuDescription || 'Unknown :/';
            this.task.product = new Product({
                id: this.task.product.id,
                name,
                image,
                price: subtotal,
                size: new Size(size),
            });

            if (!response) this.updateStatus('Added to cart');
            this.setStatus(`Added ${itemsInCart} x ${name} size ${size} to cart. ${subtotal}`, TaskStatusColor.Cart, TaskEvent.Carted);
            return;
        }
        throw new RetryExecutor(this.addToCart.bind(this), `Failed to add to cart, Retrying`);
    }

    private async checkout() {
        let response: any;
        const url = `${this.baseURL}/checkout/place-order/`;
        try {
            response = await this.httpClient.get(url, {
                headers: {
                    // authority: 'secure-www.gap.com',
                    pragma: 'no-cache',
                    'cache-control': 'no-cache',
                    'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
                    'sec-ch-ua-mobile': '?0',
                    'upgrade-insecure-requests': '1',
                    'user-agent':
                        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'navigate',
                    'sec-fetch-user': '?1',
                    'sec-fetch-dest': 'document',
                    referer: `${this.baseURL}/shopping-bag`,
                    'accept-language': 'en-US,en;q=0.9',
                },
            });
        } catch (e) {
            this.handleConnectionError(e, this.checkout.bind(this), 'Start checkout');
        }
        if (response.statusCode === 200) {
            return;
        }
        throw new RetryExecutor(this.checkout.bind(this), `Failed to start checkout, Retrying`);
    }

    private async shipping() {
        let response: any;

        const url = `${this.baseURL}/checkout/place-order/xapi/create-shipping-address-action`;
        this.updateStatus('Submitting shipping');
        try {
            response = await this.httpClient.post(url, {
                headers: {
                    customer: `{"customerId":"${this.customerId}","emailId":"${this.profile.shippingAddress.email}","isGuest":true}`,
                    accept: 'application/json',
                    'content-type': 'application/json',
                    ismockdata: 'false',
                    'sec-ch-ua-mobile': '?0',
                    'user-agent':
                        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',
                    'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                    origin: this.baseURL,
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    referer: `${this.baseURL}/checkout/place-order/`,
                    'accept-encoding': 'gzip, deflate, br',
                    'accept-language': 'en-US,en;q=0.9',
                },
                json: {
                    shippingAddress: {
                        title: '', // added
                        firstName: this.profile.shippingAddress.firstName,
                        lastName: this.profile.shippingAddress.lastName,
                        addressLine1: this.profile.shippingAddress.address,
                        addressLine2: this.profile.shippingAddress.secondaryAddress,
                        city: this.profile.shippingAddress.city,
                        state: this.profile.shippingAddress.stateCode,
                        country: 'US',
                        postalCode: this.profile.shippingAddress.zip,
                        phone: this.profile.shippingAddress.phone,
                        isSelected: false,
                        isEditable: true,
                        isDefault: false,
                    },
                },
            });
        } catch (e) {
            this.handleConnectionError(e, this.shipping.bind(this), 'Submit shipping');
        }
        if (response.statusCode === 200) {
            return;
        }
        throw new RetryExecutor(this.shipping.bind(this), `Shipping failed, Retrying. Status Code: ${response?.statusCode}`);
    }

    private async createPayment() {
        let response: any;
        const url = `${this.baseURL}/checkout/place-order/xapi/create-payment-method-action`;
        this.updateStatus('Submitting billing');
        try {
            response = await this.httpClient.post(url, {
                headers: {
                    customer: `{"customerId":"${this.customerId}","emailId":"${this.profile.shippingAddress.email}","isGuest":true}`,
                    accept: 'application/json',
                    'content-type': 'application/json',
                    ismockdata: 'false',
                    'sec-ch-ua-mobile': '?0',
                    'user-agent':
                        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',
                    'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                    origin: this.baseURL,
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    referer: `${this.baseURL}/checkout/place-order/`,
                    'accept-encoding': 'gzip, deflate, br',
                    'accept-language': 'en-US,en;q=0.9',
                },
                json: {
                    paymentMethod: {
                        cardInfo: {
                            cardType: 1,
                            cardHolderName: `${this.profile.billingAddress?.firstName} ${this.profile.billingAddress?.lastName}`,
                            cardNumber: this.profile.payment.number,
                            cvv: this.profile.payment.code,
                            expirationMonth: `${this.profile.payment.month}`,
                            cardBrandNumber: '',
                            expirationYear: `${this.profile.payment.year}`,
                            saveCCInProfile: true,
                            isDefault: false,
                        },
                        billingAddress: {
                            addressLine1: this.profile.shippingAddress.address,
                            addressLine2: this.profile.shippingAddress.secondaryAddress,
                            city: this.profile.shippingAddress.city,
                            country: 'US',
                            firstName: this.profile.shippingAddress.firstName,
                            lastName: this.profile.shippingAddress.lastName,
                            phone: this.profile.shippingAddress.phone,
                            postalCode: this.profile.shippingAddress.zip,
                            state: this.profile.shippingAddress.stateCode,
                            verificationStatus: 'NOT_VERIFIED',
                            deliveryPointValidation: 'INVALID_DELIVERY_POINT',
                        },
                    },
                },
            });
        } catch (e) {
            this.handleConnectionError(e, this.createPayment.bind(this), 'Submit billing');
        }
        if (response.statusCode === 200) {
            return;
        }
        throw new RetryExecutor(this.createPayment.bind(this), `Failed to submit billing, Retrying. Status Code: ${response?.statusCode}`);
    }

    private async submit() {
        let response: any;
        const url = `${this.baseURL}/checkout/place-order/xapi/place-order-action`;
        this.updateStatus('Checking out');
        try {
            response = await this.httpClient.post(url, {
                headers: {
                    authority: 'secure-www.gap.com',
                    accept: 'application/json',
                    'content-type': 'application/json',
                    ismockdata: 'false',
                    'sec-ch-ua-mobile': '?0',
                    'user-agent':
                        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',
                    'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
                    origin: this.baseURL,
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    referer: `${this.baseURL}/checkout/place-order/`,
                    'accept-language': 'en-US,en;q=0.9',
                    dnt: '1',
                    'Content-Type': 'application/json; charset=UTF-8',
                },
                json: {
                    placeOrder: {
                        cvv: this.profile.payment.code,
                        orderDeviceId: '',
                        emailOptInIndicator: false,
                    },
                },
                responseType: 'json',
            });
        } catch (e) {
            this.handleConnectionError(e, this.submit.bind(this), 'Checkout');
        }
        if (response.statusCode === 200) {
            this.task.checkoutProxy = this.proxy?.getUrl();
            const error = response?.body?.panels?.placeOrderPanel?.placeOrderErrors?.[0]?.userMessage || '';
            if (error) {
                this.setStatus(`Payment Declined. Error ${error}`, TaskStatusColor.Error, TaskEvent.CheckoutDecline);
                return;
            }

            this.setStatus(`Successful checkout`, TaskStatusColor.Success, TaskEvent.CheckoutSuccess);
            return;
        }
        throw new RetryExecutor(this.submit.bind(this), `Failed to checkout, Retrying. Status Code: ${response?.statusCode}`);
    }

    private customerId = '';
    private async guestLogin() {
        let response: any;

        const url = `${this.baseURL}/my-account/xapi/guest-account-login`;
        this.updateStatus('Logging in with guest account');

        try {
            response = await this.httpClient.post(url, {
                headers: {
                    'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                    // tracestate: '1798415@nr=0-1-1334766-418365796-e671e55f9fbdf83d----1627003002912',
                    // traceparent: '00-2200914a82dd870a4350a6e44a9dcf40-e671e55f9fbdf83d-01',
                    tracestate: '',
                    traceparent: '',
                    'sec-ch-ua-mobile': '?0',
                    'user-agent':
                        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',

                    //paypal token from  https://secure-www.gap.com/checkout/place-order/xapi/get-paypal-button
                    newrelic: '',
                    // 'eyJ2IjpbMCwxXSwiZCI6eyJ0eSI6IkJyb3dzZXIiLCJhYyI6IjEzMzQ3NjYiLCJhcCI6IjQxODM2NTc5NiIsImlkIjoiZTY3MWU1NWY5ZmJkZjgzZCIsInRyIjoiMjIwMDkxNGE4MmRkODcwYTQzNTBhNmU0NGE5ZGNmNDAiLCJ0aSI6MTYyNzAwMzAwMjkxMiwidGsiOiIxNzk4NDE1In19',
                    'content-type': 'application/json;charset=UTF-8',
                    accept: 'application/json, text/plain, */*',
                    origin: this.baseURL,
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    referer: `${this.baseURL}/my-account/sign-in?targetURL=/checkout/place-order/`,
                    'accept-encoding': 'gzip, deflate, br',
                    'accept-language': 'en-US,en;q=0.9',
                },
                json: {
                    email: this.profile.shippingAddress.email,
                },
                responseType: 'json',
            });
        } catch (e) {
            this.handleConnectionError(e, this.guestLogin.bind(this), 'Login with guest account');
        }
        switch (response?.statusCode) {
            case 200:
                this.customerId = response?.body?.externalCustomerId;

                return;
            default:
                throw new RetryExecutor(
                    this.guestLogin.bind(this),
                    `Failed to login to guest account, Retrying. Status Code: ${response?.statusCode}`
                );
        }
    }

    // private shippingTypeId?: number;
    // private shippingId?: number;
    // private async getCheckoutPage() {
    //     let response: any;
    //     this.updateStatus(`Getting Checkout Page`);

    //     const url = 'https://secure-www.gap.com/checkout/place-order/xapi/get-checkout-page';

    //     try {
    //         response = await this.httpClient.get(url, {
    //             headers: {
    //                 customer: `{"customerId":${this.customerId}}`,
    //                 accept: 'application/json',
    //                 ismockdata: 'undefined',
    //                 'sec-ch-ua-mobile': '?0',
    //                 'user-agent':
    //                     'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',
    //                 'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
    //                 'sec-fetch-site': 'same-origin',
    //                 'sec-fetch-mode': 'cors',
    //                 'sec-fetch-dest': 'empty',
    //                 referer: 'https://secure-www.gap.com/checkout/place-order/',
    //                 'accept-encoding': 'gzip, deflate, br',
    //                 'accept-language': 'en-US,en;q=0.9',
    //             },
    //             responseType: 'json',
    //         });
    //     } catch (e) {
    //         this.handleConnectionError(e, this.getCheckoutPage.bind(this), 'Get checkout page');
    //     }

    //     switch (response?.statusCode) {
    //         case 200:
    //             const basicShipping = response?.body?.panels?.placeOrderPanel?.shippingMethods?.find?.(
    //                 (item) => item.shippingOptionDisplayName === 'Basic'
    //             );
    //             this.shippingTypeId = basicShipping?.shippingTypeId;
    //             this.shippingId = basicShipping?.shippingId;
    //             if (!this.shippingTypeId || !this.shippingId) {
    //                 throw new RetryExecutor(this.getCheckoutPage.bind(this), `Failed to parse checkout page. Retrying`);
    //             }

    //             this.updateStatus(`Got Checkout Page`);
    //             return;

    //         default:
    //             throw new RetryExecutor(
    //                 this.getCheckoutPage.bind(this),
    //                 `Failed to get checkout page, Retrying. Status Code: ${response?.statusCode}`
    //             );
    //     }
    // }

    // private async selectShippingMethod() {
    //     let response: any;

    //     const url = 'https://secure-www.gap.com/checkout/place-order/xapi/select-shipping-method-action';

    //     this.updateStatus('Selecting Shipping Method');

    //     try {
    //         response = await this.httpClient.post(url, {
    //             headers: {
    //                 customer: `{"customerId":"${this.customerId}","emailId":"${this.profile.shippingAddress.email}","isGuest":true}`,
    //                 accept: 'application/json',
    //                 'content-type': 'application/json',
    //                 ismockdata: 'false',
    //                 'sec-ch-ua-mobile': '?0',
    //                 'user-agent':
    //                     'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',
    //                 'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
    //                 origin: 'https://secure-www.gap.com',
    //                 'sec-fetch-site': 'same-origin',
    //                 'sec-fetch-mode': 'cors',
    //                 'sec-fetch-dest': 'empty',
    //                 referer: 'https://secure-www.gap.com/checkout/place-order/',
    //                 'accept-encoding': 'gzip, deflate, br',
    //                 'accept-language': 'en-US,en;q=0.9',
    //             },
    //             json: {
    //                 shippingMethod: { shippingId: this.shippingId, shippingTypeId: this.shippingTypeId },
    //             },
    //         });
    //     } catch (e) {
    //         throw new RetryExecutor(this.selectShippingMethod.bind(this), 'Failed to selecte shipping method, Retrying.');
    //     }

    //     switch (response?.statusCode) {
    //         case 200:
    //             this.updateStatus('Submitted Shipping Method');
    //             return;

    //         default:
    //             throw new RetryExecutor(
    //                 this.selectShippingMethod.bind(this),
    //                 `Failed to selecte shipping method, Retrying. Status Code: ${response?.statusCode}`
    //             );
    //     }
    // }

    private captchaURL?: string;

    async solveRecaptcha() {
        this.updateStatus('Solving ReCaptcha', TaskStatusColor.Neutral);

        const captchaTask: CaptchaTask = {
            taskID: this.task.id,
            type: CaptchaType.RecaptchaV3,
            URL: this.captchaURL!,
            siteKey: '6Lcn6qAUAAAAAJXZu7aNxNwbEfHidD2c3tmrCkGF',
            minScore: 0.9,
            pageAction: 'handleCaptcha',
        };
        this.token = (await this.solveCaptchaTask(captchaTask)) as string;
        this.updateStatus(`Solved Captcha ${this.token.substring(0, 10)}`, TaskStatusColor.Neutral);
    }
}
