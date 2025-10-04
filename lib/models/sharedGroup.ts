/**
 * collection of items to be shared
 */
export default abstract class SharedGroup<T> {
    protected items: Set<T>;

    /**
     * tracks the next unused item in items
     */
    protected iterator?: IterableIterator<T>;

    constructor() {
        this.items = new Set();
    }

    /**
     * iterates the iterator, reset if necessary
     * @returns next item in items or undefined
     */
    protected next(): T | undefined {
        let next = this.iterator?.next();
        if (next?.done) {
            this.iterator = this.items.values();
            next = this.iterator.next();
        }
        return next?.value;
    }

    /**
     *
     * @param item to add
     */
    add(item: T) {
        this.items.add(item);
    }

    /**
     *
     * @param item to remove
     */
    remove(item: T) {
        this.items.delete(item);
    }

    /**
     *
     * @returns the next item in the collection
     */
    getItem() {
        return this.next();
    }

    getSize() {
        return this.items.size;
    }

    /**
     * initializes items to a new set containing the supplied items
     * @param items to add
     */
    setItems(items: T[]) {
        this.items = new Set();
        for (const item of items) {
            this.add(item);
        }
        this.iterator = this.items.values();
    }
}
