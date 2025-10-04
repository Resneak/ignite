import { Got } from 'got/dist/source';
import { EncryptionInformation } from './submitPayment';

const submitOrder = (httpClient: Got, userAgent: string, encryption: EncryptionInformation, preferenceID: string) => {
    const preferenceIdObj = preferenceID ? { preferenceId: '' } : {};

    const http2Headers = {
        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
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

    return httpClient.put('https://www.walmart.com/api/checkout/v3/contract/:PCID/order', {
        headers,
        json: {
            cvvInSession: true,
            voltagePayments: [
                {
                    paymentType: 'CREDITCARD',
                    ...preferenceIdObj,
                    encryptedCvv: encryption.payment.encryptedCvvPayment,
                    encryptedPan: encryption.payment.encryptedPanPayment,
                    integrityCheck: encryption.payment.integrityCheckPayment,
                    keyId: encryption.PIE_key_id,
                    phase: encryption.PIE_key_phase,
                },
            ],
        },
    });
};

export default submitOrder;
