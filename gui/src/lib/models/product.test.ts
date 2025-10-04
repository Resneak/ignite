import Product from './product';
import Variant from '../../../../lib/models/variant';
import SearchQuery from '../../../../lib/models/searchQuery';
import Size from '../../../../lib/models/size';

test('is sku', () => {
    const product = new Product('Nike Air Max', new Variant(new Size('9.0', 'US 9.0'), 'red', 'leather'));
    expect(product.isSku).toBe(true);
});

test('is URL', () => {
    const product = new Product('https://sleeyax.com', new Variant(new Size('random')));
    expect(product.isUrl).toBe(true);
});

test('is search query', () => {
    const product = new Product('+foo, -bar', new Variant(new Size('4.0')));
    expect(product.isSearchQuery).toBe(true);
});

test('can parse search query', () => {
    const product = new Product('+foo  , bar, -baz', new Variant(new Size('4.0')));
    expect(product.parseSearchQuery()).toEqual({
        included: ['foo', 'bar'],
        excluded: ['baz'],
    } as SearchQuery);
});
