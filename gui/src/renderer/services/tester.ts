import * as tunnel from 'tunnel';
import got, { Agents } from 'got';
import { Agent } from 'https';

import Proxy from '../../lib/models/proxy';

interface ProxyTest {
    success: boolean;
    speed?: number;
    country?: string;
    status?: string;
}

interface ProxyTestWebsite {
    name: string;
    url: string;
    ban?: number;
}

export const testWebsites = ['Footlocker', 'Eastbay', 'Champs', 'Footaction', 'KidsFootlocker', 'Walmart'];

const proxyTestWebsites: ProxyTestWebsite[] = [
    {
        name: 'Footlocker',
        url: 'https://www.footlocker.com/',
        ban: 403,
    },
    {
        name: 'Eastbay',
        url: 'https://www.eastbay.com/',
        ban: 403,
    },
    {
        name: 'Champs',
        url: 'https://www.champssports.com/',
        ban: 403,
    },
    {
        name: 'Footaction',
        url: 'https://www.footaction.com/',
        ban: 403,
    },
    {
        name: 'KidsFootlocker',
        url: 'https://www.kidsfootlocker.com/',
        ban: 403,
    },
    {
        name: 'Walmart',
        url: 'https://www.walmart.com/',
    },
];

function customProxyAgent(proxy: Proxy): Agents {
    return {
        http: tunnel.httpOverHttp({
            proxy: {
                host: proxy.ip,
                port: parseInt(proxy.port, 10),
                proxyAuth: `${proxy.username}:${proxy.password}`,
            },
        }),
        https: tunnel.httpsOverHttp({
            proxy: {
                host: proxy.ip,
                port: parseInt(proxy.port, 10),
                proxyAuth: `${proxy.username}:${proxy.password}`,
            },
        }) as Agent,
        http2: tunnel.httpOverHttp({
            proxy: {
                host: proxy.ip,
                port: parseInt(proxy.port, 10),
                proxyAuth: `${proxy.username}:${proxy.password}`,
            },
        }),
    };
}

export async function testProxy(site: string, proxyObject: Proxy): Promise<ProxyTest> {
    try {
        const website: any = proxyTestWebsites.find((o) => o.name === site);
        const { url } = website;

        console.log(proxyObject);

        const res = await got(url, {
            agent: customProxyAgent(proxyObject),
            timeout: 4000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.106 Safari/537.36',
            },
        });

        if (res.timings.start && res.timings.end) {
            const { body }: any = await got(`https://ipapi.co/${proxyObject.ip}/json/`, {
                timeout: 4000,
                responseType: 'json',
            });

            return {
                success: true,
                speed: res.timings.end - res.timings.start,
                country: body.country_name || 'Undefined',
                status: res.statusCode === website.ban ? 'Banned' : 'Good',
            };
        }

        return {
            success: false,
        };
    } catch (e) {
        console.log(e);
        return {
            success: false,
        };
    }
}
