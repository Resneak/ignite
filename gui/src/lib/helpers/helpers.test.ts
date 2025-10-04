import { capitalizeFirstLetter, insertCharacterRandomly, lowercaseFirstLetter, snakeToCamelCase } from './strings';

describe('test strings', () => {
    test('can convert snake case to camel case', () => {
        const snake = 'hello-world-foo-bar';
        const camel = 'helloWorldFooBar';
        expect(snakeToCamelCase(snake)).toBe(camel);
    });

    test('can convert first letter to upper case', () => {
        expect(capitalizeFirstLetter('abc')).toBe('Abc');
    });

    test('can convert first letter to lower case', () => {
        expect(lowercaseFirstLetter('ABC')).toBe('aBC');
    });

    test('can insert character at random places', () => {
        const str = 'hello';
        const result = insertCharacterRandomly(str, 1, '*');
        expect(result).toContain('*');
    });
});
