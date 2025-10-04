export default interface Cluster<T> {
    deliver: T;

    fetch?: T;
}
