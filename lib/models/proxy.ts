import { uuid } from '../../cli/src/utils/general';
const tunnel = require('../../bot/node_modules/tunnel');

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
     * @param props an object or string to be parsed
     */
    constructor(props: Props | string) {
        const proxy = typeof props === 'string' ? Proxy.parse(props) : props;

        this.id = proxy.id || uuid();
        this.ip = proxy.ip;
        this.port = proxy.port;
        this.username = proxy.username;
        this.password = proxy.password;
    }

    /**
     *
     * @param str string reresnetation of a proxy (i.e. ip:port:username:password)
     * @returns a proxy object
     */
    static parse(str: string): Props {
        const [ip, port, username, password] = str.split(':');

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

    /**
     *
     * @returns http://username:password@ip:port or http://ip:port representation
     */
    getUrl(https?: boolean) {
        let url = https ? 'https://' : 'http://';

        if (this.username && this.password) {
            url = `${url}${this.username}:${this.password}@`;
        }

        url = `${url}${this.ip}:${this.port}`;

        return url;
    }

    /**
     *
     * @returns username:password@ip:port representation
     */
    format() {
        let url = '';
        if (this.username && this.password) {
            url = `${url}${this.username}:${this.password}@`;
        }

        url = `${url}${this.ip}:${this.port}`;

        return url;
    }

    /**
     * @proxyOptions https://www.npmjs.com/package/tunnel
     * @returns a new https proxy agent to be added to the http client
     */
    getHttpsProxyAgent(tlsOptions?: any, proxyOptions?: any) {
        const proxyAuth = this.username && this.password ? { proxyAuth: `${this.username}:${this.password}` } : {};
        return tunnel.httpsOverHttp({
            proxy: {
                host: this.ip,
                port: this.port,
                ...proxyAuth,
                ...proxyOptions,
            },
            ...tlsOptions,
        });
    }

    getAgents(tlsOptions?: any, proxyOptions?: any) {
        const proxyAuth = this.username && this.password ? { proxyAuth: `${this.username}:${this.password}` } : {};
        // const httpAgent = tunnel.httpOverHttp({
        //     proxy: {
        //         host: this.ip,
        //         port: this.port,
        //         ...proxyAuth,
        //         ...proxyOptions,
        //     },
        //     ...tlsOptions,
        // });

        const httpsAgent = tunnel.httpsOverHttp({
            proxy: {
                host: this.ip,
                port: this.port,
                ...proxyAuth,
                ...proxyOptions,
            },
            ...tlsOptions,
        });

        // the wrapper library seems to cause timeouts and unhandled exceptions to be thrown
        // const http2Agent = new http2.proxies.Http2OverHttps({
        //     proxyOptions: {
        //         url: this.getUrl(),
        //         ...proxyOptions,
        //     },
        //     ...tlsOptions,
        // });

        return {
            // http: httpAgent,
            https: httpsAgent,
            // http2: http2Agent,
        };
    }
}
