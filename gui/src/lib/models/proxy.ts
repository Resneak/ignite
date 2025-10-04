import { genGuuid } from '../../renderer/helpers';
import { proxyRegex } from '../../renderer/helpers/constants';

interface Props {
    id?: string;
    ip: string;
    port: string;
    username?: string;
    password?: string;
}

export default class Proxy {
    id: string;

    ip: string;

    port: string;

    username?: string;

    password?: string;

    /**
     * note throws an error if the string is invalid
     * @param props an object or string to be parsed
     */
    constructor(props: Props | string) {
        const proxy = typeof props === 'string' ? Proxy.parse(props) : props;

        this.id = proxy.id || genGuuid();
        this.ip = proxy.ip;
        this.port = proxy.port;
        this.username = proxy.username;
        this.password = proxy.password;
    }

    /**
     *
     * @param str string reresnetation of a proxy (i.e. ip:port:username:password)
     * @returns a proxy object and throws an error if the proxy is invalid
     */
    static parse(str: string): Props {
        const ipAndPort = str.match(proxyRegex);
        const proxyParts = str.split(':');
        const validNumberOfProxyParts = proxyParts.length === 2 || proxyParts.length === 4;

        const [ip, port, username, password] = proxyParts;

        let noEmptyCredentials = true;
        if (proxyParts.length === 4) {
            noEmptyCredentials = !!username && !!password;
        }

        if (!ipAndPort || !validNumberOfProxyParts || !noEmptyCredentials)
            throw new Error(`Invalid Proxy: ${str}`);

        return { ip, port, username, password };
    }

    /**
     * @returns the human readable version of a proxy (i.e. ip:port:username:password)
     */
    toString() {
        const proxyParts = [this.ip, this.port];
        if (this.username && this.password) {
            proxyParts.push(this.username);
            proxyParts.push(this.password);
        }
        return proxyParts.join(':');
    }
}
