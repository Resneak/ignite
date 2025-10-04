import Logger from './utils/logger';
import inquirer from 'inquirer';
import { capitalizeFirstLetter } from './utils/general';
import { TaskStatusColor } from '../../lib/models/taskUpdate';
import registerDiscordRPC from './services/discord-rp';
import { center, chalkIgnite, clear, setTerminalTitle } from './utils/terminal';
import Main from './main';
import { fortyCharLogo } from './utils/logos';
import { sleep } from '../../lib/helpers';

enum MenuOptions {
    PromptWebhook = 'Initialize Webhook',
    StartTasks = 'Start Tasks',
    SelectSolver = 'Select Solver',
    // ToggleWatchdog = 'Toggle Watchdog Tasks',
    ViewErrors = 'View Errors',
}
export default class UI {
    private static instance: UI;
    private name = 'Ignite';
    private version = '1.0.0';
    private main!: Main;

    public static getInstance() {
        if (this.instance === undefined) {
            this.instance = new this();
            Main.getInstance().then((main) => {
                this.instance.main = main;
            });
        }
        return this.instance;
    }
    private constructor() {}

    public async start() {
        clear();
        if (this) await this.menu();
    }

    private async startTasks() {
        this.main.startTasks();
    }

    public onAllTasksComplete() {
        Logger.success('All tasks complete, returning to menu', true);
    }

    public headers() {
        this.renderLogo();
        this.renderTaskInfo();
    }

    private renderLogo = () => {
        center(fortyCharLogo);
    };

    public renderTaskInfo() {
        const profiles = { name: 'Profiles', quantity: this.main.getNumProfiles(), errors: this.main.getNumberOfProfilesWithErrors() };
        const proxies = { name: 'Proxies', quantity: this.main.getNumProxies(), errors: 0 };
        const tasks = { name: 'Tasks', quantity: this.main.getNumTasks(), errors: this.main.getNumberOfTasksWithErrors() };
        const accounts = { name: 'Accounts', quantity: this.main.getNumAccounts(), errors: this.main.getNumberOfAccountsWithErrors() };
        [profiles, proxies, tasks, accounts].forEach((item) => {
            const format = `${item.name}: ${item.quantity}`;
            const errorFormat = `${item.name} with Errors: ${item.errors}`;
            if (item.quantity > 0) {
                Logger.success(format, true);
            } else {
                Logger.warn(format, true);
            }
            if (item.errors > 0) {
                Logger.warn(errorFormat, true);
            }
        });
        this.main.getWebhook() ? Logger.success('Webhook: Initialized', true) : Logger.warn('Webhook: Uninitialized', true);
        const captchaSolver = this.main.getCaptchaSolver();
        captchaSolver ? Logger.success(`Current Captcha Solver: ${captchaSolver}`, true) : Logger.warn('Captcha Solver: Uninitialized');
        // const isWatchdogEnabled = this.main.getIsWatchdogEnabled();
        // isWatchdogEnabled ? Logger.success(`Watchdog Tasks Enabled`, true) : Logger.warn(`Watchdog Tasks Disabled`, true);
    }

    public renderTaskUpdate({
        taskNumber,
        siteName,
        message,
        color,
    }: {
        taskNumber: number;
        siteName: string;
        message: string;
        color: TaskStatusColor;
    }) {
        const shouldShowUser = !!message;
        const time = Logger.getTime();
        const site = Logger.wrap(capitalizeFirstLetter(siteName));
        const task = Logger.wrap(`Task ${taskNumber}`);
        const prefix = chalkIgnite(`${time}:${site}:${task}`);
        const messageWithMeta = `${prefix} ${message}`;
        switch (color) {
            case TaskStatusColor.Error:
                Logger.error(messageWithMeta, shouldShowUser);
                break;

            case TaskStatusColor.Warning:
                Logger.warn(messageWithMeta, shouldShowUser);
                break;

            case TaskStatusColor.Neutral:
                Logger.log(messageWithMeta, shouldShowUser);
                break;

            case TaskStatusColor.Info:
                Logger.info(messageWithMeta, shouldShowUser);
                break;

            case TaskStatusColor.Cart:
                Logger.cart(messageWithMeta, shouldShowUser);
                break;

            case TaskStatusColor.Success:
                Logger.success(messageWithMeta, shouldShowUser);
                break;
            case TaskStatusColor.Ping:
                Logger.log(messageWithMeta, shouldShowUser, '', 'dim');
            default:
                Logger.log(messageWithMeta, false);
                break;
        }
    }

    public async menu() {
        registerDiscordRPC();

        this.headers();
        this.renderTerminalTitle();

        const viewErrors = {
            name: MenuOptions.ViewErrors,
        };

        const choices = [
            {
                name: MenuOptions.StartTasks,
                disabled: this.main.getNumTasks() === 0 && 'Please create tasks first',
            },
            {
                name: MenuOptions.PromptWebhook,
            },
            {
                name: MenuOptions.SelectSolver,
            },
            // {
            //     name: MenuOptions.ToggleWatchdog,
            // },
        ];
        if (this.getNumberOfErrors()) {
            choices.push(viewErrors);
        }
        inquirer
            .prompt([
                {
                    type: 'list',
                    name: 'main',
                    message: 'What would you like to do?',
                    choices,
                },
            ])
            .then((answers) => {
                switch (answers.main) {
                    case MenuOptions.PromptWebhook:
                        this.promptWebhook();
                        break;
                    case MenuOptions.StartTasks:
                        this.startTasks();
                        break;
                    case MenuOptions.SelectSolver:
                        this.selectSolver();
                        break;
                    // case MenuOptions.ToggleWatchdog:
                    //     this.toggleWatchdog();
                    //     break;
                    case MenuOptions.ViewErrors:
                        this.viewErrors();
                }
            })
            .catch((err) => {
                clear();
                Logger.error(err);
            });
    }

    public renderTerminalTitle() {
        const alwaysVisible = `${this.name} ${this.version} Carted (${this.main.carted}) Checkouts (${this.main.checkouts}) Declines (${this.main.declines})`;
        const accountsCreated = this.main.accountsCreated > 0 ? ` Accounts Created (${this.main.accountsCreated})` : '';
        const str = `${alwaysVisible}${accountsCreated}`;
        setTerminalTitle(str);
    }

    private async promptWebhook() {
        inquirer
            .prompt({
                type: 'input',
                name: 'url',
                message: 'Enter webhook url',
            })
            .then(async ({ url }) => {
                const initialized = await this.main.testWebhook(url);
                clear();
                !initialized && Logger.error('Error initializing webhook', true);
            })
            .catch((err) => {
                clear();
                Logger.error(`Error initializing webhook`, true);
            })
            .finally(() => {
                this.menu();
            });
    }

    private async selectSolver() {
        const choices = this.main.getCaptchaSolvers().map((type) => {
            return {
                name: type,
            };
        });
        if (choices.length === 0) {
            Logger.error('No solvers loaded. Returning to menu...', true);
            await sleep(1500);
            clear();
            this.menu();
            return;
        }
        inquirer
            .prompt([
                {
                    type: 'list',
                    name: 'solver',
                    message: 'Select a solver',
                    choices,
                },
            ])
            .then(({ solver }) => {
                this.main.setSolver(solver);
                clear();
            })
            .catch((e) => {
                clear();
                Logger.error(`${e}`, true);
            })
            .finally(() => {
                this.menu();
            });
    }

    private async toggleWatchdog() {
        const selected = this.main.getIsWatchdogEnabled();
        const shouldBeEnabled = !selected;
        this.main.setShouldWatchdogBeEnabled(shouldBeEnabled);
        clear();
        this.menu();
    }

    getNumberOfErrors() {
        const errors = this.getErrors();
        const numberOfErrors = Object.values(errors)
            .map((item) => item.length)
            .reduce((acc, num) => acc + num, 0);
        return numberOfErrors;
    }

    private getErrors() {
        const profile = this.main.getProfilesWithErrors();
        const account = this.main.getAccountsWithErrors();
        const task = this.main.getTaskssWithErrors();

        return { profile, account, task };
    }

    private async viewErrors() {
        clear();
        const errors = this.getErrors();

        for (const [key, value] of Object.entries(errors)) {
            const errors = value.map((item) => {
                return {
                    Type: `${capitalizeFirstLetter(key)}`,
                    Line: item.lineNumber,
                    Errors: `${item.errors}`,
                };
            });

            if (errors.length > 0) console.table(errors);
        }

        this.setReturnToMenuOnKeyPress();
    }

    setReturnToMenuOnKeyPress = () => {
        Logger.success('Press enter to return to the main menu.', true);
        const stdin = process.stdin;

        stdin.setRawMode(true);
        stdin.resume();

        stdin.setEncoding('utf8');
        const onKeyPress = (ch: any, key: { sequence: string; name: string; ctrl: boolean; meta: boolean; shift: boolean }) => {
            if (key.sequence === '\u0003') {
                process.exit();
            }
            if (key.name === 'return') {
                stdin.removeListener('keypress', onKeyPress);
                this.start();
            }
        };

        stdin.on('keypress', onKeyPress);
    };
}
