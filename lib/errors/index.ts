/* eslint-disable max-classes-per-file */
import { ErrorCode, StopTaskType } from './errorCodes';
import BotTaskError from './taskError';

/**
 * stops an entire task
 */
export class StopTask extends BotTaskError {
    constructor(msg = 'Stopped', errorMsg?: string, type?: StopTaskType) {
        if (type === StopTaskType.SingleCheckout) {
            super(ErrorCode.SingleCheckout, 'Stopping... Reason: Single Checkout', undefined, undefined);
            return;
        } else {
            super(ErrorCode.Stop, msg, undefined, errorMsg);
        }
    }
}

export enum CompletionType {
    None,
    PaymentSuccess,
    PaymentDeclined,
}

export class CompleteTask extends BotTaskError {
    public type: CompletionType;

    constructor(type: CompletionType, msg = '', errorMsg?: string) {
        super(ErrorCode.Completed, msg, undefined, errorMsg);
        this.type = type;
    }
}

/**
 * retries a particular task method
 */
export class RetryExecutor extends BotTaskError {
    constructor(cb: () => Promise<void>, msg?: string, logMessage?: string) {
        super(ErrorCode.Retry, msg, cb, logMessage);
    }
}

/**
 * waits for monitor time and restarts the task method
 */
export class WaitForMonitorExecutor extends BotTaskError {
    constructor(msg: string, cb: () => Promise<void>, errorMsg?: string) {
        super(ErrorCode.Monitor, msg, cb, errorMsg);
    }
}
