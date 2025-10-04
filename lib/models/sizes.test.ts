import Sizes from './sizes';

test('can be random', () => {
    const sizes = new Sizes('random', 'footlocker');

    expect(sizes.isRandom()).toBe(true);
});

test('', () => {
    const size = new Sizes('');
    expect(size.toString()).toBe('4.0 US');
});
