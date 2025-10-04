import { remote } from 'electron';
import { Got } from 'got';
import getHWID from 'hwid';

const got: Got = remote.require('got');

const httpClient = got.extend({
    headers: {
        'User-Agent': `Ignite v${remote.app.getVersion()}`,
    },
    prefixUrl: 'https://www.ignitebot.io/auth',
});

export async function authenticate(licenseKey: string) {
    const hwid = await getHWID();
    const response = await httpClient.post('bot-login', {
        json: {
            hwid,
            key: licenseKey,
        },
        responseType: 'json',
    });
    return response.body;
}
