import Size from './size';

interface ProductComponent {
    getID(): string;
}

export class ProductDecorator implements ProductComponent {
    product: ProductComponent;

    constructor(product: ProductComponent) {
        this.product = product;
    }

    getID() {
        return this.product.getID();
    }
}

export class SiteDecorator extends ProductDecorator {
    site: string;

    constructor(product: ProductComponent, site: string) {
        super(product);
        this.site = site;
    }

    getID() {
        return `${this.site}-${this.product.getID()}`;
    }
}

export default class Product implements ProductComponent {
    /**
     * SKU, keywords or url
     */
    id: string;

    name?: string;

    /**
     * product image
     */
    image?: string;

    /**
     * product size
     */
    size?: Size;

    /**
     * product price
     */
    price?: string;

    maxPrice?: number;

    constructor(product: Pick<Product, 'id' | 'name' | 'image' | 'size' | 'price' | 'maxPrice'>) {
        this.id = product.id;
        this.name = product.name;
        this.image = product.image;
        this.size = product.size;
        this.price = product.price;
        this.maxPrice = product.maxPrice;
    }

    getID() {
        return this.id;
    }
}
