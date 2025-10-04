import Product from '../../../lib/models/product';

export interface StockEvent {
    inStock: boolean;
}

export default class StockPromise {
    /**
     * product that the stock event promise is for
     */
    private product: Product;

    private promise!: Promise<StockEvent>;

    private resolve!: (stockEvent: StockEvent) => void;

    private state!: 'pending' | 'fulfilled';

    constructor(product: Product) {
        this.product = product;
        this.resetPromise();
    }

    /**
     *
     * @returns returns a promise for the product
     */
    getProduct() {
        return this.promise;
    }

    /**
     *
     * @param stockEvent used to resolve the promise or reset the promise when OOS
     */
    onStockEvent(stockEvent: StockEvent) {
        if (stockEvent.inStock) {
            this.resolvePromise(stockEvent);
        } else {
            let prevResolve = this.resolve;
            this.resetPromise();
            let currentResolve = this.resolve;
            this.resolve = (stockEvent: StockEvent) => {
                prevResolve(stockEvent);
                currentResolve(stockEvent);
            };
        }
    }

    private resolvePromise(stockEvent: StockEvent) {
        if (this.state === 'fulfilled') {
            return;
        }
        this.state = 'fulfilled';
        this.resolve(stockEvent);
    }

    private resetPromise() {
        this.state = 'pending';
        this.promise = new Promise((res) => {
            this.resolve = res;
        });
    }
}
