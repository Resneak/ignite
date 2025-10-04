import { io, Socket } from 'socket.io-client';
import Product from '../../../../lib/models/product';
import { TaskStatusColor } from '../../../../lib/models/taskUpdate';
import Env from '../../env';
import MonitorClient from '../../models/monitorClient';
import { StockEvent } from '../../models/stockPromise';
import { server, WalmartSocket } from '../../services/backend';
import { ProductOffer } from './api/fetchProductInfo';

export class WalmartStockEvent implements StockEvent {
    sku: string;
    site: string;
    inStock: boolean;
    timestamp?: number;
    offerID?: string;
    productName?: string;
    price?: number;
    image?: string;

    constructor(stockEvent: Pick<WalmartStockEvent, 'sku' | 'site' | 'inStock' | 'timestamp' | 'offerID' | 'productName' | 'image' | 'price'>) {
        this.sku = stockEvent.sku;
        this.site = stockEvent.site;
        this.inStock = stockEvent.inStock || false;
        this.timestamp = stockEvent.timestamp;
        this.offerID = stockEvent.offerID;
        this.productName = stockEvent.offerID;
        this.price = stockEvent.price;
        this.image = stockEvent.image;
    }

    static getID(stockEvent: WalmartStockEvent) {
        return stockEvent.sku;
    }
}

class WalmartMonitorClient extends MonitorClient {
    getProductIDFromStockEvent(stockEvent: WalmartStockEvent): string {
        return WalmartStockEvent.getID(stockEvent);
    }
}

export default class WalmartManager {
    private socket: Socket;

    private monitor: WalmartMonitorClient;

    private offers: { [id: string]: ProductOffer };

    private static instance: WalmartManager;
    public static getInstance() {
        if (!this.instance) {
            this.instance = new WalmartManager();
        }
        return this.instance;
    }

    /**
     * stores intervals that ping messages for a group of tasks
     */
    private pingIntervals: { [id: string]: { interval: NodeJS.Timeout; groupSize: number } } = {};

    /**
     *
     * @param productID of the interval to stop
     */
    private clearPings(productID: string) {
        this.pingIntervals[productID].groupSize = 0;
        clearInterval(this.pingIntervals[productID].interval);
        delete this.pingIntervals[productID];
    }

    /**
     *
     * @param pingID of the interval stored in pingIntervals
     * @param updateStatus: function called to update the status of tasks
     * @param msg to be displayed, or function that returns the message
     * @param interval to display the message
     */
    private pingMessage(
        pingID: string,
        updateStatus: (status: string, color?: TaskStatusColor) => void,
        msg: string | (() => string),
        interval: number
    ) {
        const getMessage = () => {
            if (typeof msg === 'function') {
                return msg();
            }
            return msg;
        };

        const pingInterval = this.pingIntervals[pingID] as any;

        if (!pingInterval || pingInterval?._destroyed) {
            const timeoutInterval = setInterval(() => {
                updateStatus(getMessage(), TaskStatusColor.Ping);
            }, interval);
            this.pingIntervals[pingID] = { interval: timeoutInterval, groupSize: 1 };
        } else {
            this.pingIntervals[pingID].groupSize += 1;
        }
    }

    /**
     *
     * @param product to begin monitoring
     */
    public monitorProduct(product: Product) {
        this.monitor.addProducts([product]);
    }

    /**
     *
     * @param id of the group that is pinging the message, we only ping once for the whole group in each interval
     * @param type of ping, or who/what started the ping
     * @returns the id and type concatenated together
     */
    public getPingID(id: string, type: 'monitor') {
        return `${id}-${type}`;
    }

    /**
     *
     * @param product to wait for to be in stock
     * @returns a WalmartStockEvent once the product is in stock
     */
    public awaitMonitor(product: Product, updateStatus: (status: string, color?: TaskStatusColor) => void) {
        const start = Date.now();

        // message send in monitor pings
        const message = () => {
            const diff = Math.floor((Date.now() - start) / 1000);
            const seconds = diff % 60;
            const minutes = Math.floor(diff / 60) % 60;
            const hours = Math.floor(diff / 3600);
            const runningFor = `${hours > 0 ? String(hours) + 'hr ' : ''}${minutes > 0 ? String(minutes) + 'min ' : ''}${seconds}s`;
            const groupSize = this.pingIntervals[this.getPingID(product.id, 'monitor')].groupSize;
            return `${groupSize} Tasks waiting for stock. Product ${product.id}. Waited for ${runningFor}`;
        };

        this.pingMessage(this.getPingID(product.id, 'monitor'), updateStatus, message, 10_000);

        return new Promise<{
            supported: boolean;
            stockEvent?: StockEvent;
        }>((resolve) => {
            this.monitor.getStock(product).then((result) => {
                // clear the pings when the promise is resolved
                this.clearPings(this.getPingID(product.id, 'monitor'));

                let res = result as { supported: boolean; stockEvent?: WalmartStockEvent };
                resolve(res);
            });
        });
    }

    /**
     *
     * @param productID of the offer to get
     * @returns the offer if it exists
     */
    public getProductOffer(productID: string) {
        return this.offers[productID];
    }

    /**
     *
     * @param productID
     * @param offer
     */
    public setProductOffer(productID: string, offer: ProductOffer) {
        this.offers[productID] = offer;
    }

    private constructor() {
        this.socket = io(`${server()}${WalmartSocket.namespace}`, {
            auth: {
                name: Env?.user?.name,
                token: Env?.user?.key,
            },
        });
        this.monitor = new WalmartMonitorClient(this.socket, 'walmart');
        this.offers = {};
    }
}
