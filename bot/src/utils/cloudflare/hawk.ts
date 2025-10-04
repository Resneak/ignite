// import lz from 'lz-string';

// import { URL } from 'url';
// import Proxy from '../../../../lib/models/proxy';
// const { request } = require('@ignitesoftware/http-client');

// var isRerun = false;

// const auth = {
//     auth: 'test_1fdcce24-5733-42a2-8313-04e590cd3393',
// };

// function compressToEncodedURIComponent(data, alphabet) {
//     return lz._compress(data, 6, (a) => {
//         return alphabet.charAt(a);
//     });
// }

// function sleep(ms) {
//     return new Promise((resolve) => setTimeout(resolve, ms));
// }

// export default class Hawk {
//     private url: string;
//     private host: string;
//     private jar: any;

//     private proxy?: string;

//     private originalResponse?: any;

//     private urlPart?: string;

//     private keyStrUriSafe?: string;

//     private isCaptcha?: boolean;

//     private hawkPart1?: any;

//     private hawkPart2?: any;

//     private hawkPart3?: any;

//     private hawkCaptchaPart1?: any;

//     private challengeResponse?: any;

//     private captchaResponse?: any;

//     private finalPayload?: any;

//     private hCaptchaSolver: (url: string) => Promise<string>;

//     constructor({ url, proxy, jar, hCaptchaSolver }: { url: string; proxy?: Proxy; jar: any; hCaptchaSolver: (url: string) => Promise<string> }) {
//         this.url = url;
//         this.host = new URL(url).host;
//         this.jar = jar;
//         this.proxy = proxy?.getUrl();
//         this.hCaptchaSolver = hCaptchaSolver;
//     }

//     async solve() {
//         console.log('Getting page');
//         await this.getPage(this.url); //sets cookies from page?
//         console.log('getting challenge js');
//         await this.getChallengeJS();
//         console.log('call hawk 1');
//         await this.callToHawkAPIPart1();
//         console.log('call hawk 2');
//         await this.callToHawkAPIPart2();
//         console.log('call hawk 3');
//         await this.callToHawkAPIPart3();
//         console.log('post final');
//         const body = await this.postFinal();

//         return { body, jar: this.jar };
//     }

//     async getPage(url: string) {
//         const options: any = {
//             method: 'GET',
//             url,
//             headers: {
//                 Host: this.host,
//                 'user-gent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.125 Safari/537.36',
//                 Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
//                 'Accept-Language': 'en-US,en;q=0.5',
//                 'accept-encoding': 'deflate',
//                 Connection: 'keep-alive',
//                 'Upgrade-Insecure-Requests': '1',
//             },
//             jar: this.jar,
//         };

//         if (this.proxy) {
//             options.proxy = this.proxy;
//         }

//         const response = await request(options);

//         if (response.statusCode === 503) {
//             this.isCaptcha = false;
//         } else if (response.statusCode === 403) {
//             this.isCaptcha = true;
//         }

//         this.originalResponse = response;
//     }

//     async getChallengeJS() {
//         const scriptUrl = `https://${this.host}/cdn-cgi/challenge-platform/h/g/orchestrate/${this.isCaptcha ? 'captcha' : 'jsch'}/v1`;

//         const options: any = {
//             method: 'GET',
//             url: scriptUrl,
//             jar: this.jar,
//             headers: {
//                 Host: this.host,
//                 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.125 Safari/537.36',
//                 Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
//                 'Accept-Language': 'en-US,en;q=0.5',
//                 'Accept-Encoding': 'deflate',
//                 Connection: 'keep-alive',
//                 'Upgrade-Insecure-Requests': '1',
//             },
//         };

//         if (this.proxy) {
//             options.proxy = this.proxy;
//         }

//         const response = await request(options);

//         console.log(response);
//         // CHALLENGE URL
//         this.urlPart = response.body.match(/0\.[^('|/)]+/)[0];

//         // LZ ALPHABET
//         let match = response.body.match(/[ab]='(?<a>.*)'\.split\('(.)'\)/);

//         const storageArray = match[1].split(match[2]);

//         for (let i = 0; i < storageArray.length; i++) {
//             if (storageArray[i].length === 65 && storageArray[i].includes('-') && storageArray[i].indexOf('$') !== -1) {
//                 this.keyStrUriSafe = storageArray[i];
//                 break;
//             }
//         }
//     }

//     async callToCloudflareAPI(result) {
//         const decodedApiResponse = Buffer.from(result, 'base64').toString();

//         const options: any = {
//             method: 'POST',
//             url: this.hawkPart1['url'],
//             headers: {
//                 Host: this.host,
//                 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.125 Safari/537.36',
//                 Accept: '*/*',
//                 'Accept-Language': 'en-US,en;q=0.5',
//                 'Content-type': 'application/x-www-form-urlencoded',
//                 'CF-Challenge': this.hawkPart1['url'].split('/').slice(-1),
//                 Origin: `https://${this.host}`,
//                 Connection: 'keep-alive',
//                 Referer: `https://${this.host}/`,
//             },
//             jar: this.jar,
//             body: `${this.hawkPart1['name']}=${compressToEncodedURIComponent(decodedApiResponse, this.keyStrUriSafe)}`,
//         };

//         if (this.proxy) {
//             options.proxy = this.proxy;
//         }

//         this.challengeResponse = await request(options);
//     }

//     async postFinal() {
//         await sleep(2000);

//         const form = `r=${this.finalPayload['r']}&jschl_vc=${this.finalPayload['jschl_vc']}&pass=${this.finalPayload['pass']}&jschl_answer=${this.finalPayload['jschl_answer']}&cf_ch_verify=${this.finalPayload['cf_ch_verify']}`;

//         let options: any = {
//             method: 'POST',
//             url: this.hawkPart1['result_url'],
//             headers: {
//                 Host: this.host,
//                 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.125 Safari/537.36',
//                 Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
//                 'Accept-Language': 'en-US,en;q=0.5',
//                 'Accept-Encoding': 'gzip, deflate, br',
//                 'Content-Type': 'application/x-www-form-urlencoded',
//                 Origin: `https://${this.host}`,
//                 Connection: 'keep-alive',
//                 Referer: `https://${this.host}/`,
//                 'Upgrade-Insecure-Requests': '1',
//                 // 'cache-control': '	max-age=0',
//                 'sec-ch-ua-mobile': '?0',
//                 'sec-fetch-site': 'same-origin',
//                 'sec-fetch-mode': 'navigate',
//                 'sec-fetch-dest': 'document',
//                 pragma: 'no-cache',
//                 'cache-control': 'no-cache',
//                 'content-length': form.length,
//             },
//             jar: this.jar,
//             body: form,
//         };

//         if (this.proxy) {
//             options.proxy = this.proxy;
//         }

//         let response = await request(options);

//         if (response.statusCode === 302) {
//             options = {
//                 method: 'GET',
//                 url: `https://${this.host}` + response.headers['location'],
//                 headers: {
//                     Host: this.host,
//                     'User-Agent':
//                         'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.125 Safari/537.36',
//                     Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
//                     'Accept-Language': 'en-US,en;q=0.5',
//                     'Accept-Encoding': 'deflate',
//                     Connection: 'keep-alive',
//                     'Upgrade-Insecure-Requests': '1',
//                 },
//                 jar: this.jar,
//             };

//             if (this.proxy) {
//                 options.proxy = this.proxy;
//             }

//             response = await request(options);
//         }

//         return response;
//     }

//     async callToHawkAPIPart1() {
//         const payload = {
//             body: Buffer.from(this.originalResponse.body).toString('base64'),
//             url: this.urlPart,
//             domain: this.host,
//             captcha: this.isCaptcha,
//             key: this.keyStrUriSafe,
//         };

//         const options: any = {
//             method: 'POST',
//             url: 'https://cf-v2.hwkapi.com/cf-a/ov1/p1',
//             body: JSON.stringify(payload),
//             headers: {
//                 'content-type': 'application/json',
//             },
//             qs: auth,
//         };

//         if (this.proxy) {
//             options.proxy = this.proxy;
//         }

//         const response = await request(options);

//         this.hawkPart1 = JSON.parse(response.body);

//         return await this.callToCloudflareAPI(this.hawkPart1['result']);
//     }

//     async callToHawkAPIPart2() {
//         const payload: any = {
//             body_home: Buffer.from(this.originalResponse.body).toString('base64'),
//             body_sensor: Buffer.from(this.challengeResponse.body).toString('base64'),
//             result: this.hawkPart1['baseobj'],
//             ts: this.hawkPart1['ts'],
//             url: this.hawkPart1['url'],
//         };

//         if (isRerun) {
//             payload.rerun = true;
//             payload.rerun_base = this.hawkPart1['result'];
//         }

//         const options: any = {
//             method: 'POST',
//             url: 'https://cf-v2.hwkapi.com/cf-a/ov1/p2',
//             body: JSON.stringify(payload),
//             headers: {
//                 'content-type': 'application/json',
//             },
//             qs: auth,
//         };

//         if (this.proxy) {
//             options.proxy = this.proxy;
//         }

//         const response = await request(options);

//         if (response.body !== 'error') {
//             this.hawkPart2 = JSON.parse(response.body);
//         } else {
//             throw new Error('Cloudflare API Error');
//         }

//         return await this.callToCloudflareAPI(this.hawkPart2['result']);
//     }

//     async callToHawkAPIPart3() {
//         const payload = {
//             body_sensor: Buffer.from(this.challengeResponse.body).toString('base64'),
//             result: this.hawkPart1['baseobj'],
//         };

//         const options: any = {
//             method: 'POST',
//             url: 'https://cf-v2.hwkapi.com/cf-a/ov1/p3',
//             body: JSON.stringify(payload),
//             headers: {
//                 'content-type': 'application/json',
//             },
//             qs: auth,
//         };

//         if (this.proxy) {
//             options.proxy = this.proxy;
//         }

//         const response = await request(options);

//         if (response.body !== 'error') {
//             this.hawkPart3 = JSON.parse(response.body);
//         } else {
//             throw new Error('Cloudflare API Error');
//         }

//         if (this.hawkPart3['status'] === 'ok' && this.hawkPart3['captcha'] === false) {
//             this.finalPayload = {
//                 r: this.hawkPart1['r'],
//                 jschl_vc: this.hawkPart3['jschl_vc'],
//                 pass: this.hawkPart1['pass'],
//                 jschl_answer: this.hawkPart3['jschl_answer'],
//                 cf_ch_verify: 'plat',
//             };
//         } else if (this.hawkPart3['status'] == 'rerun') {
//             isRerun = true;
//             await this.callToHawkAPIPart2();
//             await this.callToHawkAPIPart3();
//         } else if (this.hawkPart3['captcha'] == true) {
//             await this.callToHawkApiCaptchaPart1();
//             await this.callToHawkApiCaptchaPart2();
//         }
//     }

//     async callToHawkApiCaptchaPart1() {
//         let token = 'click';

//         if (!this.hawkPart3['click']) {
//             token = await this.hCaptchaSolver(this.url);
//         }

//         const payload = {
//             result: this.hawkPart2['result'],
//             token: token,
//             data: this.hawkPart3['result'],
//         };

//         const options: any = {
//             method: 'POST',
//             url: 'https://cf-v2.hwkapi.com/cf-a/ov1/cap1',
//             body: JSON.stringify(payload),
//             headers: {
//                 'content-type': 'application/json',
//             },
//             qs: auth,
//         };

//         if (this.proxy) {
//             options.proxy = this.proxy;
//         }

//         const response = await request(options);

//         this.hawkCaptchaPart1 = JSON.parse(response.body);

//         await this.callToCloudflareAPI(this.hawkCaptchaPart1['result']);
//     }

//     async callToHawkApiCaptchaPart2() {
//         const payload = {
//             body_sensor: Buffer.from(this.challengeResponse.body).toString('base64'),
//             result: this.hawkPart1['baseobj'],
//         };

//         const options: any = {
//             method: 'POST',
//             url: 'https://cf-v2.hwkapi.com/cf-a/ov1/cap2',
//             body: JSON.stringify(payload),
//             headers: {
//                 'content-type': 'application/json',
//             },
//             qs: auth,
//         };

//         if (this.proxy) {
//             options.proxy = this.proxy;
//         }

//         const response = await request(options);

//         this.captchaResponse = response.body;

//         if (this.captchaResponse['valid']) {
//             this.finalPayload = {
//                 r: this.hawkPart1['r'],
//                 cf_captcha_kind: 'h',
//                 vc: this.hawkPart1['pass'],
//                 captcha_vc: this.captchaResponse['jschl_vc'],
//                 captcha_answer: this.captchaResponse['jschl_answer'],
//                 cf_ch_verify: 'plat',
//                 'h-captcha-response': 'captchka',
//             };
//         }
//     }
// }
