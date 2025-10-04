export type PromiseState = 'pending' | 'fulfilled' | 'rejected';

export default interface StatePromise<T> {
    promise: Promise<T>;

    state: PromiseState;

    resolve: (item: T) => void;

    reject: (reason: Error) => void;

    readonly promisesMade: number;
}
