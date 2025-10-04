import { Got } from 'got/dist/source/types';
import { v4 as uuid } from 'uuid';

const API_KEY = 'm38t5V0ZmfTsRpKIiQlszub1Tx4FbnGG';
const API_ID = '921B2b33cAfba5WWcb0bc32d5ix89c6b0f614';

interface addToCartDetails {
    strategy: string | 'ShieldBypass';
    host: string;
    url: string;
    userAgent: string;
    productId: string;
    sizeCode: string;
    qty: number;
    csrfToken: string;
    sessionId: string;
    deviceId?: string;
    cacheNodeRequestOptions?: {
        headers: object;
        options: object;
    };
    apiKey?: string;
    apiIdentifier?: string;
}

const addToCart = (httpClient: Got, details: addToCartDetails) => {
    let url = `${details.url}/apigate/users/carts/current/entries`,
        requestOptions;
    if (details.strategy === 'ShieldBypass') {
        requestOptions = {
            headers: {
                'user-agent': details.userAgent,
                accept: 'application/json',
                'x-fl-device-id': details.deviceId,
                'accept-language': 'en-us',
                'x-fl-app-version': '4.6.1',
                'x-api-key': details.apiKey || API_KEY,
                'x-flapi-api-identifier': details.apiIdentifier || API_ID,
                'x-fl-request-id': uuid(),
                'accept-encoding': 'gzip, deflate, br',
                'x-flapi-session-id': details.sessionId,
                'x-csrf-token': details.csrfToken,
                'x-fl-productid': details.sizeCode,
                'cache-control': 'no-cache',
                pragma: 'no-cache',
                'spoof-host': 'www.footlocker.com',
                'fastly-debug': '1',
                connection: 'close',
                host: details.host,
                'content-type': 'application/json',
                'Fastly-FF': 'bwi5039-BWI',
            },
        };
    } else {
        requestOptions = {
            headers: {
                accept: 'application/json',
                referer: `https://${details.host}/`,
                'x-fl-request-id': uuid(),
                'User-Agent': details.userAgent,
                'sec-fetch-site': 'same-origin',
                'sec-fetch-mode': 'cors',
                'sec-fetch-dest': 'empty',
                'accept-encoding': 'gzip, deflate, br',
                origin: `https://${details.host}`,
                'x-fl-productid': details.sizeCode,
                'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0, max-stale=0, post-check=0, pre-check=0',
                Pragma: 'no-cache',
                Expires: '0',
                Vary: '*',
                'x-csrf-token': details.csrfToken,
                ...(details.cacheNodeRequestOptions?.headers ?? {}),
            },
            ...(details.cacheNodeRequestOptions?.options ?? {}),
        };
    }
    return httpClient.post(url, {
        ...requestOptions,
        responseType: 'text',
        searchParams: {
            timestamp: Date.now(),
        },
        json: {
            productQuantity: details.qty,
            productId: details.sizeCode,
        },
    });
};

export default addToCart;
