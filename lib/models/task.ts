import { Site } from '../../bot/src/websites';
import { uuid } from '../../cli/src/utils/general';
import Product from './product';
import Sizes from './sizes';

export interface TaskProps {
    /**
     * unique identifier
     */
    id?: string;

    createdAt?: Date;

    /**
     * profile to use
     */
    profileId: string;

    /**
     * proxy group
     */
    proxyGroupId: string;

    /**
     * name of target store
     */
    websiteName: Site;

    /**
     *  task mode
     */
    mode: string;

    /**
     * product
     */
    product: Product;

    /**
     * user selected sizes
     */
    sizes: Sizes;

    /**
     * checkout delay in milliseconds
     */
    checkoutDelay: number;

    atcQuantity: number;

    /**
     * optional captcha bypass method
     */
    captchaBypass?: string;

    /**
     * optional monitor delay in milliseconds
     */
    monitorDelay?: number;

    /**
     * optional retry delay in milliseconds
     */
    retryDelay?: number;

    /**
     * optional category
     */
    category?: string;

    /**
     * optional username/email to use when logging in to the site
     */
    username?: string;

    /**
     * optional password to use when logging in to the site
     */
    password?: string;

    /**
     * whether or not this task is selected
     */
    isActive?: boolean;
}

export default class Task {
    /**
     * unique identifier
     */
    id!: string;

    createdAt!: Date;

    /**
     * profile to use
     */
    profileId: string;

    /**
     * proxy group to use
     */
    proxyGroupId: string;

    /**
     * name of target store
     */
    websiteName: Site;

    /**
     *  task mode
     */
    mode: string;

    /**
     * product
     */
    product: Product;

    /**
     * user selected sizes
     */
    sizes: Sizes;

    /**
     * checkout delay in milliseconds
     */
    checkoutDelay: number;

    atcQuantity: number;

    checkoutProxy: string | undefined;

    /**
     * optional order id;
     */

    orderId?: string;

    /**
     * optional checkout url (paypal, sofort etc...)
     */
    checkoutUrl?: string;

    /**
     * optional captcha bypass method
     */
    captchaBypass?: string;

    /**
     * optional monitor delay in milliseconds
     */
    monitorDelay?: number;

    /**
     * optional retry delay in milliseconds
     */
    retryDelay?: number;

    /**
     * optional category
     */
    category?: string;

    /**
     * optional email to use when logging in to the site
     */
    username?: string;

    /**
     * optional password to use when logging in to the site
     */
    password?: string;

    /**
     * whether or not this task is selected
     */
    isActive? = false;

    constructor(props: TaskProps) {
        this.id = props.id || uuid();
        this.createdAt = props.createdAt || new Date();
        this.profileId = props.profileId;
        this.proxyGroupId = props.proxyGroupId;
        this.websiteName = props.websiteName;
        this.mode = props.mode;
        this.product = props.product;
        this.sizes = props.sizes;
        this.checkoutDelay = props.checkoutDelay;
        this.atcQuantity = props.atcQuantity;
        this.captchaBypass = props.captchaBypass;
        this.monitorDelay = props.monitorDelay;
        this.retryDelay = props.retryDelay;
        this.category = props.category;
        this.username = props.username;
        this.password = props.password;
    }

    validate() {
        let errors: string[] = [];
        if (!this.websiteName) errors.push(`Missing store ${this.websiteName}`);
        if (!this.mode) errors.push(`Missing mode ${this.mode}`);
        if (!this.product) errors.push(`Missing product`);
        if (!this.profileId) errors.push(`Missing profile ID ${this.profileId}`);
        if (Number.isNaN(this.atcQuantity)) errors.push(`Invalid ATC quantity ${this.atcQuantity}`);
    }
}
