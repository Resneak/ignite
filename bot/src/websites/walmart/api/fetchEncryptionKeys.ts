import { Got } from 'got/dist/source';

const fetchEncryptionKey = (httpClient: Got, userAgent: string) => {
    const url = 'https://securedataweb.walmart.com/pie/v1/wmcom_us_vtg_pie/getkey.js';
    return httpClient.get(url, {
        headers: {
            Host: 'securedataweb.walmart.com',
            Connection: 'keep-alive',
            'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
            DNT: '1',
            'sec-ch-ua-mobile': '?0',
            'User-Agent': userAgent,
            Accept: '*/*',
            'Sec-Fetch-Site': 'same-site',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Dest': 'script',
            Referer: 'https://www.walmart.com/',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9',
        },
        http2: false,
        searchParams: {
            bust: Date.now(),
        },
    });
};

export const parseEncryptionKeys = (body: string) => {
    const PIE_L = parseInt(body?.split('PIE.L = ')?.[1]?.split(';')?.[0]);
    const PIE_E = parseInt(body?.split('PIE.E = ')?.[1]?.split(';')?.[0]);
    const PIE_K = body?.split('PIE.K = "')?.[1]?.split('";')?.[0];
    const PIE_key_id = body?.split('PIE.key_id = "')?.[1]?.split('";')?.[0];
    const PIE_phase = parseInt(body?.split('PIE.phase = ')?.[1]?.split(';')?.[0]);

    return { PIE_L, PIE_E, PIE_K, PIE_key_id, PIE_phase };
};

export default fetchEncryptionKey;
