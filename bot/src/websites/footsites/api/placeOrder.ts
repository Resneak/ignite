import { Got } from 'got/dist/source/types';
import { v4 as uuid } from 'uuid';

const API_KEY = 'm38t5V0ZmfTsRpKIiQlszub1Tx4FbnGG';
const API_ID = '921B2b33cAfba5WWcb0bc32d5ix89c6b0f614';

interface placeOrderDetails {
    strategy: string | 'ShieldBypass';
    host: string;
    encryptedCard: any;
    userAgent: string;
    csrfToken: string;
    sessionId: string;
    cartGUID: string;
    cookieString: string;
    deviceId?: string;
    apiKey?: string;
    apiIdentifier?: string;
}

const placeOrder = (httpClient: Got, details: placeOrderDetails) => {
    let url, requestOptions;
    if (details.strategy === 'ShieldBypass') {
        url = `https://${details.host}/apigate/users/orders`;
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
                'x-flapi-cart-guid': details.cartGUID,
                'content-type': 'application/json',
                Host: details.host,
                host: `${details.host}:443`,
            },
        };
    } else {
        url = `https://${details.host}/api/users/orders`;
        requestOptions = {
            headers: {
                host: `${details.host}`,
                referer: `https://${details.host}/adyen/checkout`,
                'x-csrf-token': details.csrfToken,
                'x-fl-request-id': uuid(),
                'fastly-restart-on-error': '1',
            },
        };
    }
    return httpClient.post(url, {
        searchParams: {
            timestamp: Date.now(),
        },
        responseType: 'text',
        json: {
            preferredLanguage: 'en',
            termsAndCondition: false,
            deviceId: details.csrfToken,
            cartId: details.cartGUID,
            encryptedCardNumber: details.encryptedCard,
            encryptedExpiryYear: details.encryptedCard,
            encryptedExpiryMonth: details.encryptedCard,
            encryptedSecurityCode: details.encryptedCard,
            paymentMethod: 'CREDITCARD',
            returnUrl: `https://${details.host}/adyen/checkout`,
            browserInfo: {
                screenWidth: 1920,
                screenHeight: 1080,
                colorDepth: 24,
                userAgent:
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.66 Safari/537.36',
                timeZoneOffset: 480,
                language: 'en-US',
                javaEnabled: false,
            },
        },
        ...requestOptions
    });
};

export default placeOrder;