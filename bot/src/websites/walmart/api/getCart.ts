import { Got } from 'got/dist/source/types';
import { WalmartAccountType } from '../Walmart';

/**
 *
 * @param httpClient
 * @param userAgent
 * @param accountType
 * @param productID used as the referer for this page
 * @returns
 */
const getCart = (httpClient: Got, userAgent: string, accountType: WalmartAccountType, productID: string) => {
    const productRedirectPage = `https://www.walmart.com/ip/${productID}`;

    let searchParams;

    switch (accountType) {
        case WalmartAccountType.Login:
            searchParams = {
                action: 'SignIn',
                rm: true,
            };
        case WalmartAccountType.New:
            searchParams = {
                action: 'Create',
                rm: false,
            };
        case WalmartAccountType.Guest: {
            searchParams = {};
        }
    }

    const http2Headers = {
        'sec-ch-ua': '"Chromium";v="92", " Not A;Brand";v="99", "Google Chrome";v="92"',
        'sec-ch-ua-mobile': '?0',
        'upgrade-insecure-requests': '1',
        dnt: '1',
        'user-agent': userAgent,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'service-worker-navigation-preload': 'true',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-user': '?1',
        'sec-fetch-dest': 'document',
        referer: productRedirectPage,
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-US,en;q=0.9',
    };

    const http1Headers = {
        Host: 'www.walmart.com',
        Connection: 'keep-alive',
        'sec-ch-ua': '"Chromium";v="92", " Not A;Brand";v="99", "Google Chrome";v="92"',
        'sec-ch-ua-mobile': '?0',
        'Upgrade-Insecure-Requests': '1',
        DNT: '1',
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-User': '?1',
        'Sec-Fetch-Dest': 'document',
        Referer: productRedirectPage,
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
    };

    const headers = httpClient.defaults.options.http2 ? http2Headers : http1Headers;

    return httpClient.get('https://www.walmart.com/cart', {
        headers,
        searchParams,
    });
};

export default getCart;
