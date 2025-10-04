import { Got } from 'got/dist/source/types';
import { v4 as uuid } from 'uuid';

const API_KEY = 'm38t5V0ZmfTsRpKIiQlszub1Tx4FbnGG';
const API_ID = '921B2b33cAfba5WWcb0bc32d5ix89c6b0f614';

interface recaptchaDetails {
    captchaToken: string;
    queueItCustomerId: string;
    queueItEventId: string;
    queueItVersion: string;
    userAgent: string;
    deviceId?: string;
    apiKey?: string;
    apiIdentifier?: string;
}

const postRecaptcha = (httpClient: Got, details: recaptchaDetails) => {
    return httpClient.get('https://footlocker.queue-it.net/challengeapi/verify', {
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
            challengeType: 'recaptcha-invisible',
            sessionId: details.captchaToken,
            customerId: details.queueItCustomerId,
            eventId: details.queueItEventId,
            version: details.queueItVersion,
        },
    });
};

export default postRecaptcha;