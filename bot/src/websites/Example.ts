import { sleep } from '../../../lib/helpers';
import { TaskEvent, TaskStatusColor } from '../../../lib/models/taskUpdate';
import BotTask, { BotTaskProperties } from '../models/tasks/botTask';
import { CaptchaTask, CaptchaType } from '../models/captchaSolvers/captchaSolver';
import TwoCaptcha from '../models/captchaSolvers/twoCaptcha';
import { RetryExecutor, StopTask } from '../../../lib/errors';

export default class Example extends BotTask {
    protected *execute() {
        yield this.starting();

        // you must yield this or execution will continue to the next function before the task is paused
        yield this.setWatchdog();
        yield this.carted();

        yield this.throwStop();
    }
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

    /**
     *
     * monitor must be a while loop (retry executors will cause the script to pause)
     */
    protected async monitor() {
        while (!this.shouldStopTask) {
            await sleep(1000 + this.lag);
            if (++this.monitorTries % 10 !== 0) {
                this.updateStatus('OOS - monitor', TaskStatusColor.Warning);
                continue;
            }
            this.setStatus('In Stock', TaskStatusColor.Neutral, TaskEvent.InStock);
            return;
        }
    }

    private async inStock() {
        await sleep(3000 + this.lag);
        this.setStatus('In Stock', undefined, TaskEvent.InStock);
    }

    private async carted() {
        await sleep(3000 + this.lag);
        if (++this.tries < 5) throw new RetryExecutor(this.carted.bind(this), 'OOS - cart');
        this.setStatus('Carted', TaskStatusColor.Cart, TaskEvent.Carted);
    }

    private async checkout() {
        if (++this.tries < 10) throw new RetryExecutor(this.checkout.bind(this), 'OOS');
        this.setStatus('Checked out', TaskStatusColor.Success, TaskEvent.CheckoutSuccess);
    }

    private async throwStop() {
        throw new StopTask('STOPPING');
    }

    private async hcaptchaTest(url: string) {
        this.rotateProxy();
        try {
            // const url = 'https://www.tokyobitcoiner.com/hcaptcha';

            // const response = await this.httpClient.get(url);

            // this.updateStatus(response.statusCode);

            const siteKey = '37f92ac1-4956-457e-83cd-723423af613f';
            const captchaTask: CaptchaTask = {
                taskID: 'asd',
                type: CaptchaType.HCaptcha,
                URL: url,
                siteKey,
                proxy: this.proxy,
            };
            const hcaptchaToken = (await this.solveCaptchaTask(captchaTask)) as string;
            this.updateStatus(hcaptchaToken);
            return hcaptchaToken;
            // this.completeTask();
        } catch (e) {
            this.updateStatus(`Error ${e}`);
        }
        return 'ERROR';
    }

    private async twoCaptchaTest() {
        this.updateStatus(`Solving captcha using 2 captcha...`, TaskStatusColor.Info);
        const solver = new TwoCaptcha('9dcbe46e93f0c0a847cb6a49d1e25d02');

        const captchaTask: CaptchaTask = {
            taskID: 'test',
            type: CaptchaType.RecaptchaV2,
            URL: 'https://patrickhlauke.github.io/recaptcha/',
            siteKey: '6Ld2sf4SAAAAAKSgzs0Q13IZhY02Pyo31S2jgOB5',
            minScore: 0.7,
        };
        try {
            const token = await solver.solve(captchaTask);
            this.updateStatus(`Solved captcha using 2cap. Token ${token}`), TaskStatusColor.Success;
        } catch (e) {
            this.updateStatus(`Failed to solve captcha using 2cap. ${e}`, TaskStatusColor.Error);
        }
    }

    private async testHawk() {
        // const solver = new HawkCloudflare({
        //     // url: 'https://soap2day.to',
        //     url: 'https://pacsun.com/on/demandware.store/Sites-pacsun-Site/default/Product-Variation?pid=0172517080008&dwvar_0172517080008_size=9600&dwvar_0172517080008_color=067&source=detail&uuid=',
        //     // proxy: new Proxy('127.0.0.1:8080'),
        //     proxy: undefined,
        //     jar: CookieJar,
        //     hCaptchaSolver: this.hcaptchaTest,
        // });
        // this.updateStatus(await (await solver.solve()).body);
    }
}
