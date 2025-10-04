import { ErrorCode } from './errorCodes';

type ReExecutor = () => Promise<void>;

export default class BotTaskError extends Error {
    __proto__: Error;
    code: ErrorCode;

    message: string;

    logMessage?: string;

    /**
     * callback to call after the error has been thrown
     *
     * you can use this property to re-execute the method that threw the error if needed
     */
    retryExecutor?: ReExecutor;

    constructor(code: ErrorCode, message?: string, reExecutor?: ReExecutor, logMessage?: string) {
        const trueProto = new.target.prototype; // https://github.com/microsoft/TypeScript/issues/13965
        super(message || '');
        this.__proto__ = trueProto;
        this.code = code;
        this.message = message || '';
        this.retryExecutor = reExecutor;
        this.logMessage = logMessage;
    }
}
