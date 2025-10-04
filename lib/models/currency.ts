export default class Currency {
    /**
     * short abbreviation
     *
     * e.g. USD
     */
    code: string;

    /**
     * full currency name
     */
    name: string;

    /**
     * optional symbol to show instead of the code
     */
    symbol?: string;

    constructor(code: string, name: string, symbol?: string) {
        this.code = code;
        this.name = name;
        this.symbol = symbol;
    }
}
