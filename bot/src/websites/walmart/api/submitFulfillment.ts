import { Got } from 'got/dist/source/types';

const submitFulfillment = (httpClient: Got, userAgent: string, itemIds: string[]) => {
    const http2Headers = {
        'sec-ch-ua': '"Chromium";v="92", " Not A;Brand";v="99", "Google Chrome";v="92"',
        dnt: '1',
        inkiru_precedence: 'false',
        'sec-ch-ua-mobile': '?0',
        'user-agent': userAgent,
        'content-type': 'application/json',
        accept: 'application/json, text/javascript, */*; q=0.01',
        wm_cvv_in_session: 'true',
        wm_vertical_id: '0',
        origin: 'https://www.walmart.com',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        referer: 'https://www.walmart.com/checkout/',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-US,en;q=0.9',
    };

    const http1Headers = {
        Host: 'www.walmart.com',
        Connection: 'keep-alive',
        accept: 'application/json, text/javascript, */*; q=0.01',
        DNT: '1',
        inkiru_precedence: 'false',
        wm_cvv_in_session: 'true',
        'User-Agent': userAgent,
        wm_vertical_id: '0',
        'content-type': 'application/json',
        Origin: 'https://www.walmart.com',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        Referer: 'https://www.walmart.com/checkout/',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
    };

    const headers = httpClient.defaults.options.http2 ? http2Headers : http1Headers;
    return httpClient.post('https://www.walmart.com/api/checkout/v3/contract/:PCID/fulfillment', {
        headers,
        json: {
            groups: [
                {
                    fulfillmentOption: 'S2H',
                    itemIds,
                    shipMethod: 'EXPEDITED',
                },
            ],
        },
    });
};

export default submitFulfillment;
