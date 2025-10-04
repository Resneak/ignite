import { Got } from 'got/dist/source/types';
import { v4 as uuid } from 'uuid';

const API_KEY = 'm38t5V0ZmfTsRpKIiQlszub1Tx4FbnGG';
const API_ID = '921B2b33cAfba5WWcb0bc32d5ix89c6b0f614';

interface submitEmailDetails {
    strategy: string | 'ShieldBypass';
    host: string;
    email: string;
    userAgent: string;
    csrfToken: string;
    sessionId: string;
    cartGUID: string;
    cookieString: string;
    deviceId?: string;
    apiKey?: string;
    apiIdentifier?: string;
}

const submitEmail = (httpClient: Got, details: submitEmailDetails) => {
    let url, requestOptions;
    if (details.strategy === 'ShieldBypass') {
        url = `https://${details.host}/apigate/users/carts/current/email/${details.email}`
        requestOptions = {
            headers: {
                referer: `https://${details.host}/checkout`,
                cookie: details.cookieString,
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
        url = `https://${details.host}/api/users/carts/current/email/${details.email}`
        requestOptions = {
            headers: {
                host: details.host,
                'x-csrf-token': details.csrfToken,
                'x-flapi-session-id': details.sessionId,
                'x-fl-request-id': uuid(),
                referer: `https://${details.host}/checkout`,
                'fastly-restart-on-error': '1',
                cookie: details.cookieString,
            }
        }
    }
    return httpClient.put(url, {
        responseType: 'text',
        searchParams: {
            timestamp: Date.now(),
        },
        ...requestOptions,
    });
};

export default submitEmail;