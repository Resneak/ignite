import Country from '../../../../lib/models/country';
import { countryCodeToName } from './countries';

test('can create country', () => {
    const country = new Country('CA', 'Canada', []);
    expect(country.code).toBe('CA');
    expect(country.name).toBe('Canada');
});

test('can convert country code to name', () => {
    const name = countryCodeToName('CA');
    expect(name).toBe('Canada');
});

test('can convert country name to code', () => {
    const name = countryCodeToName('CA');
    expect(name).toBe('Canada');
});
