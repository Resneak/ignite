import Profile from '../../lib/models/profile';
import UI from './ui';
import Discordwebhook from './services/discord';
import Task from '../../lib/models/task';
import Logger from './utils/logger';
import Proxies from '../../lib/models/proxyGroupCollection';
import './utils/onUnhandled';
import Storage from './utils/storage';
import { AppData, Asset, User } from './data/files';
import { forEachLine, isComment, isDev, newlineRegex } from './utils/general';
import { sleep } from '../../lib/helpers';
import TaskManager from '../../bot/src';
import TaskUpdate, { TaskEvent, TaskStatusColor } from '../../lib/models/taskUpdate';
import UserAccount from '../../lib/models/user';
import Sizes from '../../lib/models/sizes';
import Product from '../../lib/models/product';
import { getWebsiteByName } from '../../bot/src/websites';
import { CaptchaSolverProps, CaptchaSolverType } from '../../bot/src/models/captchaSolvers/captchaSolver';
import SiteAccount, { SiteAccountProps } from '../../lib/models/siteAccount';
const sound = require('sound-play');
const csv = require('csv-parser')
import fs from 'fs';
import KeyBindings from './utils/keyBindings';

interface TaskWrapper {
    task: Task;
    number: number;
}

type UserInputError = { lineNumber: number | string; errors: string };

type Sitename = string;
type ProfileID = string;
type TaskID = string;
export default class Main {
    public ui!: UI;
    private accounts: Map<Sitename, SiteAccountProps[]>;

    private profiles: Map<ProfileID, Profile>;

    private tasks: Map<TaskID, TaskWrapper>;

    private proxies: Proxies;

    public devices: Array<Object> = [];

    public carted: number = 0;

    public checkouts: number = 0;

    public declines: number = 0;

    public webhooksQueued: number = 0;

    private webhook?: string;

    public twoCaptchaKey?: string;

    private taskManager!: TaskManager;

    private user?: UserAccount;

    private captchaSolverProps?: CaptchaSolverProps[];

    private profilesWithErrors: UserInputError[] = [];
    private accountsWithErrors: UserInputError[] = [];
    private tasksWithErrors: UserInputError[] = [];

    private static instance: Main;
    public static getInstance(user?: UserAccount): Promise<Main> {
        return new Promise((resolve) => {
            if (this.instance === undefined) {
                this.instance = new this(user);

                // we cannot initialize UI before Main has been initialized or main will be initalized twice
                this.instance.ui = UI.getInstance();
                this.instance.registerListeners();
                this.instance.importCaptchaSolvers().then((captchaSolverProps) => {
                    this.instance.captchaSolverProps = captchaSolverProps;
                    this.instance.taskManager = TaskManager.getInstance(this.instance.captchaSolverProps || [], isDev(), user);
                    this.instance.taskManager.setCaptchaSolver(this.instance.captchaSolverProps?.[0]?.type);
                    this.instance.taskManager.registerUpdateListener(this.instance.onTaskUpdate.bind(this.instance));
                    // this.instance.taskManager.registerTasksCompleteListener(this.instance.onTasksComplete.bind(this.instance));
                    resolve(this.instance);
                });
            } else {
                resolve(this.instance);
            }
        });
    }

    private constructor(user?: UserAccount) {
        if (!user) throw new Error('User required');
        this.user = user;
        this.accounts = new Map();
        this.profiles = new Map();
        this.tasks = new Map();
        this.proxies = Proxies.getInstance();
        KeyBindings.register(this);
    }

    private registerListeners() {
        Discordwebhook.getInstance().registerQueueSizeListener((size: number) => {
            this.webhooksQueued = size;
            this.ui.renderTerminalTitle();
        });
    }

    public getProfile(id: string): Profile | undefined {
        return this.profiles.get(id);
    }

    public getNumProfiles() {
        return this.profiles.size;
    }

    public getNumberOfProfilesWithErrors() {
        return this.profilesWithErrors.length;
    }

    public getProfilesWithErrors() {
        return this.profilesWithErrors;
    }

    public getNumberOfAccountsWithErrors() {
        return this.accountsWithErrors.length;
    }

    public getAccountsWithErrors() {
        return this.accountsWithErrors;
    }

    public getNumberOfTasksWithErrors() {
        return this.tasksWithErrors.length;
    }

    public getTaskssWithErrors() {
        return this.tasksWithErrors;
    }

    public getNumAccounts() {
        let size = 0;
        for (const [site, accountList] of this.accounts) {
            size += accountList.length;
        }
        return size;
    }

    public setSolver(captchaSolverType: CaptchaSolverType) {
        this.taskManager.setCaptchaSolver(captchaSolverType);
    }

    /**
     *
     * @returns the number of tasks that a botTask has been created for
     */
    public getNumTasks() {
        return this.taskManager.getSize();
    }

    public getNumProxies() {
        return this.proxies.getSize();
    }

    public getWebhook() {
        return this.webhook;
    }

    public getCaptchaSolver() {
        return this.taskManager.getCaptchaSolver();
    }

    public getCaptchaSolvers() {
        return this.taskManager.getCaptchaSolvers();
    }

    public getIsWatchdogEnabled(): boolean {
        return this.taskManager.getIsWatchdogEnabled();
    }

    public setShouldWatchdogBeEnabled(shouldBeEnabled: boolean) {
        this.taskManager.setShouldWatchdogBeEnabled(shouldBeEnabled);
    }

    public onCarted() {
        this.incrementCarted();
    }

    public static playSound() {
        const file = Storage.getPath(Asset.CheckoutSound);
        try {
            sound.play(file);
        } catch (e) {
            console.log(e);
        }
    }

    public onCheckout(task: Task, profile: Profile, successful: boolean) {
        this.incrementCheckouts(successful);

        try {
            if (this.webhook) {
                Discordwebhook.getInstance().notifyCheckout({ task, profile, successful, url: this.webhook });
            }

            if (successful && !isDev()) {
                const globalWebhook =
                    'https://discord.com/api/webhooks/845404717856718849/5_FyT1oG_SSAda9jzBSY6NsR0SRZyMb88hipcZcLt07Gy7ggEyVwpgec6NzORW5ud1vK';

                try {
                    Discordwebhook.getInstance().notifyCheckout({ task, profile, successful, url: globalWebhook }, true);
                } catch (e) {}
            }
            if (successful) {
                Storage.logCheckout(task, profile).catch((e) => Logger.warn(e, true));
                Main.playSound();
            }
        } catch (e) {
            Logger.error(e);
        }
    }

    public async startTasks() {
        this.taskManager.startAll();
    }

    public stopAllTasks() {
        return this.taskManager.stopAll();
    }

    public async run() {
        if (!this.user) throw new Error('Invalid User');
        if (this.taskManager.getSize() === 0) {
            this.importData().then(() => {
                this.ui.start();
            });
        } else {
            this.ui.start();
        }
    }

    public onTaskUpdate(taskUpdate: TaskUpdate) {
        const taskWrapper = this.tasks.get(taskUpdate.id);
        if (!taskWrapper) return;
        const { task, number } = taskWrapper;
        const profile = this.profiles.get(taskWrapper.task?.profileId);
        let message = taskUpdate.message;
        switch (taskUpdate.event) {
            case TaskEvent.Carted:
                this.onCarted();
                break;
            case TaskEvent.CheckoutSuccess:
                task && profile && this.onCheckout(task, profile, true);
                break;
            case TaskEvent.CheckoutDecline:
                task && profile && this.onCheckout(task, profile, false);
                break;
            case TaskEvent.AccountCreated:
                const account = SiteAccount.parse(taskUpdate.message);
                message = `Account created!`;
                Storage.addAccount(account).catch((e) => {
                    this.ui.renderTaskUpdate({
                        taskNumber: number,
                        siteName: task.websiteName,
                        message: `Unable to save account Email Address: ${account.username} Password: ${account.password} to accounts.csv file`,
                        color: TaskStatusColor.Error,
                    });
                });
                this.incrementAccountsCreated();
                break;
        }
        this.ui.renderTaskUpdate({ taskNumber: number, siteName: task.websiteName, message, color: taskUpdate.color });
    }

    private importData() {
        this.resetLogs();
        const webhookImported = new Promise<void>((resolve) => {
            this.importWebhook().then((url) => {
                if (url) this.setWebhook(url);
                resolve();
            });
        });
        const proxiesImported = new Promise<void>((resolve) => {
            this.importProxies().then((proxies) => {
                this.setProxies(proxies);
                resolve();
            });
        });
        const accountsImported = new Promise<void>((resolve) => {
            this.importAccounts().then((accounts: SiteAccount[]) => {
                for (const account of accounts) {
                    const accountList = this.getAccountList(account.site);
                    accountList.push(account);
                }
                resolve();
            });
        });
        const profilesImported = this.importProfiles();
        const tasksImported = this.importTasks();
        const deviceDataImported = this.importDeviceData();

        return new Promise<void>((resolve) => {
            Promise.all([webhookImported, proxiesImported, accountsImported, profilesImported, tasksImported, deviceDataImported]).then(() => {
                    this.createBotTasks();
                resolve();
            });
        });
    }

    private incrementCarted() {
        this.carted += 1;
        this.ui.renderTerminalTitle();
    }

    public accountsCreated = 0;
    private incrementAccountsCreated() {
        this.accountsCreated += 1;
        this.ui.renderTerminalTitle();
    }

    private incrementCheckouts(successful: boolean) {
        if (successful) this.checkouts += 1;
        else this.declines += 1;
        this.ui.renderTerminalTitle();
    }

    private async onTasksComplete() {
        this.ui.onAllTasksComplete();
        await sleep(2000);
        this.run();
    }

    private setProxies(proxies: string[]) {
        this.proxies.getProxyGroup('1').setProxies(proxies);
    }

    private setWebhook(url: string | undefined) {
        this.webhook = url;
        Storage.writeToFile(AppData.Webhook, `${this.webhook}`);
    }

    /**
     * tests and sets the webhook
     * @param url
     * @returns
     */
    public async testWebhook(url: string) {
        try {
            let response = await Discordwebhook.getInstance().notifyTest(url);
            const webhook = response?.statusCode === 204 ? url : undefined;
            this.setWebhook(webhook);
        } catch (e) {}

        return !!this.webhook;
    }

    private async importProfiles() {
        return new Promise<void>((resolve) => {
            Storage.readFile(User.Profiles)
                .then((data) => {
                    let lineNumber = 0;
                    const addProfile = (line: string) => {
                        lineNumber += 1;
                        if (line !== '' && !isComment(line)) {
                            let profile;
                            profile = this.parseProfile(line);
                            try {
                                profile?.validate();
                                if (profile) this.profiles.set(profile.id, profile);
                            } catch (e) {
                                this.profilesWithErrors.push({ lineNumber, errors: e.message });
                                Logger.error(e);
                            }
                        }
                    };
                    forEachLine(data, addProfile);
                    resolve();
                })
                .catch((e) => {
                    Logger.error(e);
                    resolve();
                });
        });
    }

    private importCaptchaSolvers(): Promise<CaptchaSolverProps[]> {
        return new Promise<CaptchaSolverProps[]>((resolve) => {
            Storage.readFile(User.Settings)
                .then((data) => {
                    const [, twoCaptchaApiKeyLine, , , aycdApiKeyLine, aycdTokenLine, , , capMonsterApiKeyLine] = data.split(newlineRegex);
                    const keys = [twoCaptchaApiKeyLine, aycdApiKeyLine, capMonsterApiKeyLine].map((apiKeyLine) => {
                        const [, apiKey] = apiKeyLine.split('API KEY:');
                        const trimmed = apiKey?.trim();
                        return trimmed === '' || trimmed === undefined ? undefined : trimmed;
                    });

                    const tokenNotRequired = '';
                    const tokens = [tokenNotRequired, aycdTokenLine, tokenNotRequired].map((tokenLine) => {
                        const [, token] = tokenLine.split('TOKEN:');
                        return token?.trim();
                    });

                    const twoCaptcha = {
                        type: CaptchaSolverType.TwoCaptcha,
                        apiKey: keys[0],
                        token: undefined,
                        isValid: (props: CaptchaSolverProps) => {
                            return props.apiKey !== undefined && props.apiKey !== '';
                        },
                    };

                    const capMonster = {
                        type: CaptchaSolverType.CapMonster,
                        apiKey: keys[2],
                        token: undefined,
                        isValid: (props: CaptchaSolverProps) => {
                            return props.apiKey !== undefined && props.apiKey !== '';
                        },
                    };

                    const aycdAutosolve = {
                        type: CaptchaSolverType.AYCDAutosolve,
                        apiKey: keys[1],
                        token: tokens[1],
                        isValid: (props: CaptchaSolverProps) => {
                            return props.apiKey !== undefined && props.apiKey !== '' && props.token !== undefined && props.token !== '';
                        },
                    };

                    const captchaSolvers = [twoCaptcha, capMonster, aycdAutosolve]
                        .map(({ type, apiKey, token, isValid }) => {
                            if (isValid({ type, apiKey: apiKey || '', token: token || '' })) {
                                return {
                                    type,
                                    apiKey,
                                    token,
                                };
                            }
                            return undefined;
                        })
                        .filter((item) => item !== undefined) as CaptchaSolverProps[];
                    resolve(captchaSolvers);
                })
                .catch((e) => {
                    Logger.error(`Error importing settings: ${e}`);
                    resolve([]);
                });
        });
    }

    private resetLogs() {
        Storage.readFile(AppData.Logs)
            .then((logs) => {
                const date = new Date();
                const month = date.getUTCMonth();
                const day = date.getUTCDate();
                const lines = logs.split(newlineRegex);
                if (lines.length < 1) return;
                const firstLogDate = Logger.parseDate(lines[0]);
                if (!firstLogDate || firstLogDate.month !== month || firstLogDate.day !== day) {
                    try {
                        Storage.deleteFile(AppData.Logs);
                    } catch (e) {
                        Logger.log('Error deleteing logs');
                    }
                }
            })
            .catch(() => {
                Logger.log('Error deleting logs');
            });
    }

    private parseProfile(line: string) {
        const fields = line.split(',').map((prop: string) => prop.trim());
        const [
            profileName,
            firstName,
            lastName,
            email,
            phone,
            address,
            secondaryAddress,
            city,
            state,
            stateCode,
            zip,
            country,
            number,
            month,
            year,
            code,
            singleCheckout,
        ] = fields;

        return new Profile({
            id: profileName, //id is currently profile name
            profileName,
            singleCheckout: singleCheckout?.toLowerCase()?.trim() === 'true',
            name: `${firstName} ${lastName}`,
            shippingAddress: {
                firstName,
                lastName,
                email,
                phone,
                address,
                secondaryAddress,
                city,
                stateCode,
                state,
                zip,
                country,
            },
            payment: {
                number,
                code,
                month: parseInt(month, 10),
                year: parseInt(year, 10),
            },
        });
    }

    private importProxies() {
        return new Promise<string[]>((resolve) => {
            Storage.readFile(User.Proxies)
                .then((data) => {
                    const proxies: string[] = [];
                    const addProxy = (proxy: string) => {
                        if (proxy !== '' && !isComment(proxy)) {
                            proxies.push(proxy);
                        }
                    };
                    forEachLine(data, addProxy);

                    resolve(proxies);
                })
                .catch((e) => {
                    Logger.error(e);
                    resolve([]);
                });
        });
    }

    private importTasks() {
        return new Promise<void>((resolve) => {
            Storage.readFile(User.Tasks)
                .then((data) => {
                    let lineNumber = 0;
                    const addTask = (line: string) => {
                        lineNumber += 1;
                        if (line?.trim() !== '' && !isComment(line)) {
                            try {
                                const task = this.parseTask(line);
                                task.validate();
                                if (task) this.tasks.set(task.id, { task: task, number: this.tasks.size + 1 });
                            } catch (e) {
                                this.tasksWithErrors.push({ lineNumber, errors: e.message });
                            }
                        }
                    };
                    forEachLine(data, addTask);
                    resolve();
                })
                .catch((e) => {
                    Logger.error(e);
                    resolve();
                });
        });
    }

    private parseDevice(line: string, lineNumber: number) {
        let sizeObject = {
            deviceNumber: lineNumber,
            data: {
                userAgent: line['data.window.navigator.userAgent'],
                innerWidth: line['data.window.innerWidth'],
                innerHeight: line['data.window.innerHeight'],
                outerWidth: line['data.window.outerWidth'],
                outerHeight: line['data.window.innerHeight'],
                navigatorLanguage: line['data.navigator.language'],
                navigatorProduct: line['data.navigator.product'],
                webglRender: line['data.gpu.wr'],
                webglVendor: line['data.gpu.wv']
            }
        };
        return sizeObject;
    }

    private importDeviceData() {
        return new Promise<void>((resolve) => {
            let filePath = Storage.getPath(Asset.DeviceData);
            let lineNumber = 0;

            fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => {
                try {
                    lineNumber++
                    const deviceObject = this.parseDevice(data, lineNumber);
                    this.devices?.push(deviceObject);
                } catch (e) {
                    console.log(e)
                }
            })
            .on('end', () => {
                resolve();
            })
            .on('error', (e) => {
                Logger.error(e);
                resolve();
            });
        });
    }

    private parseTask(line: string) {
        const fields = line.split(',').map((prop: string) => prop.trim());
        let [store, mode, pid, sizeRange, delayStr, profileName, atcQuantity = '1'] = fields;
        let sizes = new Sizes(sizeRange, store);
        const product = new Product({ id: pid, maxPrice: Infinity });
        const delay = delayStr === '' ? 3000 : parseInt(delayStr, 10);
        const modes = getWebsiteByName(store)?.modes;
        if (modes?.length === 1) {
            mode = modes[0];
        } else {
            const possibleMode = modes?.find((siteMode) => siteMode.toLowerCase() === mode.toLocaleLowerCase());
            mode = possibleMode || '';
        }
        const task = new Task({
            profileId: profileName,
            proxyGroupId: '1',
            websiteName: store.toLowerCase(),
            mode,
            product,
            sizes,
            checkoutDelay: delay,
            atcQuantity: parseInt(atcQuantity, 10),
            captchaBypass: 'n/a',
            monitorDelay: delay,
            retryDelay: delay,
        });

        return task;
    }

    private getAccountList(site: string): SiteAccountProps[] {
        if (!this.accounts.has(site)) {
            this.accounts.set(site, []);
        }
        return this.accounts.get(site)!;
    }

    private importAccounts() {
        return new Promise<SiteAccount[]>((resolve) => {
            Storage.readFile(User.Accounts)
                .then((data) => {
                    let lineNumber = 0;
                    let accounts: SiteAccount[] = [];
                    const addAccount = (line: string) => {
                        lineNumber += 1;
                        if (line.trim() !== '' && !isComment(line)) {
                            const siteAccount = SiteAccount.parse(line);

                            try {
                                siteAccount.validate();
                                accounts.push(siteAccount);
                            } catch (e) {
                                this.accountsWithErrors.push({ lineNumber, errors: e.message });
                            }
                        }
                    };
                    forEachLine(data, addAccount);

                    resolve(accounts);
                })
                .catch((e) => {
                    Logger.error(e);
                    resolve([]);
                });
        });
    }

    /**
     *
     * @returns boolen indicating whether webhook was set
     */
    private importWebhook() {
        return new Promise<string>((resolve) => {
            Storage.readFile(AppData.Webhook)
                .then((data) => {
                    Storage.deleteFile(AppData.Webhook);
                    forEachLine(data, resolve);
                })
                .catch((e) => {
                    Logger.error(`Error reading webhook ${e}`);
                    resolve('');
                });
        });
    }

    private createBotTasks() {
        let accountIndices: object = {};
        for (const [sitename] of this.accounts) {
            accountIndices[sitename] = 0;
        }

        for (const [, { task }] of this.tasks) {
            const website = getWebsiteByName(task.websiteName);
            const profile = this.profiles.get(task.profileId);

            if (!profile) {
                this.tasksWithErrors.push({ lineNumber: 'Unknown', errors: `Profile with name ${task.profileId} does not exist` });

                continue;
            }
            let account;

            if (website?.supportsAccount) {
                const accounts = this.getAccountList(website.name);
                account = accounts[accountIndices[website.name] % accounts.length];
                switch (website.accountToTaskMatchingStategy) {
                    case 'reuse':
                        task.username = account?.username || profile.shippingAddress.email;
                        task.password = account?.password || '';
                        break;
                    case 'oneTaskPerAccount':
                        if (accountIndices[website.name] >= accounts.length) {
                            break;
                        }
                        task.username = account?.username || profile.shippingAddress.email;
                        task.password = account?.password || '';
                        break;

                    case 'oneTaskPerAccountAndAccountRequired':
                        if (accountIndices[website.name] >= accounts.length) {
                            continue; // don't create a task
                        }

                        task.username = account?.username || profile.shippingAddress.email;
                        task.password = account?.password || '';

                        break;
                    default:
                        throw new Error('Not yet implemented');
                }
                let devices = this.devices;
                this.taskManager.addTasks({ task, profile, devices });
                accountIndices[website.name] += 1;
            } else {
                let devices = this.devices;
                this.taskManager.addTasks({ task, profile, devices });
            }
        }
    }
}
