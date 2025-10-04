import { JSONParseSafely, sleep } from '../../../lib/helpers';
import { TaskEvent, TaskStatusColor } from '../../../lib/models/taskUpdate';
import BotTask, { BotTaskProperties } from '../models/tasks/botTask';
import { RetryExecutor, StopTask } from '../../../lib/errors';
import { request } from '../../../http-client';
import moment from 'moment';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import Size from '../../../lib/models/size';
import got from 'got/dist/source';
import Product from '../../../lib/models/product';
import { ZalandoModes } from '.';
import Env from '../env';

const akamaiCookies = ['_abck', 'bm_sv', 'bm_mi', 'ak_bmsc', 'bm_sz'];
const akamaiEndpoints = {
    'zalando.fi': 'https://www.zalando.fi/wRF8-ct02PjT/jd8JJi/0ck5zM/zYuGVfVwDEOa/biVUdhwB/Cw8d/E0MfFCE',
    'zalando.dk': 'https://www.zalando.dk/NJX8nfhHv_Qw/t0qMX0p5qr/CP/c35hzJfw/HV9rWxMtAg/XxpEKT4/UEGE',
    'zalando.se': 'https://www.zalando.se/9JLp32/B1i/tdu/WaCaIw/VaVaQSXDimab/VwgDKA/Z2/1wRxFEFT8',
    'zalando.no': 'https://www.zalando.no/I61aW25Xa4ei5/MqC2MY/OKszNDJw/aVJiJJwNEY/KWVMWWlW/STBtX/l4CXjg',
    'zalando.cz': 'https://www.zalando.cz/KGG4kQGyH40A7SNW1TR5rQtaPBk/aJONmSt6Oz/UmhvDi0VAQM/dWFrNU/8TJzU',
    'zalando.nl': 'https://www.zalando.nl/uQA9md/x/y/pSlohttU0aMw/EOf3mzzwt5/WChw/Jm/pWIFZdQj4',
    'zalando.es': 'https://www.zalando.es/SCAuWD/rYCL7/Bm_nt/6Q/O9irm6Q2uN/SWMRIi4B/dA/ttRFtWMSk',
    'zalando.it': 'https://www.zalando.it/IIswEvzVLiqIA/SPz65V8WZ/VDvsY/afp1pQ4fhY/FWkIAQ/Cxp/xWxhyLyc',
    'zalando.pl': 'https://www.zalando.pl/GDWti8Ur21QdD0-LYg/huO90QSXYf/H0YtIFFvSg/LRB/CCm8cGWM',
    'zalando.co.uk': 'https://www.zalando.co.uk/EN2aIw/ZNDav/ZvOVa/vA/fuz9cJVQafku/TVIrUAROBg/MFpoP/FpcDUs',
    'zalando.ch': 'https://it.zalando.ch/SGHXZjhk9AYO/DhBpFW/H7vysa/ziw1f6pG/OH4vDE9pBQ/FRQ/6aREKPzA',
    'zalando.at': 'https://www.zalando.at/36QWfEOiZHfe6/4A/w0I05hagPj6E/t1L7GQzcuk/W2poWkgCAw/GnN/UPWdxIxg',
    'zalando.de': 'https://en.zalando.de/ZO_y2S/Rr/Wq/KzNH/zBBpmdX0o3/XYEaNzQc/bGdLUXc/RFR9BD/l4VQU',
    'zalando.fr': 'https://www.zalando.fr/r1aQzk/_yDgg/pVm-Q/JvuH/7uL18kLJOzS1/HjY1HVUB/cB85f/XN6W0M',
    'zalando.be': 'https://fr.zalando.be/C41pAqtj/MAS3lIO/3fYEiLV/YF/5X9Ertkw/eD8hahxXGAE/VVQ6Ak1/-FCM',
    'zalando.ie': 'https://www.zalando.ie/hPnCs54AjAYv5kcgXQxN/zYX5crkS/DCRTdgwB/S0QCLy/9KVWw',
};

export default class Zalando extends BotTask {
    private url: string;
    private host: string;
    private akamaiEp: string;

    private tries: {
        getBackendStock: number;
        getStock: number;
        getCartproducts: number;
        getLoginPage: number;
        removeProduct: number;
        addAddress: number;
        login: number;
        atc: number;
        getAddresses: number;
        setAddress: number;
        getNextStep: number;
        getPaymentMethods: number;
        submitPaymentMethod: number;
        comfirmPaymentMethod: number;
        getCheckout: number;
        placeOrder: number;
    } = {
        getBackendStock: 0,
        getStock: 0,
        getLoginPage: 0,
        getCartproducts: 0,
        addAddress: 0,
        removeProduct: 0,
        login: 0,
        atc: 0,
        getAddresses: 0,
        setAddress: 0,
        getNextStep: 0,
        getPaymentMethods: 0,
        submitPaymentMethod: 0,
        comfirmPaymentMethod: 0,
        getCheckout: 0,
        placeOrder: 0,
    };

    private ua: string = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

    private abckTs: number = 0;
    private currentAbck?: string;
    private sensorData?: string;

    private preloading: boolean = false;
    private precarting: boolean = false;
    private releaseTs?: number;
    private isComingSoon: boolean = false;

    private flowId?: string;
    private addressId?: string;
    private xsrf?: string;
    private clientId?: string;
    private sessionId?: string;
    private eTag?: string;
    private checkoutId?: string;

    private cartContent: string[] = [];
    private skuRemoval?: string;
    private account: {
        email: string;
        password: string;
    };

    protected *execute() {
        this.preloading = this.task.mode === ZalandoModes.Preload || this.task.mode === ZalandoModes.Restock;

        yield this.getUa();
        yield this.executeLogin();

        if (this.preloading) {
            this.setStatus('Starting preload sequence', TaskStatusColor.Info);
            yield this.executePreload();
            this.preloading = false;
            this.setStatus('Preload session ready', TaskStatusColor.Info);
            yield this.executeAtc();
        } else {
            yield this.executeAtc();
            yield this.submitInformations();
        }

        yield this.getCheckout();
        yield this.placeOrder();
    }

    constructor(botTaskProps: BotTaskProperties) {
        super(botTaskProps);
        this.retryDelay = this.task.monitorDelay || 3000;

        this.url = this.task.product.id;
        this.host = new URL(this.url).hostname;

        this.akamaiEp = akamaiEndpoints[this.host.replace(`${this.host.split('.')[0]}.`, '')];
        this.task.websiteName = `Zalando ${this.host.split('.')[2]?.toUpperCase()}`;

        let urlParts = this.url.split('.html')[0].split('-');
        this.task.product.id = [urlParts.pop(), urlParts.pop()].reverse().join('-').toUpperCase();

        this.account = {
            email: this.task.username || '',
            password: this.task.password || '',
        };
    }

    async sleep() {
        await sleep(100);
    }

    private isRetry(name: string): boolean {
        if (typeof this.tries[name] !== 'number') return false;
        this.tries[name]++;
        return true;
    }

    private async executeLogin() {
        await this.getLoginPage();
        await this.handleAkamai();
        await this.login();
    }

    private async executeAtc() {
        await this.getBackendStock();
        if (this.isComingSoon) {
            this.setStatus(`${this.task.product.name} is set to drop soon, getting exact drop time`, TaskStatusColor.Info);
            await this.getStock();
        }
        if (this.releaseTs) {
            this.updateStatus(
                `Waiting for ${this.task.product.name} to release - Starting at ${new Date(this.releaseTs as number).toLocaleString()}`,
                TaskStatusColor.Info
            );
            const sleepFor = (this.releaseTs as number) - Date.now();
            await sleep(sleepFor > 0 ? sleepFor : 0);
        }
        if (this.precarting) {
            if (!this.task.sizes.random) {
                this.task.product.size = this.task.sizes.getSize();
                await this.atc();
            } else {
                for (let i in this.task.sizes.availableSizes) {
                    this.task.product.size = this.task.sizes.availableSizes[i];
                    await this.atc();
                    this.task.sizes.removeCurrentSize();
                }
            }
        } else await this.atc();
    }

    private async executePreload() {
        await this.atc(true);
        await this.submitInformations();
        await this.clearCart();
    }

    private async submitInformations() {
        await this.getAddresses();
        if (!this.addressId) await this.addAddress();
        await this.setAddress();
        await this.getNextStep();
        await this.getPaymentMethods();
        await this.submitPaymentMethod();
        await this.comfirmPaymentMethod();
    }

    private async clearCart() {
        await this.getCartproducts();
        while (this.cartContent.length > 0) {
            this.skuRemoval = this.cartContent.pop();
            await this.removeProduct();
        }
        if (!this.preloading) this.updateStatus('Cleaned cart !', TaskStatusColor.Info);
        return;
    }

    private async handleAkamai() {
        this.setStatus(`Generating akamai ...`);
        await this.getInvalidAbck();
        for (let i = 0; i < 4; i++) {
            await this.getSensor();
            await this.postSensor();
        }
        if (this.currentAbck?.includes('||')) {
            this.updateStatus('Akamai challenge detected, solving ...', TaskStatusColor.Warning);
            await this.handleAkamai.bind(this);
        }
        this.abckTs = Date.now();
        this.setStatus('Generated akamai', TaskStatusColor.Info);
    }

    private async getInvalidAbck() {
        const { headers } = await request({
            url: akamaiEndpoints[this.host.replace(`${this.host.split('.')[0]}.`, '')],
            method: 'GET',
            headers: {
                connection: 'keep-alive',
                'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                'sec-ch-ua-mobile': '?0',
                'user-agent': this.ua,
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

    private async getUa() {
        const { body } = await got.get('https://ak01-eu.hwkapi.com/akamai/ua', {
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': '022921a2-ae7a-11eb-8529-0242ac130003',
                'X-Sec': 'low',
            },
            throwHttpErrors: false,
        });
        this.ua = body;
    }

    private async getSensor() {
        const { body } = await request({
            url: 'https://ak01-eu.hwkapi.com/akamai/generate',
            body: JSON.stringify({
                site: `https://${this.host}/login?view=myaccount`,
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
        const response = await request({
            url: akamaiEndpoints[this.host.replace(`${this.host.split('.')[0]}.`, '')],
            method: 'POST',
            body: json,
            headers: {
                'content-length': json.length,
                'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                dpr: '1',
                'sec-ch-ua-mobile': '?0',
                'user-agent': this.ua,
                'viewport-width': '1852',
                'content-type': 'text/plain;charset=UTF-8',
                accept: '*/*',
                origin: `https://${this.host}`,
                'sec-fetch-site': 'same-origin',
                'sec-fetch-mode': 'cors',
                'sec-fetch-dest': 'empty',
                referer: `https://${this.host}/`,
                'accept-encoding': 'gzip, deflate, br',
                'accept-language': 'fr-FR,fr;q=0.9',
            },
            jar: this.cookieJar,
            proxy: this.proxy?.getUrl(),
        });
        response.headers['set-cookie']?.forEach((cookie) => {
            const key = cookie.split('=')[0];
            const value = cookie.split(`${key}=`)[1]?.split(';')[0];
            if (key === '_abck') this.currentAbck = value;
        });
    }

    private async getLoginPage() {
        let response: any;
        this.updateStatus('Visiting login page', TaskStatusColor.Neutral);
        try {
            response = await request({
                url: `https://${this.host}/login?target=/myaccount/`,
                method: 'GET',
                headers: {
                    Connection: 'keep-alive',
                    'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                    'sec-ch-ua-mobile': '?0',
                    'Upgrade-Insecure-Requests': '1',
                    'User-Agent': this.ua,
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-User': '?1',
                    'Sec-Fetch-Dest': 'document',
                    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
                },
                proxy: this.proxy?.getUrl(),
                jar: this.cookieJar,
            });
        } catch (e) {
            Env.isDev && console.log(e.message);
            throw new RetryExecutor(this.getLoginPage.bind(this), `Unknown Error`);
        }
        if (response.statusCode === 302 && response.headers?.location?.includes('login')) {
            this.host = response.headers?.location?.split('/')[2];
            throw new RetryExecutor(this.executeLogin.bind(this), `Subdomain redirection detected, Switching region and retrying`);
        }
        if (response.statusCode !== 200) {
            throw new RetryExecutor(this.getLoginPage.bind(this), `Couldn't reach login page (${response.statusCode}), Retrying`);
        }
        this.flowId = cheerio.load(response?.body)('#TrackingFlowidBearer')?.attr('data-flow-id');
        let responseCookies = response?.headers?.['set-cookie'] || [];
        responseCookies.forEach((cookie) => {
            const key = cookie.split('=')[0];
            const value = cookie.split(`${key}=`)[1].split(';')[0];
            switch (key) {
                case '_abck':
                    this.currentAbck = value;
                    break;
                case 'frsx':
                    this.xsrf = value;
                    break;
                case 'Zalando-Client-Id':
                    this.clientId = value;
                    break;
            }
        });
    }

    private async login() {
        let response: any;
        const loginPayload = JSON.stringify({
            username: this.account.email,
            password: this.account.password,
            wnaMode: 'shop',
        });
        this.updateStatus('Logging in', TaskStatusColor.Neutral);
        try {
            response = await request({
                url: `https://${this.host}/api/reef/login`,
                method: 'POST',
                body: loginPayload,
                headers: {
                    'content-length': loginPayload.length,
                    'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                    'x-xsrf-token': this.xsrf,
                    'x-flow-id': this.flowId,
                    'x-zalando-render-page-uri': '/login?target=/myaccount/',
                    'x-zalando-client-id': this.clientId,
                    'viewport-width': '980',
                    'content-type': 'application/json',
                    'x-zalando-request-uri': '/login?target=/myaccount/',
                    accept: 'application/json',
                    'x-zalando-toggle-label': 'THE_LABEL_IS_ENABLED',
                    'sec-ch-ua-mobile': '?0',
                    'user-agent': this.ua,
                    dpr: '1',
                    origin: `https://${this.host}`,
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    referer: `https://${this.host}/login?target=/myaccount/`,
                    'accept-encoding': 'gzip, deflate, br',
                    'accept-language': 'fr-FR,fr;q=0.9',
                },
                'HEADER-ORDER': [
                    'content-length',
                    'sec-ch-ua',
                    'x-xsrf-token',
                    'x-flow-id',
                    'x-zalando-render-page-uri',
                    'x-zalando-client-id',
                    'viewport-width',
                    'content-type',
                    'x-zalando-request-uri',
                    'accept',
                    'x-zalando-toggle-label',
                    'sec-ch-ua-mobile',
                    'user-agent',
                    'dpr',
                    'origin',
                    'sec-fetch-site',
                    'sec-fetch-mode',
                    'sec-fetch-dest',
                    'referer',
                    'accept-encoding',
                    'accept-language',
                ],
                proxy: this.proxy?.getUrl(),
                jar: this.cookieJar,
            });
        } catch (e) {
            throw new RetryExecutor(this.login.bind(this), `Unknown Error`);
        }
        switch (response?.statusCode) {
            case 201:
                this.setStatus(`Logged in ${this.account.email} !`, TaskStatusColor.Info);
                break;
            case 403:
                this.rotateProxy();
                this.setStatus('Blocked by akamai Solving ...', TaskStatusColor.Warning);
                await this.handleAkamai();
                throw new RetryExecutor(this.login.bind(this), `Retrying to login (${this.account.email})`);
            default:
                if (this.isRetry('login'))
                    throw new RetryExecutor(this.login.bind(this), `Failed to login ${this.account.email} (${response.statusCode}), Retrying`);
                else throw new StopTask(`Couldn't login (${response.statusCode}), Stopping`);
        }
    }

    private rotateSize() {
        const currentSize = this.task.sizes.getNextSize();
        if (!currentSize) return this.updateStatus('No matching sizes found', TaskStatusColor.Warning);
        this.task.product.size = currentSize;
    }

    private setTimer(date: string) {
        const diff = new Date().getTimezoneOffset() * -60000;
        const zalandoTs = moment(date, 'YY-MM-DD HH:mm:ss').valueOf();
        this.releaseTs = zalandoTs + diff;
    }

    private async getBackendStock() {
        let response: any;
        this.updateStatus('Getting backend stock', TaskStatusColor.Neutral);
        try {
            response = await request({
                url: `https://${this.host}/api/graphql/mobile`,
                method: 'POST',
                body: JSON.stringify({
                    extensions: {
                        persistedQuery: {
                            sha256Hash: '986b7e881a8375f3bd5f01d3fb867a9923c964cc0992aac072bcfe08ecf9f2cb',
                            version: 1,
                        },
                    },
                    id: '986b7e881a8375f3bd5f01d3fb867a9923c964cc0992aac072bcfe08ecf9f2cb',
                    operationName: 'Pdp',
                    variables: {
                        beautyColorImageWidth: 1,
                        colorImageWidth: 76,
                        configSku: this.task.product.id,
                        fullScreenGalleryWidth: 1200,
                        fullScreenHdGalleryWidth: 2600,
                        maxFlagCount: 3,
                        portraitGalleryWidth: 1125,
                        shouldIncludeHistogramValues: false,
                    },
                }),
                headers: {
                    Host: this.host,
                    'x-device-platform': 'ios',
                    Accept: 'application/json, text/javascript,/; q=0.01',
                    'x-app-version': '5.4.1',
                    'User-Agent': 'zalando/5.4.1 (iPhone; iOS 14.4.2; Scale/3.00)',
                    'X-device-Type': 'smartphone',
                    'apollographql-client-name': 'de.zalando.iphone-apollo-ios',
                    'apollographql-client-version': '5.4.1-16030',
                    'x-uuid': '843622D6-A3DC-4BB1-8425-E4AE32504688',
                    'X-ZALANDO-DEBUG': 'app-pdp-recos=true',
                    'x-app-domain': '15',
                    'X-APOLLO-OPERATION-TYPE': 'query',
                    'Accept-Language': 'it-IT',
                    'X-Logged-In': 'false',
                    'X-APOLLO-OPERATION-NAME': 'Pdp',
                    'X-device-OS': 'ios',
                    'x-zalando-feature': 'pdp',
                    Connection: 'keep-alive',
                    'Content-Type': 'application/json',
                    'X-Frontend-Type': 'mobile-app',
                    'x-os-version': '14.4.2',
                },
                jar: this.cookieJar,
                proxy: this.proxy?.getUrl()
            });
        } catch (e) {
            throw new RetryExecutor(this.getBackendStock.bind(this), `Unknown Error`);
        }
        if (response.statusCode !== 200) {
            if (this.isRetry('getBackendStock'))
                throw new RetryExecutor(this.getBackendStock.bind(this), `Couldn't get backend stock (${response.statusCode}), Retrying`);
            else throw new StopTask(`Couldn't reach backend (${response.statusCode}), Stopping`);
        }
        const productJson = JSONParseSafely(response?.body);
        const filteredArr = productJson?.data?.product?.simples
            ?.filter((x) => x.offer?.stock?.quantity !== 'OUT_OF_STOCK')
            .map((unit) => new Size(unit?.size, unit?.size, unit.sku));
        const sizeArr = productJson?.data?.product?.simples.map((unit) => new Size(unit?.size, unit?.size, unit.sku));
        this.isComingSoon = productJson?.data?.product?.comingSoon;
        this.task.product = new Product({
            ...this.task.product,
            name: productJson?.data?.product?.name,
            price: productJson?.data?.product?.displayPrice?.original?.formatted,
            image: productJson.data.product.fullScreenGalleryMedia[0].media.uri,
        });
        this.task.sizes.setAvailableSizes(filteredArr);
        const currentSize = this.task.sizes.getSize();
        if (!currentSize) {
            if (this.task.mode !== ZalandoModes.Restock)
                throw new RetryExecutor(this.getBackendStock.bind(this), `${this.task.product.name}, Monitoring`);
            else {
                this.precarting = true;
                this.task.sizes.setAvailableSizes(sizeArr);
                this.setStatus(`${this.task.product.name} is currently OOS, precarting ...`);
            }
        } else this.task.product.size = currentSize;
    }

    private async getStock() {
        let response: any;
        this.updateStatus('Visiting product page', TaskStatusColor.Neutral);
        try {
            response = await request({
                url: this.url,
                method: 'GET',
                headers: {
                    'user-agent': this.ua,
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                    'sec-fetch-site': 'none',
                    'sec-fetch-mode': 'navigate',
                    'sec-fetch-dest': 'document',
                    'cache-control': 'max-age=0',
                    'accept-language': 'en-US,en;q=0.9',
                    'accept-encoding': 'gzip, deflate, br',
                },
                jar: this.cookieJar,
                proxy: this.proxy?.getUrl()
            });
        } catch (e) {
            throw new RetryExecutor(this.getStock.bind(this), `Unknown Error`);
        }
        if (response.statusCode === 302) {
            const location = response.headers?.location;
            if (location) this.url = `https:${location}`;
            throw new RetryExecutor(this.getStock.bind(this), `Couldn't reach product page (Region redirect), Setting new url and retrying`);
        }
        if (response.statusCode !== 200) {
            if (this.isRetry('getStock'))
                throw new RetryExecutor(this.getStock.bind(this), `Couldn't reach product page (${response.statusCode}), Retrying`);
            else throw new StopTask(`Couldn't reach product page (${response.statusCode}), Stopping`);
        }
        let stockObj: any;
        try {
            const $ = cheerio.load(response.body);
            this.flowId = $('#TrackingFlowidBearer').attr('data-flow-id');
            stockObj = JSONParseSafely(($('#z-vegas-pdp-props').html() as string).split('<![CDATA[')[1].split(']]>')[0]);
        } catch (ex) {
            throw new RetryExecutor(this.getStock.bind(this), `Failed to parse product page`);
        }
        if (stockObj?.model?.articleInfo?.coming_soon) this.setTimer(stockObj?.model?.articleInfo?.release_date);
    }

    private async getCartproducts() {
        let response: any;
        if (!this.preloading) this.updateStatus('Cleaning Cart', TaskStatusColor.Neutral);
        try {
            response = await request({
                url: `https://${this.host}/api/cart/details`,
                method: 'GET',
                headers: {
                    host: this.host,
                    'user-agent': this.ua,
                    'content-type': 'application/json',
                    accept: '*/*',
                    origin: `https://${this.host}`,
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    'x-xsrf-token': this.xsrf,
                    referer: this.url,
                },
                proxy: this.proxy?.getUrl(),
                jar: this.cookieJar,
            });
        } catch (e) {
            throw new RetryExecutor(this.getCartproducts.bind(this), `Unknown Error`);
        }

        switch (response.statusCode) {
            case 403:
                if (this.isRetry('getCartproducts')) {
                    this.updateStatus('Blocked by akamai, solving', TaskStatusColor.Warning);
                    await this.handleAkamai();
                    throw new RetryExecutor(this.getCartproducts.bind(this), 'Solved akamai, retrying');
                } else throw new StopTask('Perma banned by akamai, stopping');
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.getCartproducts.bind(this), 'Ratelimited, Retrying');
            case 200:
            case 201:
                const cartObj = JSONParseSafely(response.body);
                cartObj?.groups?.forEach((group) => {
                    group?.articles?.forEach((product) => {
                        this.cartContent.push(product?.simpleSku);
                    });
                });
                break;
            default:
                if (this.isRetry('getCartproducts')) throw new RetryExecutor(this.getCartproducts.bind(this), 'Unable to get cart details, Retrying');
                else throw new StopTask(`Failed to get cart details (${response.statusCode}), stopping`);
        }
    }

    private async removeProduct() {
        let response: any;
        if (!this.preloading) this.updateStatus('Removing product from cart', TaskStatusColor.Neutral);
        try {
            response = await request({
                url: `https://${this.host}/api/cart/change-cart-item-quantity`,
                method: 'POST',
                headers: {
                    host: this.host,
                    'user-agent': this.ua,
                    'content-type': 'application/json',
                    accept: '*/*',
                    origin: `https://${this.host}`,
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    'x-xsrf-token': this.xsrf,
                    referer: this.url,
                },
                proxy: this.proxy?.getUrl(),
                body: JSON.stringify({
                    simpleSku: this.skuRemoval,
                    quantity: 0,
                }),
                jar: this.cookieJar,
            });
        } catch (e) {
            throw new RetryExecutor(this.removeProduct.bind(this), `Unknown Error`);
        }

        if (response.statusCode === 200) {
            if (!this.preloading) this.updateStatus(`Removed ${this.skuRemoval}`, TaskStatusColor.Neutral);
        } else {
            if (this.isRetry('removeProduct'))
                throw new RetryExecutor(this.removeProduct.bind(this), `Unable to remove ${this.skuRemoval} (${response.statusCode}), Retrying`);
            else throw new StopTask('Failed to remove dummy');
        }
    }

    private async atc(isDummy: boolean = false) {
        let response: any;
        if (!isDummy) this.updateStatus('Adding to cart', TaskStatusColor.Neutral);
        try {
            response = await request({
                url: `https://${this.host}/api/graphql/add-to-cart/`,
                method: 'POST',
                headers: {
                    host: this.host,
                    'user-agent': this.ua,
                    'content-type': 'application/json',
                    accept: '*/*',
                    origin: `https://${this.host}`,
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    referer: this.url,
                },
                proxy: this.proxy?.getUrl(),
                body: JSON.stringify([
                    {
                        id: 'e7f9dfd05f6b992d05ec8d79803ce6a6bcfb0a10972d4d9731c6b94f6ec75033',
                        variables: {
                            addToCartInput: {
                                productId: isDummy ? 'JA282F01F-Q110ONE000' : this.task.product?.size?.code,
                                clientMutationId: 'addToCartMutation',
                            },
                        },
                    },
                ]),
                jar: this.cookieJar,
            });
        } catch (e) {
            throw new RetryExecutor(this.atc.bind(this), `Unknown Error`);
        }

        switch (response.statusCode) {
            case 403:
                if (this.isRetry('atc')) {
                    this.updateStatus('Blocked by akamai, solving', TaskStatusColor.Warning);
                    await this.handleAkamai();
                    throw new RetryExecutor(this.atc.bind(this), 'Solved akamai, retrying');
                } else throw new StopTask('Perma banned by akamai, stopping');
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.atc.bind(this), 'Ratelimited, Retrying');
            case 200:
            case 201:
                const atcObj = JSONParseSafely(response.body);
                if (atcObj?.[0]?.data?.addToCart === null) {
                    if (this.isRetry('atc')) {
                        this.rotateSize();
                        throw new RetryExecutor(this.atc.bind(this), 'Failed to cart (Generic), Retrying');
                    } else throw new StopTask('Failed to cart (Generic), stopping');
                }
                if (response.body.includes('429')) {
                    if (this.isRetry('atc')) throw new RetryExecutor(this.atc.bind(this), 'Failed to cart (Ratelimit), Retrying');
                    else throw new StopTask('Failed to cart (Ratelimited), stopping');
                }
                if (!isDummy)
                    this.setStatus(
                        `Added ${isDummy ? 'dummy item' : this.task.product.name} in size ${
                            isDummy ? 'O/S' : this.task.product?.size?.name
                        } to cart !`,
                        TaskStatusColor.Cart,
                        isDummy ? undefined : TaskEvent.Carted
                    );
                break;
            default:
                if (this.isRetry('atc')) throw new RetryExecutor(this.atc.bind(this), 'Unable to add to cart, Retrying');
                else throw new StopTask(`Failed to cart (${response.statusCode}), stopping`);
        }
    }

    private async getAddresses() {
        let response: any;
        try {
            response = await request({
                url: `https://${this.host}/checkout/address`,
                method: 'GET',
                headers: {
                    'user-agent': this.ua,
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                    'sec-fetch-site': 'none',
                    'sec-fetch-mode': 'navigate',
                    'sec-fetch-dest': 'document',
                    'cache-control': 'max-age=0',
                    'accept-language': 'en-US,en;q=0.9',
                    'accept-encoding': 'gzip, deflate, br',
                },
                proxy: this.proxy?.getUrl(),
                jar: this.cookieJar,
            });
        } catch (e) {
            throw new RetryExecutor(this.getAddresses.bind(this), `Unknown Error`);
        }

        switch (response.statusCode) {
            case 403:
                if (this.isRetry('getAddresses')) {
                    this.updateStatus('Blocked by akamai, solving', TaskStatusColor.Warning);
                    await this.handleAkamai();
                    throw new RetryExecutor(this.getAddresses.bind(this), 'Solved akamai, retrying');
                } else throw new StopTask('Perma banned by akamai, stopping');
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.getAddresses.bind(this), 'Ratelimited, Retrying');
            case 200:
                try {
                    const $ = cheerio.load(response.body);
                    const addyObj = JSONParseSafely($('div[data-props]').attr('data-props') as string);
                    this.addressId = addyObj?.model?.addressDetails?.defaultShippingAddress?.id;
                } catch (ex) {
                    if (this.isRetry('getAddresses')) throw new StopTask('Failed to parse addresses, Stopping');
                    else throw new RetryExecutor(this.getAddresses.bind(this), 'Failed to parse addresses, Retrying');
                }
                break;
            default:
                if (this.isRetry('getAddresses')) throw new StopTask('Failed getting shipping address');
                else throw new RetryExecutor(this.getAddresses.bind(this), `Unable to get shipping address (${response.statusCode}), Retrying`);
        }
    }

    private async addAddress() {
        let response: any;
        try {
            response = await request({
                url: `https://${this.host}/api/user-account-address/addresses`,
                method: 'POST',
                body: JSON.stringify({
                    type: 'HomeAddress',
                    city: this.profile.shippingAddress.city,
                    countryCode: this.profile.shippingAddress.country,
                    firstname: this.profile.shippingAddress.firstName,
                    lastname: this.profile.shippingAddress.lastName,
                    street: this.profile.shippingAddress.address,
                    additional: '',
                    gender: 'MALE',
                    defaultBilling: true,
                    defaultShipping: true,
                    zip: this.profile.shippingAddress.zip,
                }),
                headers: {
                    'user-agent': this.ua,
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                    'sec-fetch-site': 'none',
                    'sec-fetch-mode': 'navigate',
                    'sec-fetch-dest': 'document',
                    'cache-control': 'max-age=0',
                    'accept-language': 'en-US,en;q=0.9',
                    'accept-encoding': 'gzip, deflate, br',
                },
                proxy: this.proxy?.getUrl(),
                jar: this.cookieJar,
            });
        } catch (e) {
            throw new RetryExecutor(this.addAddress.bind(this), `Unknown Error`);
        }

        if (response.statusCode !== 200) {
            if (this.isRetry('addAddress')) throw new RetryExecutor(this.addAddress.bind(this), 'Unable to add address, Retrying');
            else throw new StopTask('Failed to add address');
        } else {
            this.addressId = JSONParseSafely(response.body)?.[0]?.id;
        }
    }

    private async setAddress() {
        let response: any;
        try {
            response = await request({
                url: `https://${this.host}/api/checkout/address/${this.addressId}/default`,
                method: 'POST',
                body: JSON.stringify({ isDefaultShipping: true }),
                headers: {
                    'user-agent': this.ua,
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                    'sec-fetch-site': 'none',
                    'sec-fetch-mode': 'navigate',
                    'sec-fetch-dest': 'document',
                    'cache-control': 'max-age=0',
                    'accept-language': 'en-US,en;q=0.9',
                    'accept-encoding': 'gzip, deflate, br',
                    'x-xsrf-token': this.xsrf,
                },
                proxy: this.proxy?.getUrl(),
                jar: this.cookieJar,
            });
        } catch (e) {
            throw new RetryExecutor(this.setAddress.bind(this), `Unknown Error`);
        }

        switch (response.statusCode) {
            case 403:
                if (this.isRetry('setAddress')) {
                    this.updateStatus('Blocked by akamai, solving', TaskStatusColor.Warning);
                    await this.handleAkamai();
                    throw new RetryExecutor(this.setAddress.bind(this), 'Solved akamai, retrying');
                } else throw new StopTask('Perma banned by akamai, stopping');
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.setAddress.bind(this), 'Ratelimited, Retrying');
            case 200:
                if (!this.preloading) this.updateStatus('Submitted shipping', TaskStatusColor.Neutral);
                break;
            default:
                if (this.isRetry('setAddress'))
                    throw new RetryExecutor(this.setAddress.bind(this), `Unable to submit shipping (${response.statusCode}), Retrying`);
                else throw new StopTask('Failed to submit shipping');
        }
    }

    private async getNextStep() {
        let response: any;
        try {
            response = await request({
                url: `https://${this.host}/api/checkout/next-step`,
                method: 'GET',
                headers: {
                    accept: 'application/json',
                    'accept-encoding': 'gzip, deflate, br',
                    'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
                    'cache-control': 'no-cache',
                    'content-type': 'application/json',
                    origin: `https://${this.host}`,
                    pragma: 'no-cache',
                    referer: `https://${this.host}/checkout/address`,
                    'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin',
                    'user-agent': this.ua,
                    'x-xsrf-token': this.xsrf,
                    'x-zalando-checkout-app': 'web',
                    'x-zalando-footer-mode': 'desktop',
                    'x-zalando-header-mode': 'desktop',
                },
                proxy: this.proxy?.getUrl(),
                jar: this.cookieJar,
            });
        } catch (e) {
            throw new RetryExecutor(this.getNextStep.bind(this), `Unknown Error`);
        }

        switch (response.statusCode) {
            case 403:
                if (this.isRetry('getNextStep')) {
                    this.updateStatus('Blocked by akamai, solving', TaskStatusColor.Warning);
                    await this.handleAkamai();
                    throw new RetryExecutor(this.getNextStep.bind(this), 'Solved akamai, retrying');
                } else throw new StopTask('Perma banned by akamai, stopping');
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.getNextStep.bind(this), 'Ratelimited, Retrying');
            case 200:
                this.sessionId = JSON.parse(response.body as string).url.split('/')[4];
                break;
            default:
                if (this.isRetry('getNextStep'))
                    throw new RetryExecutor(this.getNextStep.bind(this), `Unable to get checkout session (${response.statusCode}), Retrying`);
                else throw new StopTask('Failed to get checkout session');
        }
    }

    private async getPaymentMethods() {
        let response: any;
        this.cookieJar.setCookie(`Session-ID=${this.sessionId}`, 'https://checkout.payment.zalando.com/');
        try {
            response = await this.httpClient.get(
                `https://checkout.payment.zalando.com/payment-method-selection-session/${this.sessionId}/selection?show=true`,
                {
                    headers: {
                        'user-agent': this.ua,
                        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                        'sec-fetch-site': 'none',
                        'sec-fetch-mode': 'navigate',
                        'sec-fetch-dest': 'document',
                        'cache-control': 'max-age=0',
                        'accept-language': 'en-US,en;q=0.9',
                        'accept-encoding': 'gzip, deflate, br',
                    },
                    agent: { https: this.proxy?.getHttpsProxyAgent() },
                    followRedirect: false,
                    throwHttpErrors: false,
                    cookieJar: this.cookieJar,
                }
            );
        } catch (e) {
            throw new RetryExecutor(this.getPaymentMethods.bind(this), `Unknown Error`);
        }

        switch (response.statusCode) {
            case 403:
                if (this.isRetry('getPaymentMethods')) {
                    this.updateStatus('Blocked by akamai, solving', TaskStatusColor.Warning);
                    await this.handleAkamai();
                    throw new RetryExecutor(this.getPaymentMethods.bind(this), 'Solved akamai, retrying');
                } else throw new StopTask('Perma banned by akamai, stopping');
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.getPaymentMethods.bind(this), 'Ratelimited, Retrying');
            case 200:
            case 307:
                if (!this.preloading) this.updateStatus('Got payment methods');
                break;
            default:
                if (this.isRetry('getPaymentMethods'))
                    throw new RetryExecutor(this.getPaymentMethods.bind(this), `Unable to get payment method (${response.statusCode}), Retrying`);
                else throw new StopTask('Failed to get payment methods');
        }
    }

    private async submitPaymentMethod() {
        let response: any;
        try {
            response = await this.httpClient.post(
                `https://checkout.payment.zalando.com/payment-method-selection-session/${this.sessionId}/selection?show=true`,
                {
                    form: {
                        payz_maestro_former_payment_method_id: '-1',
                        payz_credit_card_former_payment_method_id: '-1',
                        payz_selected_payment_method: 'PAYPAL',
                        iframe_funding_source_id: '',
                    },
                    headers: {
                        'content-type': 'application/x-www-form-urlencoded',
                        referer: 'https://checkout.payment.zalando.com/selection',
                        'user-agent': this.ua,
                        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                        'sec-fetch-site': 'none',
                        'sec-fetch-mode': 'navigate',
                        'sec-fetch-dest': 'document',
                        'cache-control': 'max-age=0',
                        'accept-language': 'en-US,en;q=0.9',
                        'accept-encoding': 'gzip, deflate, br',
                    },
                    agent: { https: this.proxy?.getHttpsProxyAgent() },
                    throwHttpErrors: false,
                    followRedirect: false,
                    cookieJar: this.cookieJar,
                }
            );
        } catch (e) {
            throw new RetryExecutor(this.submitPaymentMethod.bind(this), `Unknown Error`);
        }

        switch (response.statusCode) {
            case 403:
                if (this.isRetry('submitPaymentMethod')) {
                    this.updateStatus('Blocked by akamai, solving', TaskStatusColor.Warning);
                    await this.handleAkamai();
                    throw new RetryExecutor(this.submitPaymentMethod.bind(this), 'Solved akamai, retrying');
                } else throw new StopTask('Perma banned by akamai, stopping');
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.submitPaymentMethod.bind(this), 'Ratelimited, Retrying');
            case 307:
                if (!this.preloading) this.updateStatus('Submitted payment (1/2)');
                break;
            default:
                if (this.isRetry('submitPaymentMethod'))
                    throw new RetryExecutor(
                        this.submitPaymentMethod.bind(this),
                        `Unable to submit payment method [1/2] (${response.statusCode}), Retrying`
                    );
                else throw new StopTask('Failed to submit payment method [1/2]');
        }
    }

    private async comfirmPaymentMethod() {
        let response: any;
        try {
            response = await this.httpClient.post(`https://checkout.payment.zalando.com/selection`, {
                form: {
                    payz_maestro_former_payment_method_id: '-1',
                    payz_credit_card_former_payment_method_id: '-1',
                    payz_selected_payment_method: 'PAYPAL',
                    iframe_funding_source_id: '',
                },
                headers: {
                    'content-type': 'application/x-www-form-urlencoded',
                    referer: 'https://checkout.payment.zalando.com/selection',
                    'user-agent': this.ua,
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                    'sec-fetch-site': 'none',
                    'sec-fetch-mode': 'navigate',
                    'sec-fetch-dest': 'document',
                    'cache-control': 'max-age=0',
                    'accept-language': 'en-US,en;q=0.9',
                    'accept-encoding': 'gzip, deflate, br',
                },
                agent: { https: this.proxy?.getHttpsProxyAgent() },
                followRedirect: false,
                cookieJar: this.cookieJar,
            });
        } catch (e) {
            throw new RetryExecutor(this.comfirmPaymentMethod.bind(this), `Unknown Error`);
        }

        switch (response.statusCode) {
            case 403:
                if (this.isRetry('comfirmPaymentMethod')) {
                    this.updateStatus('Blocked by akamai, solving', TaskStatusColor.Warning);
                    await this.handleAkamai();
                    throw new RetryExecutor(this.comfirmPaymentMethod.bind(this), 'Solved akamai, retrying');
                } else throw new StopTask('Perma banned by akamai, stopping');
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.comfirmPaymentMethod.bind(this), 'Ratelimited, Retrying');
            case 303:
                if (!this.preloading) this.updateStatus('Submitted payment (2/2)');
                break;
            default:
                if (this.isRetry('comfirmPaymentMethod'))
                    throw new RetryExecutor(
                        this.comfirmPaymentMethod.bind(this),
                        `Unable to submit payment method [2/2] (${response.statusCode}), Retrying`
                    );
                else throw new StopTask('Failed to submit payment method [2/2]');
        }
    }

    private async getCheckout() {
        let response: any;
        this.updateStatus('Getting checkout tokens');
        try {
            response = await request({
                url: `https://${this.host}/checkout/confirm`,
                method: 'GET',
                headers: {
                    'user-agent': this.ua,
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                    'sec-fetch-site': 'none',
                    'sec-fetch-mode': 'navigate',
                    'sec-fetch-dest': 'document',
                    'cache-control': 'max-age=0',
                    'accept-language': 'en-US,en;q=0.9',
                    'accept-encoding': 'gzip, deflate, br',
                },
                proxy: this.proxy?.getUrl(),
                jar: this.cookieJar,
            });
        } catch (e) {
            throw new RetryExecutor(this.getCheckout.bind(this), `Unknown Error`);
        }
        switch (response.statusCode) {
            case 403:
                if (this.isRetry('getCheckout')) {
                    this.updateStatus('Blocked by akamai, solving', TaskStatusColor.Warning);
                    await this.handleAkamai();
                    throw new RetryExecutor(this.getCheckout.bind(this), 'Solved akamai, retrying');
                } else throw new StopTask('Perma banned by akamai, stopping');
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.getCheckout.bind(this), 'Ratelimited, Rotating proxy and retrying');
            case 200:
                const $ = cheerio.load(response.body);

                //In case the user is running precart, it gets the infos of the item being checked out, since we cart every size.

                const article = $('.z-coast-fjord_article');
                const sizeDisplay = $($(article).find('.z-text.z-text-block.z-text-body.z-text-black')?.[1])?.text()?.split(': ')[1];
                this.task.product = new Product({
                    ...this.task.product,
                    name: $($(article).find('.z-text.z-text-body.z-text-black')?.[1])?.text(),
                    size: new Size(sizeDisplay, sizeDisplay, '-'),
                    price: $(article).find('.z-coast-fjord_priceWrapper')?.text(),
                    image: $(article).find('.z-2-product-image_image')?.attr('src'),
                });
                const checkoutObj = JSONParseSafely($('div[data-props]').attr('data-props'));
                this.eTag = (checkoutObj?.model?.eTag).split('"')[1];
                this.checkoutId = checkoutObj?.model?.checkoutId;

                if (this.eTag && this.checkoutId) break;
            case 302:
                const location = response.headers?.location;
                switch (location) {
                    case '/cart':
                        throw new RetryExecutor(this.getCheckout.bind(this), `${this.task.product.name} OOS at checkout, Retrying`);
                    case '/welcomenoaccount/true':
                        this.setStatus('Login session expired', TaskStatusColor.Warning);
                        await this.executeLogin();
                        throw new RetryExecutor(this.getCheckout.bind(this), `Refreshed sessoin, Retrying`);
                    default:
                        if (this.isRetry('getCheckout'))
                            throw new RetryExecutor(
                                this.getCheckout.bind(this),
                                `Unable to get checkout tokens (${response.statusCode}) - ${location}, Retrying`
                            );
                        else throw new StopTask('Failed to get checkout tokens');
                }
            default:
                if (this.isRetry('getCheckout'))
                    throw new RetryExecutor(this.getCheckout.bind(this), `Unable to get checkout tokens (${response.statusCode}), Retrying`);
                else throw new StopTask('Failed to get checkout tokens');
        }
    }

    private async placeOrder() {
        let response: any;
        this.task.checkoutProxy = this.proxy?.getUrl();
        if (Date.now() - this.abckTs > 300000) await this.handleAkamai();

        this.task.orderId = this.checkoutId;
        this.updateStatus('Placing order');
        const body = JSON.stringify({
            checkoutId: this.checkoutId,
            eTag: this.eTag,
        });
        try {
            response = await request({
                url: `https://${this.host}/api/checkout/buy-now`,
                method: 'POST',
                body,
                headers: {
                    accept: 'application/json',
                    'accept-encoding': 'gzip, deflate, br',
                    'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
                    'cache-control': 'no-cache',
                    'content-length': body.length,
                    'content-type': 'application/json',
                    origin: `https://${this.host}`,
                    pragma: 'no-cache',
                    referer: `https://${this.host}/checkout/confirm`,
                    'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin',
                    'user-agent': this.ua,
                    'x-xsrf-token': this.xsrf,
                    'x-zalando-checkout-app': 'web',
                    'x-zalando-footer-mode': 'desktop',
                    'x-zalando-header-mode': 'desktop',
                },
                'HEADER-ORDER': [
                    'content-length',
                    'sec-ch-ua',
                    'x-xsrf-token',
                    'x-zalando-checkout-app',
                    'x-zalando-footer-mode',
                    'x-zalando-header-mode',
                    'content-type',
                    'x-zalando-request-uri',
                    'accept',
                    'x-zalando-toggle-label',
                    'sec-ch-ua-mobile',
                    'user-agent',
                    'origin',
                    'sec-fetch-site',
                    'sec-fetch-mode',
                    'sec-fetch-dest',
                    'referer',
                    'accept-encoding',
                    'accept-language',
                ],
                proxy: this.proxy?.getUrl(),
                jar: this.cookieJar,
            });
        } catch (e) {
            throw new RetryExecutor(this.placeOrder.bind(this), `Unknown Error`);
        }

        switch (response.statusCode) {
            case 403:
                if (this.isRetry('placeOrder')) {
                    this.updateStatus('Blocked by akamai, solving', TaskStatusColor.Warning);
                    await this.handleAkamai();
                    throw new RetryExecutor(this.placeOrder.bind(this), 'Solved akamai, retrying');
                } else throw new StopTask('Perma banned by akamai, stopping');
            case 429:
                this.rotateProxy();
                throw new RetryExecutor(this.placeOrder.bind(this), 'Ratelimited, Rotating proxy and retrying');
            case 200:
                const orderObj = JSON.parse(response.body);
                switch (orderObj.url) {
                    case '/checkout/success':
                        return this.setStatus('Successful checkout ! (COD)', TaskStatusColor.Success, TaskEvent.CheckoutSuccess);
                    case '/cart?error=zalando.checkout.confirmation.quantity.error':
                    case '/checkout/confirm?error=zalando.checkout.confirmation.quantity.error':
                        this.setStatus('OOS at checkout', TaskStatusColor.Error, TaskEvent.CheckoutDecline);
                        throw new RetryExecutor(this.placeOrder.bind(this), `Unable to place order (${response.statusCode}), Retrying`);
                    default:
                        if (
                            orderObj.url.startsWith('https://bankieren.ideal.ing.nl/') ||
                            orderObj.url.startsWith('https://www.paypal.com/checkoutnow?')
                        ) {
                            this.task.checkoutUrl = orderObj.url;
                            this.setStatus('Please complete your payment, sent webhook.', TaskStatusColor.Success, TaskEvent.CheckoutSuccess);
                        }
                        return;
                }
            default:
                if (this.isRetry('placeOrder'))
                    throw new RetryExecutor(this.placeOrder.bind(this), `Unable to place order (${response.statusCode}), Retrying`);
                else throw new StopTask('Failed to place order');
        }
    }
}
