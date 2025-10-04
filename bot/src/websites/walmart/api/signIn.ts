import { Got } from 'got';
import httpClient from '../../../../../http-client';

/**
 *
 * @param httpClient
 * @param userAgent
 * @param user email and password to login with
 * @returns
 */
const signIn = async (httpClient: Got, userAgent: string, user: { email: string; password: string }) => {
    const http2Headers = {
        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
        'sec-ch-ua-mobile': '?0',
        'user-agent': userAgent,
        'content-type': 'application/json',
        accept: '*/*',
        origin: 'https://www.walmart.com',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        referer: 'https://www.walmart.com/account/login?tid=0&returnUrl=%2F',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-US,en;q=0.9',
    };

    const http1Headers = {
        Host: 'www.walmart.com',
        Connection: 'keep-alive',
        accept: '*/*',
        DNT: '1',
        'User-Agent': userAgent,
        'content-type': 'application/json',
        Origin: 'https://www.walmart.com',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        Referer: 'https://www.walmart.com/account/login?ref=domain',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
    };

    const headers = httpClient.defaults.options.http2 ? http2Headers : http1Headers;
    const url = 'https://www.walmart.com/account/electrode/api/signin?tid=0&returnUrl=%2F';
    return httpClient.post(url, {
        headers,
        json: {
            username: user.email,
            password: user.password,
            rememberme: false,
            showRememberme: 'true',
            captcha: {
                sensorData: '',
            },
        },
    });
};

export const getSignIn = async (httpClient: Got, userAgent: string) => {
    return httpClient.get('https://www.walmart.com/account/login?tid=0&returnUrl=%2F', {
        headers: {
            'sec-ch-ua': '"Chromium";v="92", " Not A;Brand";v="99", "Google Chrome";v="92"',
            'sec-ch-ua-mobile': '?0',
            'upgrade-insecure-requests': '1',
            dnt: '1',
            'user-agent': userAgent,
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
            'service-worker-navigation-preload': 'true',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-user': '?1',
            'sec-fetch-dest': 'document',
            referer: 'https://www.walmart.com/',
            'accept-encoding': 'gzip, deflate, br',
            'accept-language': 'en-US,en;q=0.9',
        },
    });
};

export default signIn;
