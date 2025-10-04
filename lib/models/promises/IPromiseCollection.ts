import IStatePromise from './IStatePromise';

export default interface PromiseCollection<T> {
    getPromise: (id: string) => IStatePromise<T>;

    resolve: (id: string, item: T) => void;

    reject: (id: string, reason: Error) => void;
}
