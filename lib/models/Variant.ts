import Size from './size';

export default class Variant {
    /**
     * product size
     */
    size: Size;

    color?: string;

    style?: string;

    constructor(size: Size, color?: string, style?: string) {
        this.size = size;
        this.color = color;
        this.style = style;
    }
}
