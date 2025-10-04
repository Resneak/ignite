import { Got } from 'got/dist/source/types';
import { WalmartAccountType } from '../Walmart';

export interface WalmartATCDetails {
    productID: string;
    offerId: string;
    quantity: number;
    postalCode: string;
    city: string;
    stateCode: string;
    storeIds: number[];
}

/**
 *
 * @param httpClient
 * @param accountType
 * @returns
 */
const addToCart = (httpClient: Got, userAgent: string, accountType: WalmartAccountType, details: WalmartATCDetails) => {
    let url;
    switch (accountType) {
        case WalmartAccountType.Guest:
            url = 'https://www.walmart.com/api/v3/cart/guest/:CID/items';
            break;
        case WalmartAccountType.Login:
        case WalmartAccountType.New:
            // url = 'https://www.walmart.com/api/v3/cart/:CRT/items';
            url = 'https://www.walmart.com/api/v3/cart/customer/:CID/items';
    }

    const http2Headers = {
        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
        accept: 'application/json',
        dnt: '1',
        'sec-ch-ua-mobile': '?0',
        'user-agent': userAgent,
        'content-type': 'application/json',
        origin: 'https://www.walmart.com',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        referer: `https://www.walmart.com/ip/${details.productID}`,
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-US,en;q=0.9',
    };

    const http1Headers = {
        Host: 'www.walmart.com',
        Connection: 'keep-alive',
        'sec-ch-ua': '"Chromium";v="92", " Not A;Brand";v="99", "Google Chrome";v="92"',
        accept: 'application/json',
        DNT: '1',
        'sec-ch-ua-mobile': '?0',
        'User-Agent': userAgent,
        'content-type': 'application/json',
        Origin: 'https://www.walmart.com',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        Referer: `https://www.walmart.com/ip/${details.productID}`,
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
    };

    const headers = httpClient.defaults.options.http2 ? http2Headers : http1Headers;

    return httpClient.post(url, {
        headers,
        json: {
            offerId: details.offerId,
            quantity: details.quantity,
            // storeIds: [],
            location: {
                postalCode: details.postalCode,
                city: details.city,
                state: details.stateCode,
                isZipLocated: true,
            },
            shipMethodDefaultRule: 'SHIP_RULE_1',
            // storeIds: details.storeIds, // do we need this?
        },
    });
};
export default addToCart;
