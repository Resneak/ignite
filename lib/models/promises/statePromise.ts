import IStatePromise, { PromiseState } from './IStatePromise';

/**
 * A class that manages tracking the state of it's promise
 */
export default class StatePromise<T> implements IStatePromise<T> {
    _promisesMade: number = 0;

    protected _state!: PromiseState;

    protected _promise!: Promise<T>;

    protected _resolve!: (item: T) => void;

    protected _reject!: (reason: Error) => void;

    constructor() {
        this.reset();
    }

    /**
     *
     * @returns the actual promise
     */
    public get promise() {
        this._promisesMade += 1;
        return this._promise;
    }

    public get promisesMade() {
        return this._promisesMade;
    }

    /**
     *@returns the state of the promise
     */
    public get state() {
        return this._state;
    }

    /**
     *
     * @param item to resolve the promise with
     */
    public resolve(item: T) {
        this._resolve(item);
        this._state = 'fulfilled';
    }

    /**
     *
     * @param reason that the promise is being rejected
     */
    public reject(reason: Error) {
        this._reject(reason);
        this._state = 'rejected';
    }

    /**
     * initialized the promise
     */
    protected reset() {
        this._promisesMade = 0;
        this._state = 'pending';
        this._promise = new Promise<T>((res, rej) => {
            this._resolve = res;
            this._reject = rej;
        });
    }
}
