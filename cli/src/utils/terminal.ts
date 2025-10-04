import chalk from 'chalk';
import { forEachLine } from './general';
import { fortyCharLogo } from './logos';
import clipboary from 'clipboardy';

export const chalkIgnite = chalk.hex('#BE2A50');
export const lightGrey = chalk.hex('#AFAFAF');

export const center = (text: string) => {
    const width = process.stdout.columns;
    // center the logo
    forEachLine(text, (line) => {
        const margin = width - line.length;
        const whiteSpace = ' '.repeat(Math.abs(margin) / 2); // repeat automatically takes the floor of this
        margin > 0 && console.log(chalkIgnite(`${whiteSpace}${line}`));
    });
};

export const clear = () => {
    process.stdout.cursorTo(0, 0);
    process.stdout.clearScreenDown();
};

export const renderLogo = () => {
    center(fortyCharLogo);
};

export const setTerminalTitle = (title: string) => {
    process.stdout.write(String.fromCharCode(27) + ']0;' + title + String.fromCharCode(7));
};

export const paste = () => {
    const clipped = clipboary.readSync();
    process.stdout.write(clipped);
};
