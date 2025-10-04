export default class Queue<T> {
    private items: T[] = [];

    add(item: T) {
        this.items.push(item);
    }

    remove(): T | undefined {
        return this.items.shift();
    }

    size(): number {
        return this.items.length;
    }

    filter(fn: (currentValue: T, index: number, arr: T[]) => boolean) {
        this.items = this.items.filter(fn);
    }
}
