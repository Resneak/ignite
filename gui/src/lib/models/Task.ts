import Product from './product';

export default class Task {
    /**
     * unique identifier
     */
    id: string;

    createdAt: Date;

    /**
     * profile to use
     */
    profileId: string;

    /**
     * proxy list to use
     */
    proxyListId: string;

    /**
     * name of target store
     */
    websiteName: string;

    /**
     *  task mode
     */
    mode: string;

    /**
     * product name, SKU or any other input that's required for the task.
     * Includes size, color, styles
     */
    product: Product;

    /**
     * checkout delay in milliseconds
     */
    checkoutDelay: number;

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
    email?: string;

    /**
     * optional password to use when logging in to the site
     */
    password?: string;

    /**
     * whether or not this task is selected
     */
    isActive = false;

    constructor(props: Task) {
        this.id = props.id;
        this.createdAt = props.createdAt;
        this.profileId = props.profileId;
        this.proxyListId = props.proxyListId;
        this.websiteName = props.websiteName;
        this.mode = props.mode;
        this.product = props.product;
        this.checkoutDelay = props.checkoutDelay;
        this.captchaBypass = props.captchaBypass;
        this.monitorDelay = props.monitorDelay;
        this.category = props.category;
        this.email = props.email;
        this.password = props.password;
    }
}
