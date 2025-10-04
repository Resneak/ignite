enum LicenseType {
    Staff,
    User,
    Renewal,
    Lifetime,
}

export default class LicenseKey {
    key: string;

    expirationDate: Date;

    type: LicenseType;

    constructor({ key, type, expirationDate }: Omit<LicenseKey, 'parseExpirationDate' | 'parseType' | 'getType'>) {
        this.key = key;
        this.expirationDate = expirationDate;
        this.type = type;
    }

    /**
     * Convert expiration date string (epoch milliseconds or 'never') to Date
     *
     * @param expStr
     */
    static parseExpirationDate(expStr: string | number) {
        if (!Number.isInteger(expStr) && (expStr as string).toLowerCase() === 'never') return new Date('9999-01-01');
        return new Date(+expStr);
    }

    /**
     * Convert license type string to LicenseType
     *
     * @param type
     */
    static parseType(type: string) {
        // TODO: maybe differentiate between user type (user or staff) and plan (lifetime, renewal)
        switch (type.toLowerCase()) {
            case 'staff':
                return LicenseType.Staff;
            case 'renewal':
                return LicenseType.Renewal;
            case 'lifetime':
                return LicenseType.Lifetime;
            case 'user':
                return LicenseType.User;
            default:
                throw new Error(`Unknown licensing type ${type}`);
        }
    }

    /**
     * Format license type into its string representation
     */
    static getType(type: LicenseType) {
        return LicenseType[type];
    }
}
