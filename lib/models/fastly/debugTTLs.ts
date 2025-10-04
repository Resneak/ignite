import DebugTTLCacheNode from './debugTTLCacheNode';

export default class DebugTTLs {
    edge: DebugTTLCacheNode;

    shield?: DebugTTLCacheNode;
    /**
     * @param debugTTLHeader (H cache-sjc10056-SJC 124.768 0.000 55) (H cache-sjc10054-SJC 124.768 0.000 55)
     */
    constructor(debugTTLHeader: string) {
        const nodes = debugTTLHeader
            .split(') (')
            .map((debugTTL) => new DebugTTLCacheNode(debugTTL));

        this.edge = nodes[0];
        this.shield = nodes[1];
    }
}
