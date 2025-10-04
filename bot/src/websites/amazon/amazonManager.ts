import { io, Socket } from 'socket.io-client';
import Product from '../../../../lib/models/product';
import Env from '../../env';
import MonitorClient from '../../models/monitorClient';
import { StockEvent } from '../../models/stockPromise';
import { AmazonSocket, server } from '../../services/backend';

export class AmazonStockEvent implements StockEvent {
    asin: string;
    offerID: string;
    inStock: boolean;

    constructor(stockEvent: Pick<AmazonStockEvent, 'asin' | 'offerID' | 'inStock'>) {
        this.offerID = stockEvent.offerID;
        this.asin = stockEvent.asin;
        this.inStock = stockEvent.inStock || false;
    }

    static getID(stockEvent: AmazonStockEvent) {
        return stockEvent.asin;
    }
}

class AmazonMonitorClient extends MonitorClient {
    getProductIDFromStockEvent(stockEvent: AmazonStockEvent): string {
        return AmazonStockEvent.getID(stockEvent);
    }
}

export default class AmazonManager {
    private socket: Socket;

    private monitor: AmazonMonitorClient;

    private static instance: AmazonManager;
    public static getInstance() {
        if (!this.instance) {
            this.instance = new AmazonManager();
        }
        return this.instance;
    }

    /**
     *
     * @param product to begin monitoring
     */
    public monitorProduct(product: Product) {
        this.monitor.addProducts([product]);
    }

    public awaitMonitor(product: Product) {
        return this.monitor.getStock(product) as Promise<{ supported: boolean; stockEvent?: AmazonStockEvent }>;
    }

    private constructor() {
        this.socket = io(`${server()}${AmazonSocket.namespace}`, {
            auth: {
                name: Env?.user?.name,
                token: Env?.user?.key,
            },
        });
        this.monitor = new AmazonMonitorClient(this.socket, 'amazon');
    }
}
