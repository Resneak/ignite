import CacheNode from './cacheNode';
import { considerDashTTLToBe } from './config';

export default class DebugTTLCacheNode extends CacheNode {
    /**
     * time in ms until the resource is live
     */
    ttl: number;

    /**
     * the amount of time in seconds for which the object will be served stale if no backends are available
     */
    staleIfError: string;

    /**
     * the number of seconds for which the object has been in cache
     */
    age: number;

    /**
     * hit or miss
     */
    private cacheStatus: 'H' | 'M';

    /**
     * original ttl from the debug ttl
     */
    private remainingTTL: string;

    /**
     *
     * @param debugTTL (H cache-sjc10056-SJC 124.768 0.000 55)
     */
    constructor(debugTTL: string) {
        const [cacheStatus, serverIdentity, remainingTTL, staleIfErrorTTL, age] = debugTTL
            .replace('(', '')
            .replace(')', '')
            .split(' ');
        super(serverIdentity);

        this.cacheStatus = cacheStatus as 'H' | 'M';
        this.remainingTTL = remainingTTL;
        this.ttl = (remainingTTL === '-' ? considerDashTTLToBe : parseFloat(remainingTTL)) * 1000;

        this.staleIfError = staleIfErrorTTL;
        this.age = parseInt(age, 10);
    }

    get didMiss() {
        return this.cacheStatus === 'M';
    }

    toString() {
        return `(${this.cacheStatus} ${this.serverIdentity} ${this.remainingTTL} ${this.staleIfError} ${this.age})`;
    }
}
