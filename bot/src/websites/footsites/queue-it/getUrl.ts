import { Got } from 'got/dist/source/types';
import { v4 as uuid } from 'uuid';

const API_KEY = 'm38t5V0ZmfTsRpKIiQlszub1Tx4FbnGG';
const API_ID = '921B2b33cAfba5WWcb0bc32d5ix89c6b0f614';

interface queueDetails {
    url: string;
    userAgent: string;
    deviceId?: string;
    apiKey?: string;
    apiIdentifier?: string;
}

const getQueueIt = (httpClient: Got, details: queueDetails) => {
    return httpClient.get(details.url, {
        headers: {
            'user-agent': details.userAgent,
            accept: 'application/json',
            'x-fl-device-id': details.deviceId,
            'accept-language': 'en-us',
            'x-fl-app-version': '4.6.1',
            'x-api-key': details.apiKey,
            'x-flapi-api-identifier': details.apiIdentifier,
            'x-fl-request-id': uuid(),
            'accept-encoding': 'gzip, deflate, br',
        }
        
    });
};

export default getQueueIt;