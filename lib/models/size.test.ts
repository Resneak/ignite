import Size from './size';

test('can be random', () => {
    const size = new Size('random');
    expect(size.isRandom).toBe(true);
});

test('implements toString', () => {
    const size = new Size('4.0', '4.0 US');
    expect(size.toString()).toBe('4.0 US');
});
