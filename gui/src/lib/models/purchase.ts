import { CompletionType } from '../../../../lib/errors';
import Product from './Product';

export default class Purchase {
    /**
     * unique identifier
     */
    id: string;

    /**
     * product that was purchased
     */
    product: Product;

    /**
     * type of purchase completion
     *
     * this can be eiter `Checkout` or `Declined`
     */
    type: CompletionType;

    /**
     * date in milliseconds (epoch)
     */
    dateInMilliseconds: number;

    /**
     * target website
     */
    websiteName: string;

    constructor({ id, dateInMilliseconds, product, websiteName, type }: Purchase) {
        this.id = id;
        this.dateInMilliseconds = dateInMilliseconds;
        this.product = product;
        this.websiteName = websiteName;
        this.type = type;
    }
}
