import { Got } from 'got/dist/source/types';
import { v4 as uuid } from 'uuid';

const API_KEY = 'm38t5V0ZmfTsRpKIiQlszub1Tx4FbnGG';
const API_ID = '921B2b33cAfba5WWcb0bc32d5ix89c6b0f614';

interface submitPaypalDetails {
    strategy: string | 'ShieldBypass';
    host: string;
    url: string;
    userAgent: string;
    csrfToken: string;
    sessionId: string;
    cartGUID: string;
    cookieString: string;
    profile: any;
    deviceId?: string;
    apiKey?: string;
    apiIdentifier?: string;
}

const submitPaypal = (httpClient: Got, details: submitPaypalDetails) => {
    let requestOptions;
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
                'x-flapi-cart-guid': details.cartGUID,
                'content-type': 'application/json',
                Host: details.host,
                host: `${details.host}:443`,
            }
        }
    } else {
        requestOptions = {
            headers: {
                'X-FLAPI-CART-GUID': details.cartGUID,
                'x-api-lang': 'en-EN',
                host: details.host,
                'x-csrf-token': details.csrfToken,
                'x-fl-request-id': uuid(),
                referer: `https://${details.host}/checkout`,
                cookie: details.cookieString,
            }
        }
    }
    return httpClient.post(`${details.url}/apigate/users/carts/current/paypal`, {
        searchParams: {
            timestamp: Date.now(),
        },
        responseType: 'text',
        json: {
            checkoutType: 'EXPRESS',
            details: {
                billingAddress: {
                    countryCodeAlpha2: details.profile.shippingAddress.country,
                    firstName: details.profile.shippingAddress.firstName,
                    lastName: details.profile.shippingAddress.lastName,
                    line1: details.profile.shippingAddress.address,
                    locality: details.profile.shippingAddress.city,
                    postalCode: details.profile.shippingAddress.zip,
                    recipientName: [details.profile.shippingAddress.firstName, details.profile.shippingAddress.lastName].join(' '),
                    region: details.profile.shippingAddress.stateCode,
                },
                countryCode: details.profile.shippingAddress.country,
                email: details.profile.shippingAddress.email,
                firstName: details.profile.shippingAddress.firstName,
                lastName: details.profile.shippingAddress.lastName,
                payerId: 'null',
                phone: details.profile.shippingAddress.phone,
                shippingAddress: {
                    countryCodeAlpha2: details.profile.shippingAddress.country,
                    firstName: details.profile.shippingAddress.firstName,
                    lastName: details.profile.shippingAddress.lastName,
                    line1: details.profile.shippingAddress.address,
                    locality: details.profile.shippingAddress.city,
                    postalCode: details.profile.shippingAddress.zip,
                    recipientName: [details.profile.shippingAddress.firstName, details.profile.shippingAddress.lastName].join(' '),
                    region: details.profile.shippingAddress.stateCode,
                },
            },
            nonce: uuid(),
            type: 'PayPal',
        },
        ...requestOptions,
    });
};

export default submitPaypal;