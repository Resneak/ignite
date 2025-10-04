import { random } from '.';
import { newlineRegex } from '../../renderer/helpers/constants';

/**
 * inserts specified character into the target string, at random places
 * @param text target string
 * @param amount amount of times to insert a character
 * @param character the character to insert
 */
export function insertCharacterRandomly(text: string, amount: number, character = ' ') {
    const charIndexes = [...Array(amount).keys()].map(() => random(0, text.length - 1));

    let result = '';
    for (let i = 0; i < text.length; i += 1) {
        result += text[i];

        if (charIndexes.includes(i)) result += character;
    }

    return result;
}

export function lowercaseFirstLetter(str: string) {
    return str.charAt(0).toLowerCase() + str.slice(1);
}

export function capitalizeFirstLetter(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export function removeFirstCharacter(str: string, char?: string) {
    // eslint-disable-next-line no-nested-ternary
    return char != null ? (str.startsWith(char) ? str.substring(1) : str) : str.substring(1);
}

export function snakeToCamelCase(snakeCase: string) {
    return snakeCase.replace(/([-_]\w)/g, (s) => s[1].toUpperCase());
}

/**
 * method executes a provided function once for each line in the string
 * @param fn
 * @param str
 */
export const forEachLine = (str: string, fn: (value: string, index: number, array: string[]) => void) => {
    const lines = str.split(newlineRegex);
    lines.forEach(fn);
};
