import { uuid } from '../../cli/src/utils/general';

export class ProfileShipping {
    firstName: string;

    lastName: string;

    phone: string;

    email: string;

    address: string;

    secondaryAddress: string;

    city: string;

    stateCode: string;

    state: string;

    zip: string;

    country: string;

    constructor({ firstName, lastName, email, phone, address, secondaryAddress, city, stateCode, state, zip, country }: ProfileShipping) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.email = email;
        this.phone = phone;
        this.address = address;
        this.secondaryAddress = secondaryAddress;
        this.city = city;
        this.stateCode = stateCode;
        this.state = state;
        this.zip = zip;
        this.country = country;
    }
}

export class ProfileBilling extends ProfileShipping {}

export class ProfilePayment {
    /** card number */
    number: string;

    /** CVV code */
    code: string;

    /** expiry month */
    month: number;

    /** expiry year */
    year: number;

    constructor({ number, code, month, year }: ProfilePayment) {
        this.number = number;
        this.code = code;
        this.month = month;
        this.year = year;
    }
}

export default class Profile {
    id: string;

    profileName: string;

    name: string;

    createdAt?: Date;

    singleCheckout: boolean;

    sameAddress?: boolean;

    shippingAddress: ProfileShipping;

    billingAddress?: ProfileBilling;

    payment: ProfilePayment;

    constructor(
        props: Pick<
            Profile,
            'id' | 'profileName' | 'name' | 'createdAt' | 'singleCheckout' | 'sameAddress' | 'shippingAddress' | 'billingAddress' | 'payment'
        >
    ) {
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

    validate() {
        let errors: string[] = [];
        if (!this.profileName) errors.push('No Profile Name');
        if (!this.name) errors.push('No Profile Name');
        if (!this.shippingAddress.address) errors.push('No Primary address');
        if (!this.shippingAddress.firstName) errors.push('No First Name');
        if (!this.shippingAddress.lastName) errors.push('No Last Name');
        if (!this.shippingAddress.email.includes('@')) errors.push(`Invalid email ${this.shippingAddress.email}`);
        if (Number.isNaN(parseInt(this.shippingAddress.phone))) errors.push(`Invalid phone number ${this.shippingAddress.phone}`);
        if (!this.shippingAddress.zip) errors.push(`Invalid zip ${this.shippingAddress.zip}`);

        if (Number.isNaN(parseInt(this.payment.code, 10)) || parseInt(this.payment.code, 10) > 9999) errors.push(`Invalid CVV ${this.payment.code}`);
        const now = new Date();
        if (Number.isNaN(this.payment.month) || this.payment.month > 12) errors.push(`Invalid Expiration Month ${this.payment.month}`);
        if (Number.isNaN(this.payment.year)) errors.push(`Invalid Expiration Year ${this.payment.year}`);

        if (errors.length > 0) throw new Error(errors.join('. '));
    }
}
