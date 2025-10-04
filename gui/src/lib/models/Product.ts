import SearchQuery from '../../../../lib/models/searchQuery';
import Variant from '../../../../lib/models/variant';
import { removeFirstCharacter } from '../helpers/strings';
import { defaultCurrency } from '../data/currencies';

export default class Product {
    /**
     * SKU, keywords or url
     */
    name: string;

    /**
     * product image
     */
    image?: string;

    /**
     * contains the parsed search query if keywords
     */
    keywords?: SearchQuery;

    /**
     * size and color
     */
    variant: Variant;

    /**
     * optional quantity of products
     */
    quantity = 1;

    /**
     * product total price
     */
    price = 0;

    priceCurrency = defaultCurrency;

    constructor(name: string, variant: Variant, quantity = 1) {
        this.name = name;
        this.variant = variant;
        this.quantity = quantity;
        if (this.isSearchQuery()) this.keywords = this.parseSearchQuery(name);
    }

    isUrl() {
        return this.name.startsWith('http://') || this.name.startsWith('https://');
    }

    isSku() {
        return !this.isUrl && !this.isSearchQuery;
    }

    isSearchQuery() {
        return this.name.indexOf('+') !== -1 || this.name.indexOf('-') !== -1 || this.name.indexOf(',') !== -1;
    }

    /**
     * converts a search query into filterable keywords
     *
     * example input: nike, +blue, -red
     * result: '{included: ['nike', 'blue'], excluded: ['red']}
     */
    parseSearchQuery(query?: string): SearchQuery {
        if (query === undefined) query = this.name;

        const keywords = query.split(/\s*,\s*/);

        return {
            included: keywords.filter((keyword) => !keyword.startsWith('-')).map((keyword) => removeFirstCharacter(keyword, '+')),
            excluded: keywords.filter((keyword) => keyword.startsWith('-')).map((keyword) => removeFirstCharacter(keyword, '-')),
        };
    }
}
