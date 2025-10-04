import { Socket } from 'socket.io-client';
import Product from '../../../lib/models/product';
import Env from '../env';
import StockPromise, { StockEvent } from './stockPromise';

export default abstract class MonitorClient {
    socket: Socket;

    site: string;

    private supportedProductIndicator: {
        [key: string]: { promise: Promise<boolean>; resolve: (isSupported: boolean) => void; state: 'pending' | 'fulfilled' };
    };

    /**
     * map of product ids to stock promises
     */
    private stock: { [id: string]: StockPromise } = {};

    /**
     * map of product ids to products that are being monitored
     */
    private products: { [id: string]: Product };

    constructor(socket: Socket, site: string) {
        this.socket = socket;
        this.site = site;
        this.products = {};
        this.supportedProductIndicator = {};
        this.registerSocketIOHandlers();
    }

    /**
     *
     * @param stockEvent used to obtain the product id (should be the same as product.getID for the site)
     */
    abstract getProductIDFromStockEvent(stockEvent: StockEvent): string;

    /**
     *
     * @param products to request the server to monitor
     */
    public addProducts(products: Product[]) {
        //TODO queue these and send them together
        const productArray = [...new Set(Array.isArray(products) ? products : [products])];
        let newProducts: Product[] = [];

        for (const product of productArray) {
            if (!this.isProductAdded(product)) {
                newProducts.push(product);
            }
        }
        this.addNewProducts(newProducts);
    }

    /**
     *
     * @param product to wait to be in-stock for
     * @returns a promise for that product
     */
    public async getStock(product: Product): Promise<{ supported: boolean; stockEvent?: StockEvent }> {
        const id = product.getID();

        if (!this.isProductAdded(product)) {
            this.addProducts([product]);
        }

        const isSupported = await this.supportedProductIndicator[id].promise;
        if (isSupported) {
            const stockEvent = await this.getStockPromise(id)?.getProduct();
            Env.isDev && console.log(`Promise Resolved`);
            Env.isDev && console.dir(stockEvent);
            if (!stockEvent) {
                return { supported: false };
            }
            return { supported: true, stockEvent };
        }
        return { supported: false };
    }

    private isProductAdded(product: Product) {
        const id = product.getID();
        return !!this.products[id];
    }

    private addNewProducts(newProducts: Product[]) {
        for (const product of newProducts) {
            const id = product.getID();
            this.products[id] = product;

            let supportedProductResolve;

            const supportedProductPromise = new Promise<boolean>((resolve) => {
                supportedProductResolve = resolve;
            });
            this.supportedProductIndicator[id] = { promise: supportedProductPromise, resolve: supportedProductResolve, state: 'pending' };
        }

        this.requestMonitor(newProducts).then((response: any) => {
            let supportedProductIDs: string[] = response || [];

            for (const supportedProductID of supportedProductIDs) {
                this.resolveSupportedProductIndicator(supportedProductID, true);
            }
            for (const product of newProducts) {
                const productID = product.getID();
                if (this.supportedProductIndicator[productID]?.state !== 'fulfilled') {
                    this.resolveSupportedProductIndicator(productID, false);
                }
            }
        });
    }

    private resolveSupportedProductIndicator(id: string, isSupported: boolean) {
        this.supportedProductIndicator[id].resolve(isSupported);
        this.supportedProductIndicator[id].state = 'fulfilled';
    }

    /**
     *
     * @param products to request the server to monitor
     */
    private requestMonitor(products: Product[]) {
        return new Promise((resolve) => {
            this.socket.emit('client-request-monitor', products, (supportedProducts) => {
                if (Env.isDev) {
                    // console.log(`Received supported products`);
                    // console.table(supportedProducts);
                }
                resolve(supportedProducts);
            });
        });
    }

    private getStockPromise(id) {
        if (!this.stock[id]) {
            this.stock[id] = new StockPromise(new Product({ id }));
        }
        return this.stock[id];
    }

    /**
     * create listeners for stock events
     */
    private registerSocketIOHandlers() {
        this.socket.on('server-send-stock-event', (stockEvent: StockEvent) => {
            const id: string = this.getProductIDFromStockEvent(stockEvent);

            // Env.isDev && console.log(`${this.site} received stock ${stockEvent}  ID ${id} In Stock ${stockEvent.inStock}`);
            // Env.isDev && console.dir(stockEvent);

            this.getStockPromise(id)?.onStockEvent(stockEvent);
        });

        this.socket.on('connect', () => {
            /**
             * handles requesting products from the monitor if the connection gets reset
             */
            const products = Object.values(this.products);
            if (products.length > 0) {
                this.requestMonitor(products); // TODO how do we handle supported products here?
            }
        });
    }
}
