export default class Size {
    /** actual size double */
    value: string;

    /** human readable name of the size */
    name?: string;

    code?: string;

    constructor(value: string, name?: string, code?: string) {
        this.value = value;
        this.name = name || value;
        this.code = code;
    }

    isRandom() {
        return this.value === 'random';
    }

    toString() {
        return this.name || this.value;
    }
}
