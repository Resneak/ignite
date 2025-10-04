import { uuid } from '../../cli/src/utils/general';

export default class giftCard {
    id: string;

    cardNumber: string;

    cardPin: string;

    createdAt?: Date;

    singleCheckout: boolean;

    sameAddress?: boolean;




    constructor(props: giftCard) {
        this.id = props.id || uuid();
        this.profileName = props.profileName;
        this.name = props.name;
        this.createdAt = props.createdAt || new Date();
        this.sameAddress = true;
        this.singleCheckout = props.singleCheckout;
        this.shippingAddress = props.shippingAddress;
        this.billingAddress = props.shippingAddress;
        this.payment = props.payment;
    }
}
