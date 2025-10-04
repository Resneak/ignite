import { Got } from 'got/dist/source/types';
import { v4 as uuid } from 'uuid';

const API_KEY = 'm38t5V0ZmfTsRpKIiQlszub1Tx4FbnGG';
const API_ID = '921B2b33cAfba5WWcb0bc32d5ix89c6b0f614';

interface enterQueueDetails {
    url: string;
    queueItEventId: string;
    queueItChallengeSessions: string;
    queueItLayout: string;
    queueItCustomUrlParams: string;
    queueItTargetUrl: string;
    userAgent: string;
    deviceId?: string;
    apiKey?: string;
    apiIdentifier?: string;
}

const enterQueue = (httpClient: Got, details: enterQueueDetails) => {
    return httpClient.post(`https://footlocker.queue-it.net/spa-api/queue/footlocker/${details.queueItEventId}/enqueue?cid=en-US`, {
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
        },
        json: {
            challengeSessions: details.queueItChallengeSessions,
            layoutName: details.queueItLayout,
            customUrlParams: details.queueItCustomUrlParams,
            targetUrl: details.queueItTargetUrl,
            Referrer: '',
        },
    });
};

export default enterQueue;