import StatePromise from './statePromise';

/**
 * extends StatePromise so you have access to the state of the promise
 *
 * resets it's promise each time the promise is resolved/rejected
 * therefore, the state is always pending but resolves/rejects
 * for those waiting before the promise was resolved/rejected
 */
export default class AutoResetPromise<T> extends StatePromise<T> {
    constructor() {
        super();
    }

    public resolve(item: T) {
        this._resolve(item);
        this.reset();
    }

    public reject(reason: Error) {
        this._reject(reason);
        this.reset();
    }
}
