import ProxyGroup from './proxyGroup';

/**
 * a map of proxy ids to proxy groups
 */
export default class ProxyGroupCollection {
    private proxyGroups: Map<string, ProxyGroup>;

    private static instance: ProxyGroupCollection;
    public static getInstance() {
        if (this.instance === undefined) this.instance = new this();
        return this.instance;
    }

    constructor() {
        this.proxyGroups = new Map();
    }

    public getProxyGroup(proxyGroupId: string): ProxyGroup {
        if (!this.proxyGroups.has(proxyGroupId)) {
            this.proxyGroups.set(proxyGroupId, new ProxyGroup());
        }
        return this.proxyGroups.get(proxyGroupId)!;
    }

    public getSize() {
        let total = 0;
        for (const [, group] of this.proxyGroups) {
            total += group.getSize();
        }
        return total;
    }
}
