import Proxy from '../../../../lib/models/proxy';

export default interface ProxyWrapper {
    listID: string;
    listName: string;
    proxy: Proxy;
    country?: string;
    status?: string;
    speed?: number | string;
    active: boolean;
}
