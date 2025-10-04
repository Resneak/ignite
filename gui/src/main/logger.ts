import * as electron from 'electron';
import { join } from 'path';
import { isRenderer } from '../lib/helpers';
import Storage from './storage';

// normally, import { app } from 'electron'; wouldn't work because render and main process are separated (mainly because of security reasons)
// however, you can still access the app instance  using the 'remote' module
// for more info see: https://github.com/electron/electron/blob/master/docs/api/remote.md
const app = isRenderer ? electron.remote.app : electron.app;

type LogType = 'debug' | 'warn' | 'error' | 'info';

/**
 * environment specific logger
 *
 * use this instead of console.log(), .error(), etc.
 */
export default class Logger {
    /**
     * default log file to use
     */
    private static readonly file = join(app.getPath('logs'), 'log.txt');

    /**
     * the application-specific storage directory to use
     */

    private static handle(executor: { production: () => void; development: () => void }) {
        if (process.env.NODE_ENV === 'production') executor.production();
        else executor.development();
    }

    private static formatMessage(message: any, type: LogType = 'info') {
        return `${new Date()} ${(type ?? '').toUpperCase()}: ${message}\n`;
    }

    static debug(message: any) {
        this.handle({
            development: () => console.debug(message),
            production: () => Storage.appendToFile(this.file, this.formatMessage(message, 'debug')),
        });
    }

    static warn(message: any) {
        this.handle({
            development: () => console.warn(message),
            production: () => Storage.appendToFile(this.file, this.formatMessage(message, 'warn')),
        });
    }

    static error(message: any) {
        this.handle({
            development: () => console.error(message),
            production: () => Storage.appendToFile(this.file, this.formatMessage(message, 'error')),
        });
    }

    static info(message: any) {
        this.handle({
            development: () => console.log(message),
            production: () => Storage.appendToFile(this.file, this.formatMessage(message, 'info')),
        });
    }

    /**
     * alias of Logger.info()
     */
    static log(message: any) {
        return this.info(message);
    }
}
