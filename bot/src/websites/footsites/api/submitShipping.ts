import { Got } from 'got/dist/source/types';
import { v4 as uuid } from 'uuid';
import { request } from '../../../../../http-client';

const API_KEY = 'm38t5V0ZmfTsRpKIiQlszub1Tx4FbnGG';
const API_ID = '921B2b33cAfba5WWcb0bc32d5ix89c6b0f614';

interface submitShippingDetails {
    strategy: string | 'ShieldBypass';
    host: string;
    profile: any;
    userAgent: string;
    csrfToken: string;
    sessionId: string;
    cartGUID: string;
    cookieString: string;
    deviceId?: string;
    apiKey?: string;
    apiIdentifier?: string;
}

const submitShipping = (httpClient: Got, details: submitShippingDetails) => {
    let url, requestOptions;
    if (details.strategy === 'ShieldBypass') {
        url = `https://${details.host}/api/users/carts/current/addresses/shipping`
        requestOptions = {
            headers: {
                referer: `https://${details.host}/checkout`,
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
        }
    } else {
        url = `https://${details.host}/apigate/users/carts/current/addresses/shipping`;
        requestOptions = {
            headers: {
                host: `${details.host}`,
                'x-csrf-token': details.csrfToken,
                'x-flapi-session-id': details.sessionId,
                'x-fl-request-id': uuid(),
                referer: `https://${details.host}/checkout`,
                'fastly-restart-on-error': '1',
                cookie: details.cookieString,
            },
        }
    }
    return httpClient.post(url, {
        searchParams: {
            timestamp: Date.now(),
        },
        responseType: 'text',
        json: {
            shippingAddress: {
                setAsDefaultBilling: false,
                setAsDefaultShipping: false,
                firstName: details.profile.shippingAddress.firstName,
                lastName: details.profile.shippingAddress.lastName,
                email: details.profile.shippingAddress.email,
                phone: details.profile.shippingAddress.phone,
                country: {
                    isocode: details.profile.shippingAddress.country,
                    name: details.profile.shippingAddress.country === 'US' ? 'United States' : 'Canada',
                },
                id: null,
                setAsBilling: false,
                region: {
                    countryIso: details.profile.shippingAddress.country,
                    isocode: `${details.profile.shippingAddress.country}-${details.profile.shippingAddress.stateCode}`,
                    isocodeShort: details.profile.shippingAddress.stateCode,
                    name: details.profile.shippingAddress.state,
                },
                type: 'default',
                LoqateSearch: '',
                line1: details.profile.shippingAddress.address,
                line2: details.profile.shippingAddress.secondaryAddress,
                postalCode: details.profile.shippingAddress.zip,
                town: details.profile.shippingAddress.city,
                regionFPO: null,
                shippingAddress: true,
                recordType: 'S',
            },
        },
        ...requestOptions,
    });
};

export default submitShipping;