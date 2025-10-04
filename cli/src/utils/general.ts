import { v4 } from 'uuid';
import { accountsHeader, profilesHeader, proxyHeader, tasksHeader } from '../data/files';

// created from cryptographically-strong random values
export const uuid = () => v4();

/**
 *
 * @subsetSize number of events resulting in true
 * @populationSize number of possible outcomes
 * @returns whether the random even occured
 */
export const pollRandomEvent = (subsetSize: number, populationSize: number) => {
    return Math.random() * populationSize <= subsetSize;
};

export const newlineRegex = /\r?\n/;

/**
 * method executes a provided function once for each line in the string
 * @param fn
 * @param str
 */
export const forEachLine = (str: string, fn: (value: string, index: number, array: string[]) => void) => {
    const lines = str.split(newlineRegex);
    lines.forEach(fn);
};

const isEnv = (name: string) => process.env.NODE_ENV === name;

export const isDev = () => isEnv('development');

export const isProd = () => isEnv('production');

export const isProdDev = () => isProd() && /bundled$/.test(`${__dirname}`);

export const capitalizeFirstLetter = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 *
 * @param str to test
 * @returns true if the string begins with '\\' (not including white space)
 */
export const isComment = (str: string) => {
    str = str.trim();

    return /^\/\//.test(str) || profilesHeader.test(str) || proxyHeader.test(str) || tasksHeader.test(str) || accountsHeader.test(str);
};

export const shuffleArray = (array: any[]) => {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
};

export const filterDuplicates = (array: any[]) => {
    return [...new Set(array)];
};
