import { Got } from 'got/dist/source';

export const getCreateAccountPage = (httpClient: Got, userAgent: string) => {
    return httpClient.get('https://www.walmart.com/account/signup', {
        searchParams: {
            ref: 'domain',
        },
        headers: {
            'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
            'sec-ch-ua-mobile': '?0',
            dnt: '1',
            'upgrade-insecure-requests': '1',
            'user-agent': userAgent,
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
            'sec-fetch-site': 'none',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-user': '?1',
            'sec-fetch-dest': 'document',
            'accept-encoding': 'gzip, deflate, br',
            'accept-language': 'en-US,en;q=0.9',
        },
    });
};

const createAccount = (httpClient: Got, userAgent: string, user: { firstName: string; lastName: string; email: string; password: string }) => {
    const http2Headers = {
        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
        dnt: '1',
        'sec-ch-ua-mobile': '?0',
        'user-agent': userAgent,
        'content-type': 'application/json',
        accept: '*/*',
        origin: 'https://www.walmart.com',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        referer: 'https://www.walmart.com/account/signup?ref=domain',
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
        Referer: 'https://www.walmart.com/account/signup?ref=domain',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
    };

    const headers = httpClient.defaults.options.http2 ? http2Headers : http1Headers;

    return httpClient.post('https://www.walmart.com/account/electrode/api/signup', {
        headers,

        searchParams: {
            ref: 'domain',
        },

        json: {
            personName: {
                firstName: user.firstName,
                lastName: user.lastName,
            },
            email: user.email,
            password: user.password,
            rememberme: false,
            showRememberme: 'true',
            emailNotificationAccepted: false,
            captcha: {
                sensorData: '',
            },
        },
    });
};

export default createAccount;
