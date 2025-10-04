import CacheNode from './cacheNode';

export default class DebugPathCacheNode extends CacheNode {
    serverRole: 'D' | 'F';

    /**
     * timestamp that this cache node received the request at, in ms
     */
    handledRequestAt: number;

    /**
     *
     * @param debugPath (D cache-lcy1128-LCY 1415969775) or D cache-lcy1128-LCY 1415969775
     */
    constructor(debugPath: string) {
        const [serverRole, id, timestampStr] = debugPath
            .replace('(', '')
            .replace(')', '')
            .split(' ');

        super(id);
        this.serverRole = serverRole as 'D' | 'F';
        this.handledRequestAt = parseInt(timestampStr, 10) * 1000;
    }

    /**
     *
     * @returns original format (no parens) (i.e. D cache-lcy1128-LCY 1415969775)
     */
    toString() {
        return `${this.serverRole} ${this.serverIdentity} ${this.handledRequestAt / 1000}`;
    }
}
