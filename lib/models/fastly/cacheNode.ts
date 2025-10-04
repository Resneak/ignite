export default class CacheNode {
    private static serverIDRegex = /([a-z]*)(\d*)/;
    /**
     * POP that this node is in (i.e. bwi)
     */
    pop: string;

    /**
     * node id of the is node (i.e. for bwi1234 it would be the 1234)
     */
    nodeID: string;

    /**
     *
     * @param id serverIdentity (i.e. cache-jfk1034-JFK or jfk1034)
     */
    constructor(identity: string) {
        const parts = identity.split('-');
        const id = parts.length === 1 ? parts[0] : parts?.[1];
        const [, pop, nodeID] = id.match(CacheNode.serverIDRegex) || [];
        this.pop = pop;
        this.nodeID = nodeID;
    }

    get name() {
        return `${this.pop}${this.nodeID}`;
    }

    /**
     * cache-lcy1128-LCY
     */
    get serverIdentity() {
        return `cache-${this.pop}${this.nodeID}-${this.pop.toUpperCase()}`;
    }

    toString() {
        return this.serverIdentity;
    }
}
