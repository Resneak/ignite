import { shuffleArray } from '../../cli/src/utils/general';
import Size from './size';
import { getWebsiteByName, SiteSpecificProperties } from '../../bot/src/websites';
import Website from './website';

export default class Sizes {
    /**
     * whether the user selected random sizing
     */
    public random = false;

    /**
     * size values entered by user or all site supported sizes if random
     */
    public userSelectedSizes: Set<string> = new Set();

    /**
     * site specific array of supported sizes
     */
    public siteSupportedSizes: string[];

    /**
     * available sizes that match a size entered by the user
     */
    public availableSizes: Size[];

    /**
     *
     * @param sizeRange the user inputted size range (e.g. "07.0-15.5")
     *
     * @param siteName the website being used for the botTask. Used to get the site specific sizes
     */
    constructor(sizeRange: 'random' | string, siteName: string) {
        const site: Website | undefined = getWebsiteByName(siteName);

        this.siteSupportedSizes = site?.getProperty(SiteSpecificProperties.Sizes) || [];

        this.addSizeRange(sizeRange);

        this.availableSizes = [];
    }

    /**
     * adds all sizes in the range to sizes
     *
     * @param sizeRange the user inputted size range (e.g. "07.0-15.5" or a single size "7.5" or "random")
     */
    public addSizeRange(sizeRange: string) {
        const lessThanOrEqual = (size1, size2) => {
            const index1 = this.siteSupportedSizes.findIndex((s) => s == size1);
            const index2 = this.siteSupportedSizes.findIndex((s) => s == size2);
            return index1 < index2;
        };

        let [min, max] = sizeRange.split('-');

        if (min.toLowerCase().match('random')) {
            this.random = true;
            return;
        }

        const isSingleSize = max === undefined;
        if (isSingleSize && !this.random) {
            max = min;
        }

        this.userSelectedSizes = new Set(
            this.siteSupportedSizes.filter((size: string) => {
                const isRandom = size === 'random';
                const belowMin = lessThanOrEqual(size, min);
                const aboveMax = lessThanOrEqual(max, size);
                const isValid = !isRandom && !belowMin && !aboveMax;
                return isValid;
            })
        );
    }

    /**
     * set the sizes currently available
     * removes sizes that weren't selected by the user
     * randomizes the order
     */
    public setAvailableSizes(sizes: Size[]) {
        if (this.random) {
            this.availableSizes = sizes;
        } else {
            this.availableSizes = sizes.filter((size) => this.userSelectedSizes.has(size.value));
        }
        shuffleArray(this.availableSizes);
    }

    /**
     *
     * @returns whether sizes is configured to be random
     */
    public isRandom() {
        return this.random;
    }

    /**
     * moves the first size to the end of the array
     */
    public rotateSizes() {
        if (this.availableSizes.length > 1) {
            // const [first, ...rest] = this.availableSizes;
            // this.availableSizes = [...rest,first]
            this.availableSizes.push(this.availableSizes.shift()!);
        }
    }

    /**
     *
     * @returns the number of user entered sizes
     */
    public length() {
        return this.availableSizes.length;
    }

    /**
     *  rotates and returns the next item in the array
     */
    public getNextSize(): Size | undefined {
        this.rotateSizes();
        return this.getSize();
    }

    public getSize(): Size | undefined {
        return this.availableSizes[0];
    }

    public toString() {
        return [...new Set(this.availableSizes.map((size) => size.value))].toString();
    }

    public removeCurrentSize() {
        this.availableSizes.shift();
    }
}
