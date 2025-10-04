import { Got } from 'got/dist/source/types';

const fetchShippingRates = (httpClient: Got, userAgent: string, zip: string) => {
    const http2Headers = {
        'sec-ch-ua': '"Chromium";v="92", " Not A;Brand";v="99", "Google Chrome";v="92"',
        dnt: '1',
        'sec-ch-ua-mobile': '?0',
        'user-agent': userAgent,
        'content-type': 'application/json',
        accept: '*/*',
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
        accept: '*/*',
        DNT: '1',
        'User-Agent': userAgent,
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
    return httpClient.put(
        'https://www.walmart.com/account/api/location',

        {
            headers,
            json: {
                postalCode: zip,
                responseGroup: 'STOREMETAPLUS',
                includePickUpLocation: true,
                persistLocation: true,
                clientName: 'Web-Checkout-ShippingAddress',
                storeMeta: true,
                plus: true,
            },
        }
    );
};
export default fetchShippingRates;
