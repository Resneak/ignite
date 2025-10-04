import Cluster from './cluster';
import DebugPathCacheNode from './debugPathCacheNode';

export default class DebugPath {
    edge: Cluster<DebugPathCacheNode>;

    shield?: Cluster<DebugPathCacheNode>;
    /**
     *
     * @param debugPathHeader (D cache-lcy1128-LCY 1415969775) (F cache-lcy1130-LCY 1415969775) (D cache-sjc3132-SJC 1415969775) (F cache-sjc3128-SJC 1415969775)
     */
    constructor(debugPathHeader: string) {
        const cacheNodes = debugPathHeader.split(') (').map((item) => new DebugPathCacheNode(item));

        const deliverNodes = cacheNodes.filter((item) => item.serverRole === 'D');
        const fetcheNodes = cacheNodes.filter((item) => item.serverRole === 'F');

        this.edge = {
            deliver: deliverNodes[0],
            fetch: fetcheNodes[0],
        };

        if (deliverNodes[1]) {
            this.shield = {
                deliver: deliverNodes[1],
                fetch: fetcheNodes[1],
            };
        }
    }

    get isClusteringEnabled() {
        return !!this.edge.fetch;
    }

    get isShieldingEnabled() {
        return !!this.shield;
    }

    toString() {
        const paths = [this.edge.deliver, this.edge.fetch, this.shield?.deliver, this.shield?.fetch]
            .filter((node) => node !== undefined)
            .map((item) => item?.toString());
        return `(${paths.join(') (')})`;
    }
}
