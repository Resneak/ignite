import AutoResetPromise from './autoResetPromise';
import IStatePromise from './IStatePromise';
import StatePromise from './statePromise';
import IPromiseCollection from './IPromiseCollection';

export enum PromiseType {
    StatePromise = 'statePromise',

    AutoResetPromise = 'autoResetPromise',
}

export interface PromiseCollectionProps {
    type: PromiseType;
}

export default class StatePromiseCollection<T> implements IPromiseCollection<T> {
    protected promises: { [id: string]: IStatePromise<T> };

    private promiseType: PromiseType;

    /**
     *
     * @param type of promise to store in this collection
     */
    constructor(props: PromiseCollectionProps) {
        this.promises = {};
        this.promiseType = props.type;
    }

    /**
     *
     * @param id of the promise to create
     * @returns the promise for that id if it exists and undefined otherwise
     */
    getPromise(id: string) {
        if (!this.promises[id]) {
            this.createPromise(id);
        }
        return this.promises[id];
    }

    /**
     *
     * @param id of the promise to resolve
     * @param item to resolve the promise with
     */
    resolve(id: string, item: T) {
        this.promises[id]?.resolve(item);
    }

    /**
     *
     * @param id of the promise to reject
     * @param reason for rejecting the promise
     */
    reject(id: string, reason: Error) {
        this.promises[id]?.reject(reason);
    }

    /**
     * creates a promise of the type that this collection holds
     *
     * @param id of the promise to create
     */
    protected createPromise(id: string) {
        let promise;
        switch (this.promiseType) {
            case PromiseType.StatePromise:
                promise = new StatePromise();
                break;
            case PromiseType.AutoResetPromise:
                promise = new AutoResetPromise();
                break;
            default:
                throw new Error('Not yet implemented');
        }
        this.promises[id] = promise;
    }
}
