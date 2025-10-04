import { JSONParseSafely } from '../../../lib/helpers';
import { TaskEvent, TaskStatusColor } from '../../../lib/models/taskUpdate';
import BotTask, { BotTaskProperties } from '../models/tasks/botTask';
import { RetryExecutor, StopTask } from '../../../lib/errors';

import Size from '../../../lib/models/size';
import Env from '../env';
import { TargetModes } from '.';

import Product from '../../../lib/models/product';

export default class Target extends BotTask {
    private tries: {
        atc: number;
        getCart: number;
        remove: number;
        submitShipping: number;
        submitBilling: number;
        placeOrder: number;
    } = {
        atc: 0,
        getCart: 0,
        remove: 0,
        submitShipping: 0,
        submitBilling: 0,
        placeOrder: 0,
    };

    private host: string = 'www.target.com';

    private checkpoints: {
        requiresShipping: boolean;
        requiresBilling: boolean;
    } = {
        requiresBilling: false,
        requiresShipping: false,
    };

    private init247Interval?;
    private start_ts!: number;
    private stores: string[] = [];

    private channelId!: string;
    private isPickup: boolean = false;

    private storeId!: string;
    private pickupId!: string;
    private storeRadius!: string;
    private paymentId!: string;
    private shippingId!: string;
    private dummyItemId!: string;
    private sku?: string;
    private cartId?: string;

    private account: {
        email: string;
        password: string;
        accessToken: string;
    };

    protected *execute() {
        this.rotateProxy();
        this.start_ts = Date.now();
        this.setCookies(this.account.accessToken, 'accessToken');
        yield this.getCart();

        if (this.task.mode === TargetModes.Preload) {
            yield this.cleanShippingAddresses();
            this.updateStatus('Starting preload sequence', TaskStatusColor.Neutral);
            yield this.visitProductPage();
            yield this.addToCart(true);
            yield this.visitCheckout();
        }

        if (this.isPickup) yield this.getStoreRadius();

        if (this.task.mode === TargetModes.Fast) yield this.addToCart();

        if (this.isPickup) {
            if (!this.pickupId) yield this.setPickup();
            else yield this.editPickup();
        } else {
            if (this.checkpoints.requiresShipping) yield this.submitShipping();
            else yield this.editShipping();
        }

        if (this.checkpoints.requiresBilling) yield this.submitBilling();
        else yield this.editBilling();

        if (this.task.mode === TargetModes.Preload) {
            yield this.removeProduct();
            this.updateStatus('Preload session ready', TaskStatusColor.Neutral);
            yield this.addToCart();
        }

        yield this.placeOrder();
    }

    constructor(botTaskProps: BotTaskProperties) {
        super(botTaskProps);

        this.sku = this.task.product.id.split(':')[0];
        this.task.product.name = this.sku;
        this.storeRadius = this.task.product.id.split(':')[1];
        if (this.storeRadius) this.isPickup = true;

        this.account = {
            email: this.task.username!,
            password: this.task.password!,
            accessToken: this.task.password!,
        };

        this.updateHttpOptions({
            ignoreInvalidCookies: true,
        });
    }

    private rotateStore() {
        this.storeId = this.stores[Math.floor(Math.random() * this.stores.length)];
    }

    private setCookies(value: string, name: string) {
        this.cookieJar.setCookie(`${name}=${value};`, `https://carts.target.com/`);
        this.cookieJar.setCookie(`${name}=${value};`, `https://api.target.com/`);
        this.cookieJar.setCookie(`${name}=${value};`, `https://www.target.com/`);
        this.cookieJar.setCookie(`${name}=${value};`, `https://gsp.target.com/`);
    }

    private async init247() {
        // TODO should we clear this once the task stops?
        setInterval(() => {
            this.getToken();
        }, 10800000);
    }

    private async getToken() {
        let response: any;
        if (Env.isDev) this.updateStatus('Getting new token (24/7)', TaskStatusColor.Neutral);
        try {
            response = await this.httpClient.post(`https://gsp.target.com/gsp/oauth_tokens/v2/client_tokens`, {
                json: {
                    grant_type: 'refresh_token',
                    client_credential: { client_id: 'ecom-web-1.0.0' },
                    device_info: {},
                },
                headers: {
                    accept: '*/*',
                    'accept-encoding': 'gzip, deflate, br',
                    'accept-language': 'fr-FR,fr;q=0.9',
                    'cache-control': 'no-cache',
                    'content-type': 'application/json',
                    Origin: 'https://www.target.com',
                    Referer: `https://www.target.com/p/-/-/${this.task.product.id}`,
                    'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                    'sec-ch-ua-mobile': '?0',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-site',
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                },
            });
        } catch (e) {
            Env.isDev && console.log(e.message);
            this.handleConnectionError(e, this.getToken.bind(this));
            return;
        }
        switch (response.statusCode) {
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.getToken.bind(this), `Ratelimited, Rotating proxy and retrying`);
            case 201:
            case 200:
                const tokenObj = JSONParseSafely(response.body);
                if (!tokenObj?.access_token) throw new RetryExecutor(this.getToken.bind(this), 'Failed to refresh login session, Retrying');
                this.account.accessToken = tokenObj?.access_token;
                this.setCookies(tokenObj?.refresh_token, 'refreshToken');
                this.setCookies(tokenObj?.idToken, 'idToken');
                this.setCookies(this.account.accessToken, 'accessToken');
                return;
            case 401:
                throw new StopTask('Login session expired, Stopping');
            default:
                throw new RetryExecutor(this.getToken.bind(this), `Failed to refresh login session (${response.statusCode}), Retrying`);
        }
    }

    private async getStoreRadius() {
        this.updateStatus('Getting nearby target stores');
        let response: any;
        try {
            response = await this.httpClient.get(
                `https://redsky.target.com/v3/stores/nearby/${this.profile.shippingAddress.zip}?key=ff457966e64d5e877fdbad070f276d18ecec4a01&limit=20&within=${this.storeRadius}`,
                {
                    headers: {
                        accept: 'application/json',
                        'accept-encoding': 'gzip, deflate, br',
                        'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
                        'cache-control': 'no-cache',
                        origin: 'https://www.target.com',
                        pragma: 'no-cache',
                        referer: 'https://www.target.com/c/order-pickup/-/N-ng0a0',
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'sec-ch-ua-mobile': '?0',
                        'sec-fetch-dest': 'empty',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-site': 'same-site',
                        'user-agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.164 Safari/537.36',
                    },
                }
            );
        } catch (e) {
            Env.isDev && console.log(e.message);
            this.handleConnectionError(e, this.getStoreRadius.bind(this), 'finding nearby stores');
            return;
        }
        const stores = JSONParseSafely(response.body)?.[0]?.locations?.map((x) => x?.location_id);
        if (!stores || stores.length === 0) throw new RetryExecutor(this.getStoreRadius.bind(this), `Couldn't find nearby store, Retrying`);

        if (Env.isDev) console.log(stores);
        this.stores = stores;
        this.storeId = stores[0];
    }

    private async removeProduct() {
        let response: any;
        try {
            response = await this.httpClient.delete(
                `https://carts.target.com/web_checkouts/v1/cart_items/${this.dummyItemId}?cart_type=REGULAR&field_groups=CART%2CCART_ITEMS%2CSUMMARY%2CPROMOTION_CODES%2CADDRESSES%2CFINANCE_PROVIDERS%2CFINANCE_PROVIDERS&key=feaf228eb2777fd3eee0fd5192ae7107d6224b39`,
                {
                    headers: {
                        Accept: 'application/json',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
                        Connection: 'keep-alive',
                        'Content-Type': 'application/json',
                        Host: 'carts.target.com',
                        Origin: 'https://www.target.com',
                        Referer: `https://www.target.com/p/-/-/${this.task.product.id}`,
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'sec-ch-ua-mobile': '?0',
                        'Sec-Fetch-Dest': 'empty',
                        'Sec-Fetch-Mode': 'cors',
                        'Sec-Fetch-Site': 'same-site',
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'x-application-name': 'web',
                    },
                }
            );
        } catch (e) {
            Env.isDev && console.log(e.message);
            this.handleConnectionError(e, this.removeProduct.bind(this), 'Removing dummy product');
            return;
        }

        switch (response.statusCode) {
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.removeProduct.bind(this), `Ratelimited, Rotating proxy and retrying`);
            case 404:
            case 201:
            case 200:
                break;
            default:
                this.tries.remove++;
                if (this.tries.remove > 5) {
                    throw new StopTask(`Failed to remove dummy, Stopping`);
                }
                throw new RetryExecutor(this.removeProduct.bind(this), `Unable to remove dummy (${response.statusCode}), Retrying`);
        }
    }

    private async visitProductPage() {
        let response: any;
        try {
            response = await this.httpClient.get(`https://www.target.com/p/-/-/A-81280078`, {
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                    'accept-encoding': 'gzip, deflate, br',
                    'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
                    'cache-control': 'no-cache',
                    pragma: 'no-cache',
                    referer: 'https://www.target.com/co-cart',
                    'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-fetch-dest': 'document',
                    'sec-fetch-mode': 'navigate',
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-user': '?1',
                    'upgrade-insecure-requests': '1',
                    'user-agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                },
            });
        } catch (e) {
            this.handleConnectionError(e, this.visitProductPage.bind(this), 'Visiting product page');
            return;
        }
    }

    private async visitCheckout() {
        let response: any;
        try {
            response = await this.httpClient.get(`https://www.target.com/co-review?precheckout=true`, {
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                    'accept-encoding': 'gzip, deflate, br',
                    'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
                    'cache-control': 'no-cache',
                    pragma: 'no-cache',
                    referer: 'https://www.target.com/co-cart',
                    'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-fetch-dest': 'document',
                    'sec-fetch-mode': 'navigate',
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-user': '?1',
                    'upgrade-insecure-requests': '1',
                    'user-agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                },
            });
        } catch (e) {
            this.handleConnectionError(e, this.visitCheckout.bind(this), 'Visiting checkout');
            return;
        }
    }

    private async cleanShippingAddresses() {
        let shippingAddresses;
        while (!this.shouldStopTask) {
            shippingAddresses = await this.getShippingAddresses();
            const numAddresses = shippingAddresses?.['meta_data']?.['total_count'];
            if (Number.isInteger(numAddresses)) {
                break;
            }
            await this.waitRetry();
        }

        let addresses = (shippingAddresses?.addresses).filter((x) => x?.address?.address_type !== 'B');
        if (addresses.length === 0) return;
        let promises: Promise<void>[] = [];
        for (const address of addresses) {
            const id = address?.address?.['address_id'];
            if (id) {
                promises.push(this.removeAddress(id));
            }
        }
        try {
            let nbErrors = 0;
            const results = await Promise.allSettled(promises);
            for (const result of results) {
                if (result.status === 'rejected') nbErrors++;
            }
        } catch (e) {
            throw new RetryExecutor(this.cleanShippingAddresses.bind(this), 'Failed to clean shipping addresses. Retrying');
        }
    }

    private async getShippingAddresses() {
        let response: any;
        try {
            response = await this.httpClient.get(`https://api.target.com/guest_addresses/v1/addresses`, {
                headers: {
                    accept: 'application/json',
                    'accept-encoding': 'gzip, deflate, br',
                    'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
                    'cache-control': 'no-cache',
                    origin: 'https://www.target.com',
                    pragma: 'no-cache',
                    referer: 'https://www.target.com/',
                    'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-site',
                    'user-agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'x-api-key': 'ff457966e64d5e877fdbad070f276d18ecec4a01',
                },
            });
        } catch (e) {
            this.handleConnectionError(e, undefined, 'Getting shipping addresses');
            Env.isDev && console.log(e.name);
            return undefined;
        }
        switch (response.statusCode) {
            case 429:
                this.rotateProxy();
                return undefined;
            case 200:
                return JSONParseSafely(response.body);
            case 401:
                throw new StopTask('Login session expired, Stopping');
        }
    }

    private async removeAddress(addressID: string) {
        return new Promise<void>((resolve, reject) => {
            let response: any;
            try {
                response = this.httpClient.delete(
                    `https://api.target.com/guest_addresses/v1/addresses/${addressID}?key=a770bb029cbcb909b2d00ef9a5291f7189a4ef19`,
                    {
                        headers: {
                            accept: 'application/json',
                            'accept-encoding': 'gzip, deflate, br',
                            'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
                            'cache-control': 'no-cache',
                            origin: 'https://www.target.com',
                            pragma: 'no-cache',
                            referer: 'https://www.target.com/',
                            'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                            'sec-ch-ua-mobile': '?0',
                            'sec-fetch-dest': 'empty',
                            'sec-fetch-mode': 'cors',
                            'sec-fetch-site': 'same-site',
                            'user-agent':
                                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        },
                    }
                );
            } catch (e) {
                this.handleConnectionError(e, undefined, 'Removing shipping addresses');
                reject();
            }
            switch (response?.statusCode) {
                case 204:
                    resolve();
                    break;
                case 401:
                    throw new StopTask('Login session expired, Stopping');
                default:
                    reject();
            }
        });
    }

    private async getCart() {
        this.setStatus('Starting task ...', TaskStatusColor.Info);
        let response: any;
        try {
            response = await this.httpClient.get(
                `https://carts.target.com/web_checkouts/v1/cart_views?cart_type=REGULAR&field_groups=ADDRESSES%2CCART%2CCART_ITEMS%2CPAYMENT_INSTRUCTIONS%2CPICKUP_INSTRUCTIONS%2CPROMOTION_CODES%2CSUMMARY%2CFINANCE_PROVIDERS&key=feaf228eb2777fd3eee0fd5192ae7107d6224b39`,
                {
                    headers: {
                        Accept: 'application/json',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
                        Connection: 'keep-alive',
                        'Content-Type': 'application/json',
                        Host: 'carts.target.com',
                        Origin: 'https://www.target.com',
                        Referer: `https://www.target.com/p/-/-/A-${this.task.product.id}`,
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'sec-ch-ua-mobile': '?0',
                        'Sec-Fetch-Dest': 'empty',
                        'Sec-Fetch-Mode': 'cors',
                        'Sec-Fetch-Site': 'same-site',
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'x-application-name': 'web',
                    },
                }
            );
        } catch (e) {
            this.handleConnectionError(e, this.getCart.bind(this), 'Getting cart');
            return;
        }
        switch (response.statusCode) {
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.getCart.bind(this), `Ratelimited, Retrying`);
            case 201:
            case 200:
                const cartObj = JSONParseSafely(response.body);
                this.channelId = cartObj?.channel_id;
                this.shippingId = cartObj?.addresses?.filter((x) => x.address_id)[0]?.address_id;
                this.paymentId = cartObj?.payment_instructions?.[0]?.payment_instruction_id;
                this.pickupId = cartObj?.pickup_instructions?.[0]?.pickup_id;
                this.checkpoints = {
                    requiresBilling: !cartObj?.indicators?.has_payment_applied && !cartObj?.has_payment_satisfied,
                    requiresShipping: !cartObj?.indicators?.has_address_associated_all,
                };
                break;
            case 401:
                throw new StopTask('Login session expired, Stopping');
            default:
                throw new RetryExecutor(this.getCart.bind(this), `Unable to get cart (${response.statusCode}), Retrying`);
        }
    }

    private async addToCart(isDummy: boolean = false) {
        let response: any;
        if (!isDummy) this.updateStatus('Adding to cart', TaskStatusColor.Neutral);
        try {
            response = await this.httpClient.post(
                `https://carts.target.com/web_checkouts/v1/cart_items?field_groups=CART%2CCART_ITEMS%2CSUMMARY%2CFINANCE_PROVIDERS&key=feaf228eb2777fd3eee0fd5192ae7107d6224b39`,
                {
                    json: {
                        cart_type: 'REGULAR',
                        channel_id: this.channelId,
                        shopping_context: 'DIGITAL',
                        cart_item: {
                            tcin: isDummy ? '81280078' : this.sku,
                            quantity: 1,
                            item_channel_id: this.channelId,
                        },
                        ...(this.isPickup && !isDummy
                            ? {
                                  fulfillment: {
                                      type: 'PICKUP',
                                      location_id: this.storeId,
                                      ship_method: 'STORE_PICKUP',
                                  },
                              }
                            : {}),
                    },
                    headers: {
                        Accept: 'application/json',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
                        Connection: 'keep-alive',
                        'Content-Type': 'application/json',
                        Host: 'carts.target.com',
                        Origin: 'https://www.target.com',
                        Referer: `https://www.target.com/p/-/-/A-${this.task.product.id}`,
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'sec-ch-ua-mobile': '?0',
                        'Sec-Fetch-Dest': 'empty',
                        'Sec-Fetch-Mode': 'cors',
                        'Sec-Fetch-Site': 'same-site',
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'x-application-name': 'web',
                    },
                }
            );
        } catch (e) {
            this.handleConnectionError(e, this.addToCart.bind(this), 'Adding to cart');
            return;
        }
        switch (response.statusCode) {
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.addToCart.bind(this), `Ratelimited, Rotating proxy and retrying`);
            case 201:
            case 200:
                const cartObj = JSONParseSafely(response?.body);
                if (isDummy) this.dummyItemId = cartObj.cart_item_id;
                this.cartId = cartObj.cart_id;
                this.task.product = new Product({
                    ...this.task.product,
                    name: cartObj?.item_attributes?.description,
                    image: cartObj?.item_attributes?.image_path,
                    price: `$${cartObj?.current_price}`,
                    size: new Size('N/A', 'N/A', '-'),
                });
                if (!isDummy)
                    this.setStatus(`Added ${isDummy ? 'dummy item' : this.task.product.name} to cart !`, TaskStatusColor.Cart, TaskEvent.Carted);
                break;
            case 403:
                if (this.isPickup) this.rotateStore();
                throw new RetryExecutor(this.addToCart.bind(this), `PID Locked, Retrying ...`);
            default:
                const errorObj = JSONParseSafely(response?.body)?.alerts?.[0];
                if (errorObj) {
                    switch (errorObj.code) {
                        case 'INVENTORY_UNAVAILABLE':
                            if (this.isPickup) this.rotateStore();
                            throw new RetryExecutor(this.addToCart.bind(this), `${this.sku} is currently OOS, Retrying`);
                        default:
                            if (this.isPickup) this.rotateStore();
                            this.tries.atc++;
                            throw new RetryExecutor(this.addToCart.bind(this), `Failed to cart - ${errorObj.message}, Retrying`);
                    }
                } else {
                    this.tries.atc++;
                    throw new RetryExecutor(this.addToCart.bind(this), `Unable to cart (${response.statusCode}), Retrying`);
                }
        }
    }

    private async setPickup() {
        if (this.task.mode !== TargetModes.Preload) this.setStatus(`Setting pickup store (${this.storeId})`);
        let response: any;
        try {
            response = await this.httpClient.post(
                `https://carts.target.com/web_checkouts/v1/cart_pickup_instructions?field_groups=ADDRESSES%2CCART%2CCART_ITEMS%2CPICKUP_INSTRUCTIONS%2CPROMOTION_CODES%2CSUMMARY%2CFINANCE_PROVIDERS&key=feaf228eb2777fd3eee0fd5192ae7107d6224b39`,
                {
                    json: {
                        cart_id: this.cartId,
                        cart_type: 'REGULAR',
                        guest_email_id: this.profile.shippingAddress.email,
                        pickup_instruction: {
                            first_name: this.profile.shippingAddress.firstName,
                            last_name: this.profile.shippingAddress.lastName,
                            email: this.profile.shippingAddress.email,
                            nominee_first_name: '',
                            nominee_last_name: '',
                            nominee_email: '',
                        },
                    },
                    headers: {
                        Accept: 'application/json',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
                        Connection: 'keep-alive',
                        'Content-Type': 'application/json',
                        Host: 'carts.target.com',
                        Origin: 'https://www.target.com',
                        Referer: 'https://www.target.com/co-shipping',
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'sec-ch-ua-mobile': '?0',
                        'Sec-Fetch-Dest': 'empty',
                        'Sec-Fetch-Mode': 'cors',
                        'Sec-Fetch-Site': 'same-site',
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'x-application-name': 'web',
                    },
                }
            );
        } catch (e) {
            this.handleConnectionError(e, this.setPickup.bind(this), 'Editting pickup instructions');
            return;
        }

        switch (response.statusCode) {
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.setPickup.bind(this), `Ratelimited, Retrying`);
            case 201:
            case 200:
                break;
            case 400:
                if (Env.isDev) console.log(response.body);
                throw new RetryExecutor(this.setPickup.bind(this), `Unable to edit pickup instructions (${response.statusCode}), Retrying`);
        }
    }

    private async editPickup() {
        if (this.task.mode !== TargetModes.Preload) this.setStatus(`Setting pickup store (${this.storeId})`);
        let response: any;
        try {
            response = await this.httpClient.put(
                `https://carts.target.com/web_checkouts/v1/cart_pickup_instructions/${this.pickupId}?field_groups=ADDRESSES%2CCART%2CCART_ITEMS%2CPICKUP_INSTRUCTIONS%2CPROMOTION_CODES%2CSUMMARY%2CFINANCE_PROVIDERS&key=feaf228eb2777fd3eee0fd5192ae7107d6224b39`,
                {
                    json: {
                        cart_id: this.cartId,
                        cart_type: 'REGULAR',
                        guest_email_id: this.profile.shippingAddress.email,
                        pickup_instruction: {
                            first_name: this.profile.shippingAddress.firstName,
                            last_name: this.profile.shippingAddress.lastName,
                            email: this.profile.shippingAddress.email,
                            nominee_first_name: '',
                            nominee_last_name: '',
                            nominee_email: '',
                        },
                    },
                    headers: {
                        Accept: 'application/json',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
                        Connection: 'keep-alive',
                        'Content-Type': 'application/json',
                        Host: 'carts.target.com',
                        Origin: 'https://www.target.com',
                        Referer: 'https://www.target.com/co-shipping',
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'sec-ch-ua-mobile': '?0',
                        'Sec-Fetch-Dest': 'empty',
                        'Sec-Fetch-Mode': 'cors',
                        'Sec-Fetch-Site': 'same-site',
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'x-application-name': 'web',
                    },
                }
            );
        } catch (e) {
            this.handleConnectionError(e, this.editPickup.bind(this), 'Editting pickup instructions');
            return;
        }

        switch (response.statusCode) {
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.editPickup.bind(this), `Ratelimited, Retrying`);
            case 201:
            case 200:
                break;
            case 400:
                if (Env.isDev) console.log(response.body);
                throw new RetryExecutor(this.editPickup.bind(this), `Unable to edit pickup instructions (${response.statusCode}), Retrying`);
        }
    }

    private async editShipping() {
        if (this.task.mode !== TargetModes.Preload) this.setStatus('Editting shipping infos ...');
        let response: any;
        try {
            response = await this.httpClient.put(
                `https://carts.target.com/web_checkouts/v1/cart_shipping_addresses/${this.shippingId}?field_groups=ADDRESSES%2CCART%2CCART_ITEMS%2CPICKUP_INSTRUCTIONS%2CPROMOTION_CODES%2CSUMMARY%2CFINANCE_PROVIDERS%2CFINANCE_PROVIDERS%2CFINANCE_PROVIDERS&key=feaf228eb2777fd3eee0fd5192ae7107d6224b39`,
                {
                    json: {
                        cart_type: 'REGULAR',
                        address: {
                            address_line1: this.profile.shippingAddress.address,
                            address_line2: this.profile.shippingAddress.secondaryAddress,
                            address_type: 'SHIPPING',
                            city: this.profile.shippingAddress.city,
                            country: this.profile.shippingAddress.country,
                            first_name: this.profile.shippingAddress.firstName,
                            last_name: this.profile.shippingAddress.lastName,
                            mobile: this.profile.shippingAddress.phone,
                            save_as_default: false,
                            state: this.profile.shippingAddress.stateCode,
                            zip_code: this.profile.shippingAddress.zip,
                        },
                        selected: true,
                        save_to_profile: true,
                        skip_verification: true,
                    },
                    headers: {
                        Accept: 'application/json',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
                        Connection: 'keep-alive',
                        'Content-Type': 'application/json',
                        Host: 'carts.target.com',
                        Origin: 'https://www.target.com',
                        Referer: 'https://www.target.com/co-shipping',
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'sec-ch-ua-mobile': '?0',
                        'Sec-Fetch-Dest': 'empty',
                        'Sec-Fetch-Mode': 'cors',
                        'Sec-Fetch-Site': 'same-site',
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'x-application-name': 'web',
                    },
                }
            );
        } catch (e) {
            this.handleConnectionError(e, this.editShipping.bind(this), 'Submitting shipping');
            return;
        }

        switch (response.statusCode) {
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.submitShipping.bind(this), `Ratelimited, Retrying`); //TODO is submitShipping correct here?
            case 201:
            case 200:
                break;
            case 424:
                this.setStatus('Too many addresses set, using default set address');
                break;
            case 400:
                if (JSONParseSafely(response?.body)?.code !== 'ADDRESS_ALREADY_PRESENT') {
                    this.tries.submitShipping++;
                    throw new RetryExecutor(this.submitShipping.bind(this), `Unable to submit shipping (${response.statusCode}), Retrying`);
                }
                this.updateStatus('Cart address already set');
                break;
            default:
                // console.log(response.body)
                throw new RetryExecutor(this.submitShipping.bind(this), `Unable to submit shipping (${response.statusCode}), Retrying`);
        }
    }

    private async submitShipping() {
        if (this.task.mode !== TargetModes.Preload) this.setStatus('Submitting shipping infos ...');
        let response: any;
        try {
            response = await this.httpClient.post(
                `https://carts.target.com/web_checkouts/v1/cart_shipping_addresses?field_groups=ADDRESSES%2CCART%2CCART_ITEMS%2CPICKUP_INSTRUCTIONS%2CPROMOTION_CODES%2CSUMMARY%2CFINANCE_PROVIDERS%2CFINANCE_PROVIDERS&key=feaf228eb2777fd3eee0fd5192ae7107d6224b39`,
                {
                    json: {
                        cart_type: 'REGULAR',
                        address: {
                            address_line1: this.profile.shippingAddress.address,
                            address_line2: this.profile.shippingAddress.secondaryAddress,
                            address_type: 'SHIPPING',
                            city: this.profile.shippingAddress.city,
                            country: this.profile.shippingAddress.country,
                            first_name: this.profile.shippingAddress.firstName,
                            last_name: this.profile.shippingAddress.lastName,
                            mobile: this.profile.shippingAddress.phone,
                            save_as_default: false,
                            state: this.profile.shippingAddress.stateCode,
                            zip_code: this.profile.shippingAddress.zip,
                        },
                        selected: true,
                        save_to_profile: true,
                        skip_verification: true,
                    },
                    headers: {
                        Accept: 'application/json',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
                        Connection: 'keep-alive',
                        'Content-Type': 'application/json',
                        Host: 'carts.target.com',
                        Origin: 'https://www.target.com',
                        Referer: 'https://www.target.com/co-shipping',
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'sec-ch-ua-mobile': '?0',
                        'Sec-Fetch-Dest': 'empty',
                        'Sec-Fetch-Mode': 'cors',
                        'Sec-Fetch-Site': 'same-site',
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'x-application-name': 'web',
                    },
                }
            );
        } catch (e) {
            this.handleConnectionError(e, this.submitShipping.bind(this), 'Submitting shipping');
            return;
        }
        switch (response.statusCode) {
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.submitShipping.bind(this), `Ratelimited, Rotating proxy and retrying`);
            case 201:
            case 200:
                break;
            case 400:
                if (JSONParseSafely(response?.body)?.code !== 'ADDRESS_ALREADY_PRESENT') {
                    throw new RetryExecutor(this.submitShipping.bind(this), `Unable to submit shipping (${response.statusCode}), Retrying`);
                }
                this.updateStatus('Cart address already set');
                break;
            default:
                throw new RetryExecutor(this.submitShipping.bind(this), `Unable to submit shipping (${response.statusCode}), Retrying`);
        }
    }

    private async editBilling() {
        if (this.task.mode !== TargetModes.Preload) this.setStatus('Editting billing infos ...');
        let response: any;
        try {
            response = await this.httpClient.put(
                `https://carts.target.com/checkout_payments/v1/payment_instructions/${this.paymentId}?key=feaf228eb2777fd3eee0fd5192ae7107d6224b39`,
                {
                    json: {
                        cart_id: this.cartId,
                        wallet_mode: 'ADD',
                        payment_type: 'CARD',
                        card_details: {
                            card_name: `${this.profile.billingAddress?.firstName} ${this.profile.billingAddress?.lastName}`,
                            card_number: this.profile.payment.number,
                            cvv: this.profile.payment.code,
                            expiry_month: this.profile.payment.month < 10 ? `0${this.profile.payment.month}` : `${this.profile.payment.month}`,
                            expiry_year: this.profile.payment.year.toString(),
                        },
                        billing_address: {
                            address_line1: this.profile.billingAddress?.address,
                            city: this.profile.billingAddress?.city,
                            first_name: this.profile.billingAddress?.firstName,
                            last_name: this.profile.billingAddress?.lastName,
                            phone: this.profile.billingAddress?.phone,
                            state: this.profile.billingAddress?.stateCode,
                            zip_code: this.profile.billingAddress?.zip,
                            country: this.profile.billingAddress?.country,
                        },
                    },
                    headers: {
                        Accept: 'application/json',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
                        Connection: 'keep-alive',
                        'Content-Type': 'application/json',
                        Host: 'carts.target.com',
                        Origin: 'https://www.target.com',
                        Referer: 'https://www.target.com/co-shipping',
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'sec-ch-ua-mobile': '?0',
                        'Sec-Fetch-Dest': 'empty',
                        'Sec-Fetch-Mode': 'cors',
                        'Sec-Fetch-Site': 'same-site',
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'x-application-name': 'web',
                    },
                }
            );
        } catch (e) {
            this.handleConnectionError(e, this.editBilling.bind(this), 'Submitting billing');
            return;
        }

        switch (response.statusCode) {
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.submitBilling.bind(this), `Ratelimited, Rotating proxy and retrying`);
            case 201:
            case 200:
                break;
            case 400:
                if (JSONParseSafely(response?.body)?.code !== 'INVALID_PAYMENT_COMBINATION') {
                    throw new RetryExecutor(this.submitBilling.bind(this), `Unable to submit billing (${response.statusCode}), Retrying`);
                }
                this.updateStatus('Cart billing already set');
                break;
            default:
                throw new RetryExecutor(this.submitBilling.bind(this), `Unable to submit billing (${response.statusCode}), Retrying`);
        }
    }

    private async submitBilling() {
        if (this.task.mode !== TargetModes.Preload) this.setStatus('Submitting billing infos ...');
        let response: any;
        try {
            response = await this.httpClient.post(
                `https://carts.target.com/checkout_payments/v1/payment_instructions?key=feaf228eb2777fd3eee0fd5192ae7107d6224b39`,
                {
                    json: {
                        cart_id: this.cartId,
                        wallet_mode: 'ADD',
                        payment_type: 'CARD',
                        card_details: {
                            card_name: `${this.profile.billingAddress?.firstName} ${this.profile.billingAddress?.lastName}`,
                            card_number: this.profile.payment.number,
                            cvv: this.profile.payment.code,
                            expiry_month: this.profile.payment.month < 10 ? `0${this.profile.payment.month}` : `${this.profile.payment.month}`,
                            expiry_year: this.profile.payment.year.toString(),
                        },
                        billing_address: {
                            address_line1: this.profile.billingAddress?.address,
                            city: this.profile.billingAddress?.city,
                            first_name: this.profile.billingAddress?.firstName,
                            last_name: this.profile.billingAddress?.lastName,
                            phone: this.profile.billingAddress?.phone,
                            state: this.profile.billingAddress?.stateCode,
                            zip_code: this.profile.billingAddress?.zip,
                            country: this.profile.billingAddress?.country,
                        },
                    },
                    headers: {
                        Accept: 'application/json',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
                        Connection: 'keep-alive',
                        'Content-Type': 'application/json',
                        Host: 'carts.target.com',
                        Origin: 'https://www.target.com',
                        Referer: 'https://www.target.com/co-shipping',
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'sec-ch-ua-mobile': '?0',
                        'Sec-Fetch-Dest': 'empty',
                        'Sec-Fetch-Mode': 'cors',
                        'Sec-Fetch-Site': 'same-site',
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'x-application-name': 'web',
                    },
                }
            );
        } catch (e) {
            this.handleConnectionError(e, this.submitBilling.bind(this), 'Submitting billing');
            return;
        }

        switch (response.statusCode) {
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.submitBilling.bind(this), `Ratelimited, Rotating proxy and retrying`);
            case 201:
            case 200:
                break;
            case 400:
                if (JSONParseSafely(response?.body)?.code !== 'INVALID_PAYMENT_COMBINATION') {
                    throw new RetryExecutor(this.submitBilling.bind(this), `Unable to submit billing (${response.statusCode}), Retrying`);
                }
                this.updateStatus('Cart billing already set');
                break;
            default:
                throw new RetryExecutor(this.submitBilling.bind(this), `Unable to submit billing (${response.statusCode}), Retrying`);
        }
    }

    private async placeOrder() {
        if (this.isPickup) this.task.mode = `${this.task.mode} (Pickup)`;
        this.task.checkoutProxy = this.proxy?.getUrl();
        let response: any;
        this.updateStatus('Placing order', TaskStatusColor.Neutral);
        try {
            response = await this.httpClient.post(
                `https://carts.target.com/web_checkouts/v1/checkout?field_groups=ADDRESSES%2CCART%2CCART_ITEMS%2CDELIVERY_WINDOWS%2CPAYMENT_INSTRUCTIONS%2CPICKUP_INSTRUCTIONS%2CPROMOTION_CODES%2CSUMMARY%2CFINANCE_PROVIDERS%2CFINANCE_PROVIDERS&key=feaf228eb2777fd3eee0fd5192ae7107d6224b39`,
                {
                    json: { cart_type: 'REGULAR', channel_id: this.channelId },
                    headers: {
                        Accept: 'application/json',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
                        Connection: 'keep-alive',
                        'Content-Type': 'application/json',
                        Host: 'carts.target.com',
                        Origin: 'https://www.target.com',
                        Referer: 'https://www.target.com/co-shipping',
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'sec-ch-ua-mobile': '?0',
                        'Sec-Fetch-Dest': 'empty',
                        'Sec-Fetch-Mode': 'cors',
                        'Sec-Fetch-Site': 'same-site',
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'x-application-name': 'web',
                    },
                }
            );
        } catch (e) {
            this.handleConnectionError(e, this.placeOrder.bind(this), 'Place order');
            return;
        }
        switch (response.statusCode) {
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.placeOrder.bind(this), `Ratelimited, Rotating proxy and retrying`);
            case 201:
            case 200:
                this.setStatus('Successfully checked out !', TaskStatusColor.Success, TaskEvent.CheckoutSuccess);
                return;
            case 424:
                const orderObj = JSONParseSafely(response?.body);
                switch (orderObj.code) {
                    //TODO, ADD ALL EXCEPTIONS
                    case 'PAYMENT_DECLINED_EXCEPTION':
                        this.setStatus('Checkout failure, card declined.', TaskStatusColor.Error, TaskEvent.CheckoutDecline);
                        break;
                    default:
                        this.tries.placeOrder++;
                        if (this.tries.placeOrder > 5) {
                            throw new StopTask(`Failed to place order, Stopping`);
                        }
                        throw new RetryExecutor(this.placeOrder.bind(this), `Failed to place order ${orderObj.message}, Retrying`);
                }
                break;
            default:
                Env.isDev && console.log(response.body);
                throw new RetryExecutor(this.placeOrder.bind(this), `Unable to place order (${response.statusCode}), Retrying`);
        }
    }
}
