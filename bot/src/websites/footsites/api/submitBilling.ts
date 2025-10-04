import { Got } from 'got/dist/source/types';
import { v4 as uuid } from 'uuid';

const API_KEY = 'm38t5V0ZmfTsRpKIiQlszub1Tx4FbnGG';
const API_ID = '921B2b33cAfba5WWcb0bc32d5ix89c6b0f614';

interface submitBillingDetails {
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

const submitBilling = (httpClient: Got, details: submitBillingDetails) => {
    let url, requestOptions;
    if (details.strategy === 'ShieldBypass') {
        url = `https://${details.host}/apigate/users/carts/current/set-billing`;
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
        url = `https://${details.host}/api/users/carts/current/set-billing`;
        requestOptions = {
            headers: {
                Host: `${details.host}`,
                'x-csrf-token': details.csrfToken,
                'x-fl-request-id': uuid(),
                'fastly-restart-on-error': '1',
                referer: `https://${details.host}/checkout`,
            },
        };
    }
    return httpClient.post(url, {
        searchParams: {
            timestamp: Date.now(),
        },
        responseType: 'text',
        json: {
            setAsDefaultBilling: false,
            setAsDefaultShipping: false,
            firstName: details.profile.shippingAddress.firstName,
            lastName: details.profile.shippingAddress.lastName,
            phone: details.profile.shippingAddress.phone,
            country: {
                isocode: details.profile.shippingAddress.country,
                name: details.profile.shippingAddress.country === 'US' ? 'United States' : 'Canada',
            },
            id: null,
            type: 'default',
            LoqateSearch: '',
            line1: details.profile.shippingAddress.address,
            line2: details.profile.shippingAddress.secondaryAddress,
            postalCode: details.profile.shippingAddress.zip,
            town: details.profile.shippingAddress.city,
            region: {
                countryIso: details.profile.shippingAddress.country,
                isocode: `${details.profile.shippingAddress.country}-${details.profile.shippingAddress.stateCode}`,
                isocodeShort: details.profile.shippingAddress.stateCode,
                name: details.profile.shippingAddress.state,
            },
            regionFPO: null,
            recordType: ' ',
            shippingAddress: true,
            setAsBilling: false,
            email: false,
        },
        ...requestOptions,
    });
};

export default submitBilling;