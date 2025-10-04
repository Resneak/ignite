export async function sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

export const JSONParseSafely = (str: any) => {
    let parsed;
    try {
        parsed = JSON.parse(str);
    } catch {}
    return parsed;
};

export function randomNumber(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

export function deleteUndefinedProperties(obj: Record<string, any>) {
    Object.keys(obj).forEach((key: string) => obj[key] === undefined && delete obj[key]);
}

export function randomEightCharacterString() {
    return Math.random().toString(36).slice(-8);
}
