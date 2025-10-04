/* eslint-disable no-console */
import Storage from './storage';
import chalk, { Color } from 'chalk';
import logSymbols from 'log-symbols';
import { AppData } from '../data/files';
import { chalkIgnite, lightGrey } from './terminal';
import readline from 'readline';
import { TaskStatusColor } from '../../../lib/models/taskUpdate';

export type LogType = 'debug' | 'warn' | 'error' | 'info' | 'cart' | 'success' | 'ping';

/**
 * environment specific logger
 *
 * use this instead of console.log(), .error(), etc.
 */
export default class Logger {
    private static handle(executor: { production: () => void; development: () => void }) {
        // if (process.env.NODE_ENV === 'development') executor.development();
        // else executor.production();
        executor.production();
    }

    public static getColor(logType: LogType) {
        switch (logType) {
            case 'warn':
                return chalk.yellow;
            case 'error':
                return chalk.red;
            case 'info':
                return chalk.white;
            case 'cart':
                return chalk.cyan;
            case 'success':
                return chalk.green;
            case 'ping':
                return chalk.gray;
            default:
                return chalk.white;
        }
    }

    static wrap(message: any) {
        return `[${message}]`;
    }

    static getTime() {
        const now = new Date();
        const hours = `${now.getHours()}`.padStart(2, '0');
        const minutes = `${now.getMinutes()}`.padStart(2, '0');
        const seconds = `${now.getSeconds()}`.padStart(2, '0');
        const time = `${hours}:${minutes}:${seconds}`;
        return this.wrap(time);
    }

    private static formatMessage(message: any, type: LogType = 'info') {
        return `${message} \n`;
    }

    public static parseDate(log: string): { month: number; day: number; hour: number; minute: number; seconds: number; ms: number } {
        const timestamp = log?.split(/\[/)?.[1]?.split(/\]/)?.[0];
        const [month, day, hour, minute, seconds, ms] = timestamp?.split(/\:/).map((str) => parseInt(str, 10));
        return { month, day, hour, minute, seconds, ms };
    }

    private static formatResponse(response: any) {
        const statusCode = response?.statusCode;
        const message = response?.body?.message;
        return response ? `\t Status Code: ${statusCode} \t Message: ${message}` : '';
    }

    static debug(message: any) {
        this.handle({
            development: () => console.dir(message, { depth: null, colors: true }),
            production: () => Storage.appendToFile(AppData.Logs, this.formatMessage(message, 'debug')),
        });
    }

    static warn(message: any, show = false, response?: any) {
        this.handle({
            development: () => {
                console.log(logSymbols.warning, chalk.yellow(message));
                const msg = `${message}${this.formatResponse(response)}`;
                Storage.appendToFile(AppData.Logs, this.formatMessage(msg, 'warn'));
            },
            production: () => {
                show && console.log(logSymbols.warning, chalk.yellow(message));
                const msg = `${message}${this.formatResponse(response)}`;
                Storage.appendToFile(AppData.Logs, this.formatMessage(msg, 'warn'));
            },
        });
    }

    static error(message: any, show = false, response?: any) {
        this.handle({
            development: () => {
                console.error(logSymbols.error, chalk.red(message));
                const msg = `${message}${this.formatResponse(response)}`;
                Storage.appendToFile(AppData.Logs, this.formatMessage(msg, 'error'));
            },
            production: () => {
                show && console.error(logSymbols.error, chalk.red(message));
                const msg = `${message}${this.formatResponse(response)}`;
                Storage.appendToFile(AppData.Logs, this.formatMessage(msg, 'error'));
            },
        });
    }

    static info(message: any, show = false) {
        this.handle({
            development: () => console.log(logSymbols.info, chalk.blue(message)),
            production: () => {
                show && console.log(logSymbols.info, chalk.blue(message));
                Storage.appendToFile(AppData.Logs, this.formatMessage(message, 'info'));
            },
        });
    }

    static cart(message: any, show = false) {
        this.handle({
            development: () => console.log(logSymbols.info, chalk.cyan(message)),
            production: () => {
                show && console.log(logSymbols.info, chalk.cyan(message));
                Storage.appendToFile(AppData.Logs, this.formatMessage(message, 'cart'));
            },
        });
    }

    static success(message: any, show = false) {
        this.handle({
            development: () => console.log(logSymbols.success, chalk.green(message)),
            production: () => {
                show && console.log(logSymbols.success, chalk.green(message));
                Storage.appendToFile(AppData.Logs, this.formatMessage(message, 'success'));
            },
        });
    }

    /**
     * prints message in the specified color or white
     */
    static log(message: any, show = false, errorMsg?: string, color?: typeof Color | 'ignite' | 'dim') {
        let colorize;

        switch (color) {
            case 'ignite':
                colorize = chalkIgnite;
                break;
            case 'dim':
                colorize = lightGrey;
                break;
            default:
                colorize = color ? chalk[color] : chalk.white;
                break;
        }

        this.handle({
            development: () => console.log(logSymbols.info, colorize(message)),
            production: () => {
                show && console.log(logSymbols.info, colorize(message));
                Storage.appendToFile(AppData.Logs, this.formatMessage(message, 'info'));
            },
        });
    }
}
