import Proxy from './proxy';
import SharedGroup from './sharedGroup';
/**
 * collection of proxies used by all tasks
 */
export default class ProxyGroup extends SharedGroup<Proxy> {
    /**
     *
     * @param proxy to add
     */
    add(proxy: string | Proxy) {
        this.items.add(new Proxy(proxy));
    }

    /**
     * initializes proxies to a new set containing the supplied proxies
     * @param proxies to add
     */
    setProxies(proxies: string[] | Proxy[]) {
        this.items = new Set();
        for (const proxyStr of proxies) {
            this.add(proxyStr);
        }
        this.iterator = this.items.values();
    }
}
