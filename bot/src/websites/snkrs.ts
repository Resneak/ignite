import { randomNumber, sleep } from '../../../lib/helpers';
import { TaskEvent, TaskStatusColor } from '../../../lib/models/taskUpdate';
import BotTask, { BotTaskProperties } from '../models/tasks/botTask';
import { CaptchaTask, CaptchaType } from '../models/captchaSolvers/captchaSolver';
import TwoCaptcha from '../models/captchaSolvers/twoCaptcha';
import { RetryExecutor, StopTask } from '../../../lib/errors';
import got, { Options } from 'got';
import fs from 'fs';
import { request, CookieJar } from '../../../http-client';
const ChromeLauncher = require('chrome-launcher');
const puppeteer = require('puppeteer-core');
import request1 from 'request-promise-native';
const util = require('util')
import { anonymizeProxy } from 'proxy-chain';
import Size from '../../../lib/models/size';
import { Cookie } from 'tough-cookie';
import pw from './pw';

export default class Snkrs extends BotTask {
    protected *execute() {
        // yield this.starting();

        this.selectedDevice = this.devices[randomNumber(0,this.devices.length-1)];
        let sizeArr = [
            new Size('3', 'US 3'),
            new Size('3.5', 'US 3.5'),
            new Size('4', 'US 4'),
            new Size('4.5', 'US 4.5'),
            new Size('5', 'US 5'),
            new Size('5.5', 'US 5.5'),
            new Size('6', 'US 6'),
            new Size('6.5', 'US 6.5'),
            new Size('7', 'US 7'),
            new Size('7.5', 'US 7.5'),
            new Size('8', 'US 8'),
            new Size('8.5', 'US 8.5'),
            new Size('9', 'US 9'),
            new Size('9.5', 'US 9.5'),
            new Size('10', 'US 10'),
            new Size('10.5', 'US 10.5'),
            new Size('11', 'US 11'),
            new Size('11.5', 'US 11.5'),
            new Size('12', 'US 12'),
            new Size('12.5', 'US 12.5'),
            new Size('13', 'US 13'),
            new Size('13.5', 'US 13.5'),
            new Size('14', 'US 14'),
            new Size('14.5', 'US 14.5'),
            new Size('15', 'US 15'),
            new Size('16', 'US 16'),
            new Size('17', 'US 17'),
        ];

        this.task.sizes.setAvailableSizes(sizeArr);
        this.currentSize = this.task.sizes.getNextSize();
        if (!this.currentSize) return this.updateStatus('No matching sizes found', TaskStatusColor.Warning);

        yield this.launchBrowsers();
       
    }

    private userAgent!: string;
    private currentAbck!: string;
    private sensorData!: string;

    private page: any;

    private currentSize!: any;
    private selectedDevice: any;

    private allUserAgents: Array<string> = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.106 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0",
        "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; rv:78.0) Gecko/20100101 Firefox/78.0",
        "Mozilla/5.0 (X11; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.106 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36 Edg/91.0.864.54",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.64",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.67",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36 Edg/91.0.864.59",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0",
        "Mozilla/5.0 (X11; Linux x86_64; rv:78.0) Gecko/20100101 Firefox/78.0",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.164 Safari/537.36",
        "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.101 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64; rv:90.0) Gecko/20100101 Firefox/90.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:78.0) Gecko/20100101 Firefox/78.0",
        "Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:90.0) Gecko/20100101 Firefox/90.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Safari/605.1.15",
        "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
        "Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
        "Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.101 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.101 Safari/537.36 OPR/77.0.4054.90",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.70",
        "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
        "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:90.0) Gecko/20100101 Firefox/90.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.164 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.100 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.106 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:89.0) Gecko/20100101 Firefox/89.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.101 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 OPR/77.0.4054.203",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:88.0) Gecko/20100101 Firefox/88.0",
        "Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.101 Safari/537.36 Edg/91.0.864.48",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36 OPR/77.0.4054.172",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13; rv:89.0) Gecko/20100101 Firefox/89.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.2 Safari/605.1.15",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15",
        "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Mozilla/5.0 (Windows NT 6.3; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
        "Mozilla/5.0 (X11; Linux x86_64; rv:88.0) Gecko/20100101 Firefox/88.0"
    ]

    private lag: number;
    private tries = 0;
    private monitorTries = 0;
    constructor(botTaskProps: BotTaskProperties) {
        super(botTaskProps);
        this.lag = parseInt(botTaskProps.profile.id, 10) * 1000;
    }


    private async starting() {
        this.updateStatus('Starting', TaskStatusColor.Neutral);
        await sleep(1000 + this.lag);
    }


    private async launchBrowsers() {    
        let cookies;    
        const browser1 = await this.launchChrome();

        console.log(`browser1 port: ${browser1.port}`);
        let port = browser1.port

        const resp = await util.promisify(request1)(`http://localhost:${port}/json/version`);
        const {webSocketDebuggerUrl} = JSON.parse(resp.body);

        const browser = await puppeteer.connect({
            browserWSEndpoint: webSocketDebuggerUrl,
            
            // defaultViewport: null
        });
        this.page = await browser.newPage();
        await this.page.setViewport({ width: parseInt(this.selectedDevice.data.innerWidth), height: parseInt(this.selectedDevice.data.innerHeight) })
        // await this.page.setViewport({ width: 800, height: 960 })

        // Set global timeout to 0 (unlimited)
        await this.page.setDefaultNavigationTimeout(0);

        // this.userAgent = this.allUserAgents[randomNumber(0, this.allUserAgents.length-1)];
        // this.userAgent = this.selectedDevice.data.userAgent;
        // this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36';
        this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_3_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Safari/537.36'

        console.log(this.userAgent)

        await this.handleAkamai();
        await this.page.setUserAgent(this.userAgent)
        await this.page.setCookie({
            'name': '_abck',
            'value': `E87E73E772FDEB9C3ACE41ECEC8936AB~-1~YAAQnwUPFym+2LB6AQAAAXxvHgYns20K/wgwdAGWZwwXgaq5Y9aeZC9dTv2GTtrGp0K5dzW2W6bKa3hPL5cGU271lDqWj1wvY7yMJxSst/bl+nycK29LEqtaBaH/VEA6A5BlBjkfQBCvHOlQB/SNiqV4cvhfYQJ6jeWdV/q2stKcbN/Lo+b+XbdRAsWi9dIN1GGYRgWXF4g3iisKmWEuezJhw6NLxv/oylALzozMPQx5dPm9EW3I+YZgY+0pV5CNYkTD6xpfBiwj+wJysi3vE3MCmrgbYvMNeLLgALSyZFo0PorKRUxtXfBVF+Txj+mllBxt0J8FI2Y1V6hjY5QKK3FlXvqk2rcVG3TQrlmbZ+E7dh3tIu1rw+JXdLmF6D8OhgibZyzK8Jdm3e3NoEAnY7qfYKk9bY5tsVHSwZYZi3Nb8UfIZUAU/p2xLtYHSLf0saroVsarnMG4QMoU/3F1sJdJ+w+6jlg5edHSNOvMYS1mCHu2bsoR8NP8S0A=~-1~-1~-1`,
            'domain': '.nike.com'
        });

        await this.page.goto('https://www.nike.com/login', { waitUntil: 'networkidle2' })
        // await sleep(3500)
        // // Click menu button
        //     try {
        //         await this.page.waitForSelector("button[data-qa='mobile-nav-menu-button']");
        //         await this.page.click("button[data-qa='mobile-nav-menu-button']");
        //         break;
        //     } catch(e) {
        //         await sleep(this.retryDelay)
        //         continue loop;
        //     }
        // }
        // await sleep(randomNumber(1000,3000));


        // // Click login prompt button
        // loop: while (!this.shouldStopTask) {
        //     try {
        //         await this.page.evaluate(() => {
        //             (<HTMLElement>document.querySelector("button[data-qa='join-login-button']")).click();
        //             // (<HTMLElement>document.querySelector('button[data-qa="top-nav-join-or-login-button"]')).click();
        //         });
        //         break;
        //     } catch(e) {
                
        //     }
        // }
        // await sleep(randomNumber(1000,3000));


        // Enter email address
        loop: while (!this.shouldStopTask) {
            try {
                await this.page.waitForSelector("input[data-componentname='emailAddress']");
                await this.page.type("input[data-componentname='emailAddress']", 'thecanoechief@gmail.com', { delay: 50 });
                break;
            } catch(e) {
                await sleep(this.retryDelay)
                continue loop;
            }
        }
        await sleep(randomNumber(250,1000));


        // Enter password
        loop: while (!this.shouldStopTask) {
            try {
                await this.page.waitForSelector("input[data-componentname='password']");
                await this.page.type("input[data-componentname='password']", pw, { delay: 50 });
                break;
            } catch(e) {
                await sleep(this.retryDelay)
                continue loop;
            }
        }
        await sleep(randomNumber(250,1000));

        // Click sign in button
        loop: while (!this.shouldStopTask) {
            try {
                await this.page.evaluate(() => {
                    (<HTMLElement>document.querySelector("input[value='SIGN IN']")).click();
                });
                break;
            } catch(e) {
                await sleep(this.retryDelay)
                continue loop;
            }
        }

        await sleep(7000)
















        // ########### THIS IS FOR SAVING PAYMENT METHODS TO AN ACCOUNT ###########
        // Set payment
        await this.page.goto('https://www.nike.com/member/settings/payment-methods', { waitUntil: 'networkidle2' })

        loop: while (!this.shouldStopTask) {
            try {

                // Click payment methods button
                await this.page.waitForSelector('div[aria-label=" Payment Methods"]');
                await this.page.evaluate(() => {
                    (<HTMLElement>document.querySelector('div[aria-label=" Payment Methods"]')).click();
                });
                await sleep(randomNumber(250,1000));

                // Click add payment method button
                await this.page.evaluate(() => {
                    let addPaymentButton;
                    document.querySelectorAll("button").forEach(element => {
                        if (element?.textContent?.includes("Add Payment Method")) {
                            addPaymentButton = element;
                        }
                    });
                    addPaymentButton.click()
                });


                // Enter card number
                await this.page.evaluate((cardNumber) => {
                    // (document.querySelector("input[id='creditCardNumber']")).value = cardNumber;
                }, this.profile.payment.number);
                await sleep(randomNumber(250,1000));

                // Enter expiration date
                await this.page.evaluate((expirationDate) => {
                    // (document.querySelector("input[id='expirationDate']")).value = expirationDate;
                }, `${this.profile.payment.month}/${this.profile.payment.year}`);
                await sleep(randomNumber(250,1000));

                // Enter CVV
                await this.page.evaluate((cvNumber) => {
                    // (document.querySelector("input[id='cvNumber']")).value = cvNumber;
                }, this.profile.payment.code);
                await sleep(randomNumber(250,1000));

                // Click same billing/shipping button
                await this.page.waitForSelector('input[name="billingAddress.sameAsDefaultShipping"]');
                await this.page.evaluate(() => {
                    (<HTMLElement>document.querySelector('input[name="billingAddress.sameAsDefaultShipping"]')).scrollIntoView();
                    (<HTMLElement>document.querySelector('input[name="billingAddress.sameAsDefaultShipping"]')).click();
                });

                // Click preferred button
                await this.page.waitForSelector('input[name="preferred"]');
                await this.page.evaluate(() => {
                    (<HTMLElement>document.querySelector('input[name="preferred"]')).scrollIntoView();
                    (<HTMLElement>document.querySelector('input[name="preferred"]')).click();
                });
                await sleep(randomNumber(250,1000));

                // Click save button
                await this.page.waitForSelector("button[type='button']");
                await this.page.evaluate(() => {
                    (<HTMLElement>document.querySelector("button[type='button']")).click();
                });

                await sleep(randomNumber(250,1000));

                let fullSource = this.page.content();
                if (fullSource.includes("Payment is not allowed")) {
                    break;
                } else {
                    // User takeover required
                }
            } catch(e) {
                console.log(e)
                await sleep(this.retryDelay)
                continue loop;
            }
        }







        // ########### THIS IS FOR ENTERING THE DRAW ###########
        // Start preload
        await this.page.goto(`https://www.nike.com/launch/t/sb-parra-dunk-low-pro-abstract-art?size=${this.currentSize?.value}&productId=${this.task.product?.id}`, { waitUntil: 'networkidle2' })

        // Click close button for draw popup
        loop: while (!this.shouldStopTask) {
            try {
                await this.page.waitForSelector("a[class='ncss-btn-primary-dark cta-btn btn-lg']");
                await this.page.evaluate(() => {
                    (<HTMLElement>document.querySelector("a[class='ncss-btn-primary-dark cta-btn btn-lg']")).scrollIntoView();
                    (<HTMLElement>document.querySelector("a[class='ncss-btn-primary-dark cta-btn btn-lg']")).click();
                });
                break;
            } catch(e) {
                // console.log(e)
                await sleep(this.retryDelay)
                continue loop;
            }
        }
        await sleep(randomNumber(250,1000));

        // Reload page to load preload form
        await this.page.goto(`https://www.nike.com/launch/t/sb-parra-dunk-low-pro-abstract-art?size=${this.currentSize?.value}&productId=${this.task.product?.id}`, { waitUntil: 'networkidle2' })

        // Payment card
        loop: while (!this.shouldStopTask) {
            try {
                // Click new card button
                await this.page.waitForSelector("button[name='newCard']");
                await this.page.evaluate(() => {
                    (<HTMLElement>document.querySelector("button[name='newCard']")).click();
                });
                await sleep(randomNumber(250,1000));

                // Enter card number
                await this.page.waitForSelector("input[id='creditCardNumber']");
                await this.page.type("input[id='creditCardNumber']", this.profile.payment.number, { delay: 50 });
                await sleep(randomNumber(250,1000));

                // Enter expiration date
                await this.page.waitForSelector("input[id='expirationDate']");
                await this.page.type("input[id='expirationDate']", `${this.profile.payment.month}/${this.profile.payment.year}`, { delay: 50 });
                await sleep(randomNumber(250,1000));

                // Enter CVV
                await this.page.waitForSelector("input[id='cvNumber']");
                await this.page.type("input[id='cvNumber']", this.profile.payment.code, { delay: 50 });
                await sleep(randomNumber(250,1000));

                // Click save button
                await this.page.waitForSelector("button[data-qa='save-button']");
                await this.page.evaluate(() => {
                    (<HTMLElement>document.querySelector("button[data-qa='save-button']")).scrollIntoView();
                    (<HTMLElement>document.querySelector("button[data-qa='save-button']")).click();
                });
                await sleep(randomNumber(250,1000));


                let fullSource = this.page.content();
                if (fullSource.includes("Payment is not allowed")) {
                    break;
                } else {
                    // User takeover required
                }
            } catch(e) {
                await sleep(this.retryDelay)
                continue loop;
            }
        }

        // Click card to prompt cvv field
        loop: while (!this.shouldStopTask) {
            try {
                await this.page.waitForSelector('span[data-qa="payment-text"]');
                await this.page.evaluate(() => {
                    (<HTMLElement>document.querySelector('span[data-qa="payment-text"]')).scrollIntoView();
                    (<HTMLElement>document.querySelector('span[data-qa="payment-text"]')).click();
                });
                break;
            } catch(e) {
                // console.log(e)
                await sleep(this.retryDelay)
                continue loop;
            }
        }
        await sleep(randomNumber(250,1000));
        
        // Enter CVV
        loop: while (!this.shouldStopTask) {
            try {
                await this.page.waitForSelector("input[id='cvNumber']");
                await this.page.type("input[id='cvNumber']", this.profile.payment.code, { delay: 50 });
                break;
            } catch(e) {
                // console.log(e)
                await sleep(this.retryDelay)
                continue loop;
            }
        }
        await sleep(randomNumber(250,1000));
        
        
        // Click save and continue
        loop: while (!this.shouldStopTask) {
            try {
                await this.page.evaluate(() => {
                    (<HTMLElement>document.querySelector("button[data-qa='save-button']")).click();
                });
                break;
            } catch(e) {
                await sleep(this.retryDelay)
                continue loop;
            }
        }
        await sleep(randomNumber(1000,3000));


        

        
    }





    private async launchChrome() {
        let newProxy;
        if (this.proxy) {
            newProxy = await anonymizeProxy(`http://${this.proxy?.username}:${this.proxy?.password}@${this.proxy?.ip}:${this.proxy?.port}`);
        } else {
            newProxy = '';
        }
        return ChromeLauncher.launch({
            // autoSelectChrome: true,
            chromeFlags: [
            // `--window-size=800,680`,
            `--window-size=${this.selectedDevice.data.outerWidth},${this.selectedDevice.data.outerHeight}`,
            "--start-maximized",
            "--acceptInsecureCerts",
            "--disable-blink-features=AutomationControlled",
            `--proxy-server=${newProxy}`,
            // '--auto-open-devtools-for-tabs'
            // "--ignore-certificate-errors",
            // "--allow-running-insecure-content",
            // "--disable-web-security",
            // '--profile-directory=Profile 1'
            ],
            // logLevel: 'verbose',

            // startingUrl: 'https://www.nike.com/launch'
        });
    }


    








    private async handleAkamai() {
        this.setStatus(`Generating akamai ...`);
        await this.getInvalidAbck();
        await this.solveAkamai();
        this.setStatus('Generated akamai', TaskStatusColor.Info);
        return;
    }

    private async solveAkamai() {
        loop: while (!this.shouldStopTask) {
            await this.getSensor();
            await this.postSensor();
            if (this.currentAbck?.includes('||') && !this.currentAbck.includes("||-1||")) {
                continue loop;
            }
            return;
        }
    }


    private async getUa() {
        loop: while (!this.shouldStopTask) {
            try {
                let { body } = await request({
                    url: `https://ak01-eu.hwkapi.com/akamai/ua`,
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Api-Key': '022921a2-ae7a-11eb-8529-0242ac130003',
                        'X-Sec': 'high',
                    },
                    proxy: this.proxy?.getUrl(),
                    jar: this.cookieJar,
                });
                this.userAgent = body;
                return;
            } catch (e) {
                this.updateStatus(`Unknown Error - get ua`);
                continue loop;
            }
        }
        
    }

    private async getInvalidAbck() {
        loop: while (!this.shouldStopTask) {
            let response;
            try {
                response = await request({
                    url: `https://www.nike.com/2ZCp/UNIC/z5/t08T/55JQ/haQiStwkDi/SB5AegE/YW/Z7VxtIUSk`,
                    method: 'GET',
                    headers: {
                        authority: 'www.nike.com',
                        'x-sec-clge-req-type': 'ajax',
                        'sec-ch-ua-mobile': '?0',
                        'user-agent': this.userAgent,
                        'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
                        'content-type': 'text/plain;charset=UTF-8',
                        accept: '*/*',
                        origin: 'https://www.nike.com',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        referer: 'https://www.nike.com/',
                        'accept-language': 'en-US,en;q=0.9',
                    },
                    proxy: this.proxy?.getUrl(),
                    jar: this.cookieJar,
                });
            } catch (e) {
                this.updateStatus(`Unknown Error - get invalid abck`);
                continue loop;
            }
    
            if (response.statusCode === 200) {
                let responseCookies = response?.headers?.['set-cookie'] || [];
                    responseCookies.forEach((cookie) => {
                        if (cookie.includes('_abck=')) {
                            this.currentAbck = cookie.split('_abck=')[1].split(';')[0];
                        }
                    });
                return;
            } else {
                this.updateStatus(`Error getting invalid abck...`);
                continue loop;
            }
        }
    }

    private async getSensor() {
        loop: while (!this.shouldStopTask) {
            let response;
            try {
                response = await request({
                    url: `https://ak01-eu.hwkapi.com/akamai/generate?user_agent=${this.userAgent}`,
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        // 'Accept-Encoding': 'gzip, deflate',
                        'X-Api-Key': '022921a2-ae7a-11eb-8529-0242ac130003',
                        'X-Sec': 'high',
                    },
                    proxy: this.proxy?.getUrl(),
                    jar: this.cookieJar,
                    body: JSON.stringify({
                        site: 'www.nike.com',
                        abck: this.currentAbck,
                        type: 'sensor',
                        events: '1,1',
                    })
                });
            } catch (e) {
                this.updateStatus(`Unknown Error - get sensor data`);
                continue loop;
            }
    
            if (response.statusCode === 200) {
                this.sensorData = response.body.split('*')[0];
                return;
            } else {
                this.updateStatus(`Error getting sensor data...`);
                continue loop;
            }
        }
        
    }

    private async postSensor() {
        loop: while (!this.shouldStopTask) {
            let response;
            try {
                response = await request({
                    url: `https://www.nike.com/2ZCp/UNIC/z5/t08T/55JQ/haQiStwkDi/SB5AegE/YW/Z7VxtIUSk`,
                    method: 'POST',
                    headers: {
                        authority: 'www.nike.com',
                        'x-sec-clge-req-type': 'ajax',
                        'sec-ch-ua-mobile': '?0',
                        'user-agent': this.userAgent,
                        'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
                        'content-type': 'text/plain;charset=UTF-8',
                        accept: '*/*',
                        origin: 'https://www.nike.com',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        referer: 'https://www.nike.com/',
                        'accept-language': 'en-US,en;q=0.9',
                    },
                    proxy: this.proxy?.getUrl(),
                    jar: this.cookieJar,
                    body: JSON.stringify({
                        sensor_data: this.sensorData,
                    })
                });
            } catch (e) {
                this.updateStatus(`Unknown Error - post sensor data`);
                continue loop;
            }
    
            if (response.statusCode === 201) {
                let responseCookies = response?.headers?.['set-cookie'] || [];
                    responseCookies.forEach((cookie) => {
                        if (cookie.includes('_abck=')) {
                            this.currentAbck = cookie.split('_abck=')[1].split(';')[0];
                        }
                    });
                return;
            } else {
                this.updateStatus(`Error posting sensor data...`);
                continue loop;
            }
        }
    }


}
