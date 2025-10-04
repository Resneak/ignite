import PX, { SupportedSite } from './index';
import got from 'got';
import { httpsOverHttp } from 'tunnel';

let px: PX;

let httpClient = got.extend({
    timeout: 20000,
    cache: false,
    mutableDefaults: true,
    throwHttpErrors: false,
    https: {
        rejectUnauthorized: false,
        checkServerIdentity: (hostname, certificate) => {
            return;
        },
    },
    http2: false,
    followRedirect: false,
    decompress: true,
    agent: {
        https: httpsOverHttp({
            proxy: {
                host: '127.0.0.1',
                port: 8888,
                ...{ rejectUnauthorized: false },
            },
            ...{ rejectUnauthorized: false },
        }) as any,
    },
});

beforeAll(() => {
    px = new PX(SupportedSite.Walmart, httpClient);
});

jest.setTimeout(20_000);

test('can get user agent', async () => {
    expect.assertions(3);

    try {
        const response = await px.getUserAgent();
        expect(response.body).toBeDefined();
        const error = /error/.test(response?.body);
        expect(error).toBeFalsy();
        console.log(`User Agent: ${response.body}`);
        httpClient.defaults.options.headers['user-agent'] = response.body;
        expect(httpClient.defaults.options.headers['user-agent']).toBe(response.body);
        console.log(httpClient.defaults.options.headers['user-agent']);
    } catch (e) {
        expect(e).toBeUndefined();
    }
});

test('can solve px normal', async () => {
    expect.assertions(3);
    console.log(httpClient.defaults.options.headers['user-agent']);
    try {
        let response = await px.solveNormal('https://www.walmart.com', httpClient.defaults.options.headers['user-agent'] as string);
        console.log(response);
        expect(response.success).toBe(true);
        expect(response.cookies['_px3']).toBeDefined();
        expect(response.cookies['_pxde']).toBeDefined();
    } catch (e) {
        console.log(e);
        expect(e).toBeUndefined();
    }
});

test('can solve hold', async () => {
    expect.assertions(3);
    console.log(httpClient.defaults.options.headers['user-agent']);
    try {
        let response = await px.solveHold('https://www.walmart.com', httpClient.defaults.options.headers['user-agent'] as string);
        console.log(response);
        expect(response.success).toBeDefined();
        expect(response.cookies['_px3']).toBeDefined();
        expect(response.cookies['_pxde']).toBeDefined();
    } catch (e) {
        console.log(e);
        expect(e).toBeUndefined();
    }
});
