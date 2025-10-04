import Size from '../../../../lib/models/size';
import { findSize } from './sizes';

test('can create size', () => {
    const size = new Size('7', 'US 7');
    expect(size.name).toBe('US 7');
    expect(size.value).toBe('7');
    expect(size.isRandom).toBe(false);
});

test('can get size from (human readble) name', () => {
    const size = new Size('7', 'US 7');
    expect(findSize('US 7')).toEqual(size);
});
