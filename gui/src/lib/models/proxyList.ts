import Logger from '../../main/logger';
import { genGuuid } from '../../renderer/helpers';
import { forEachLine } from '../helpers/strings';
import Proxy from './proxy';

interface Props {
    id?: string;
    name: string;
    createdAt?: Date;
    proxies?: string | Proxy[];
}

export default class ProxyList {
    id: string;

    name: string;

    createdAt: Date;

    proxies: Proxy[];

    constructor({ name, proxies, id, createdAt }: Props) {
        if (typeof proxies === 'string') {
            this.proxies = this.parse(proxies);
        } else {
            this.proxies = proxies || [];
        }

        this.id = id || genGuuid();
        this.name = name;
        this.createdAt = createdAt || new Date();
    }

    /**
     *
     * @param str string representation of a proxy list (i.e. ip:port:username:password
     * where each proxy is separated by a newline character)
     * @returns a list of proxies
     */
    private parse(str: string): Proxy[] {
        const proxies: Proxy[] = [];
        forEachLine(str, (line) => {
            try {
                const proxy = new Proxy(line);
                proxies.push(proxy);
            } catch (err) {
                Logger.error(err);
            }
        });
        return proxies;
    }
}
