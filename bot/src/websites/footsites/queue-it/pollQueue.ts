import { Got } from 'got/dist/source/types';
import { v4 as uuid } from 'uuid';

const API_KEY = 'm38t5V0ZmfTsRpKIiQlszub1Tx4FbnGG';
const API_ID = '921B2b33cAfba5WWcb0bc32d5ix89c6b0f614';

interface pollDetails {
    userAgent: string;
    queueItEventId: string;
    queueItLayout: string;
    queueItTargetUrl: string;
    queueItCustomUrlParams: string;
    queueItLayoutVersion: string;
    queueItQueueId: string;
    seid: string;
    timestamp: string;
    deviceId?: string;
    apiKey?: string;
    apiIdentifier?: string;
}

const pollQueue = (httpClient: Got, details: pollDetails) => {
    return httpClient.post(`https://footlocker.queue-it.net/spa-api/queue/footlocker/${details.queueItEventId}/${details.queueItQueueId}/status`, {
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
            targetUrl: details.queueItTargetUrl,
            customUrlParams: details.queueItCustomUrlParams,
            layoutVersion: details.queueItLayoutVersion,
            layoutName: details.queueItLayout,
            isClientRedayToRedirect: true,
            isBeforeOrIdle: false,
        },
        searchParams: {
            cid: 'en-US',
            l: details.queueItLayout,
            seid: details.seid,
            sets: details.timestamp,
        }
    });
};

export default pollQueue;