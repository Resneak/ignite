import { Got } from 'got/dist/source';
//TODO update headers
/**
 *
 * @param httpClient
 * @param userAgent
 * @param removeItemFrom cart or saved items list
 * @param itemID id of the item to remove, not the pid (can be found using the /cart endpoint)
 * @returns
 */
const removeItem = (httpClient: Got, userAgent: string, removeItemFrom: 'cart' | 'saved', itemID: string) => {
    const http2Headers = {
        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
        dnt: '1',
        'sec-ch-ua-mobile': '?0',
        'user-agent': userAgent,
        credentials: 'include',
        'content-type': 'application/json',
        accept: 'application/json, text/javascript, */*; q=0.01',
        omitcsrfjwt: 'true',
        // 'wm_qos.correlation_id': '5e6f223d-d88e-423f-a953-9443ad31c344',
        origin: 'https://www.walmart.com',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        referer: 'https://www.walmart.com/cart',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-US,en;q=0.9',
    };

    const http1Headers = http2Headers; // TODO
    const headers = httpClient.defaults.options.http2 ? http2Headers : http1Headers;

    return httpClient.delete(`https://www.walmart.com/api/v3/${removeItemFrom}/:CRT/items/${itemID}`, {
        headers,
    });
};

export default removeItem;
