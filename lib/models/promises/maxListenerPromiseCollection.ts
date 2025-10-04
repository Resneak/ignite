import AutoResetPromise from './autoResetPromise';

import IStatePromise from './IStatePromise';
import { PromiseType } from './promiseCollection';
import StatePromise from './statePromise';

export interface MaxListenerPromiseCollectionProps {
    type: PromiseType;

    maxNumberOfPromisesPerPromise: number;
}

export default class MaxListenersPerStatePromiseCollection<T> {
    protected promises: { [id: string]: IStatePromise<T>[] };

    private promiseType: PromiseType;

    private maxNumberOfPromisesPerPromise: number;

    constructor(props: MaxListenerPromiseCollectionProps) {
        this.promises = {};
        this.promiseType = props.type;
        this.maxNumberOfPromisesPerPromise = props.maxNumberOfPromisesPerPromise;
    }

    /**
     *
     * @param id of the promise to get
     * @returns a StatePromise for an id shared with a max of maxNumberOfPromisesPerPromise others
     */
    getPromise(id: string) {
        if (!this.promises[id]) {
            this.promises[id] = [this.createPromise(id)];
        } else if (!this.promises[id][0]) {
            this.promises[id].unshift(this.createPromise(id));
        } else if (this.promises[id][0].promisesMade >= this.maxNumberOfPromisesPerPromise) {
            let maxedOutPromise = this.promises[id][0];
            maxedOutPromise.promise.catch().finally(() => {
                this.purgeCompletedPromises(id);
            });

            this.promises[id].unshift(this.createPromise(id));
        }

        return this.promises[id][0];
    }

    /**
     * removes promises from the end of the array until they are no longer pending
     *
     * note this may be an issue if promises can last forever as they cannot be purged
     *
     * @param id of the promise array to purge fulfilled/rejected promises from
     */
    private purgeCompletedPromises(id: string) {
        let promises = this.promises[id];
        while (promises.length > 0 && promises[promises.length - 1]?.state !== 'pending') {
            promises.splice(-1, 1);
        }
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
        return promise;
    }
}
