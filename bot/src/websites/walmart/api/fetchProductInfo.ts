import { Got } from 'got/dist/source/types';

export interface ProductOffer {
    offerID: string;
    name: string;
    image: string;
    price: string;
    timestamp: number;
}

const fetchProductInfo = (httpClient: Got, userAgent: string, productID: string) => {
    const http2Headers = {
        'cache-control': 'max-age=0',
        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
        'sec-ch-ua-mobile': '?0',
        dnt: '1',
        'upgrade-insecure-requests': '1',
        'user-agent': userAgent,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'service-worker-navigation-preload': 'true',
        'sec-fetch-site': 'none',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-user': '?1',
        'sec-fetch-dest': 'document',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-US,en;q=0.9',
    };

    const http1Headers = {
        Host: 'www.walmart.com',
        Connection: 'keep-alive',
        'sec-ch-ua': '"Chromium";v="92", " Not A;Brand";v="99", "Google Chrome";v="92"',
        'sec-ch-ua-mobile': '?0',
        DNT: '1',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'Service-Worker-Navigation-Preload': 'true',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-User': '?1',
        'Sec-Fetch-Dest': 'document',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
    };

    const headers = httpClient.defaults.options.http2 ? http2Headers : http1Headers;

    return httpClient.get(`https://www.walmart.com/terra-firma/item/${productID}`, {
        headers,
    });
};

export const parseProductInfo = (body: any) => {
    const offers: any[] = Object.values(body?.payload?.offers || {});

    let primaryProduct = body?.payload?.primaryProduct;
    let productName = body?.payload?.products[primaryProduct]?.productAttributes?.productName || '';
    let defaultImage = body.payload?.selected?.defaultImage;
    let image = body?.payload?.images[defaultImage]?.assetSizeUrls?.DEFAULT;

    const offer = offers.filter((offer) => {
        return offer.sellerId === 'F55CDC31AB754BB68FE0B39041159D63';
    });
    let offerID = offer?.[0]?.id;

    if (!offerID) {
        return { success: false, productOffer: {} };
    }

    let price = body?.payload?.offers?.[offerID]?.pricesInfo?.priceMap?.CURRENT?.price;

    const productOffer: ProductOffer = {
        offerID,
        name: productName || '',
        image: image || '',
        price: price || '',
        timestamp: Date.now(),
    };

    return { success: true, productOffer };
};

export default fetchProductInfo;
