import { Got } from 'got/dist/source/types';
import { v4 as uuid } from 'uuid';

const API_KEY = 'm38t5V0ZmfTsRpKIiQlszub1Tx4FbnGG';
const API_ID = '921B2b33cAfba5WWcb0bc32d5ix89c6b0f614';

interface generateSessionDetails {
    strategy: string | 'ShieldBypass';
    host: string;
    userAgent: string;
    deviceId?: string;
    apiKey?: string;
    apiIdentifier?: string;
}

const generateSession = (httpClient: Got, details: generateSessionDetails) => {
    let url, requestOptions;
    if (details.strategy === 'ShieldBypass') {
        url = `https://${details.host}/apigate/v3/session`;
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
                Host: details.host,
                host: `${details.host}:443`,
            },
        };
    } else {
        url = `https://${details.host}/api/session`;
        requestOptions = {
            headers: {
                host: `${details.host}`,
                referer: '',
            },
        };
    }
    return httpClient.get(url, {
        responseType: 'text',
        searchParams: {
            timestamp: Date.now(),
        },
        ...requestOptions,
    });
};

export default generateSession;
