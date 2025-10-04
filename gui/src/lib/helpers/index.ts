export function sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}

export const isProdEnv = process.env.NODE_ENV === 'production';
export const isDevEnv = !isProdEnv;
export const isRenderer = process && process.type === 'renderer';

export function random(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

export function randomItem(arr: any[]) {
    return arr[random(0, arr.length - 1)];
}
