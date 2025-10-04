import inquirer from 'inquirer';
import Logger from './utils/logger';
import { clear, renderLogo } from './utils/terminal';
import { AppData } from './data/files';
import Storage from './utils/storage';
import Main from './main';
import UserAccount from '../../lib/models/user';
import Authenticate from './services/auth';
import Env from '../../bot/src/env';

export interface User {
    picture?: string;
    username?: string;
    type?: string;
    expiration?: string;
    key: string;
}

export interface AuthResponse {
    status: string;
    reason: string;
    hwid: string;
    user: User;
}

export default class Login {
    private user?: UserAccount;

    private key?: string;

    private auth?: Authenticate;

    constructor() {
        this.start();
        clear();
    }

    private async start() {
        // await Storage.printPkgFileSystem(); // enable this print the virtual file system in the cli

        await this.getUser();
        renderLogo();
        Logger.log('Loading...', true);

        let authorized = false;
        if (this.key) {
            authorized = await this.checkAuth();
        }

        while (!authorized) {
            await this.promptLogin();
            clear();
            renderLogo();

            if (this.key) {
                authorized = await this.checkAuth();
            }
            !authorized && Logger.error('Unauthorized.', true);
        }
        clear();
        renderLogo();
        await this.loadCLI();
    }

    private async promptLogin() {
        const questions = [
            {
                type: 'input',
                name: 'key',
                message: 'Enter your license key:',
            },
        ];
        const { key } = await inquirer.prompt(questions);
        this.key = key;
    }

    private async onInvalid(msg: string, fatal: boolean) {
        Logger.log(msg, true);
        if (fatal) {
            Logger.log('Exiting...', true);
            try {
                await Storage.deleteFile(AppData.User);
            } catch {}
            await new Promise(() =>
                setTimeout(() => {
                    process.exit();
                }, 1000)
            );
        }
    }

    private async checkAuth() {
        let authorized = false;
        if (this.key) {
            if (this.auth === undefined) {
                this.auth = new Authenticate(this.onInvalid);
            }
            Logger.log('Checking Key...', true);
            try {
                const authResponse = await this.auth.authenticate(this.key);
                this.user = authResponse?.user;
                if (this.user) {
                    authorized = true;
                    this.user.key = this.key;
                }
            } catch (err) {
                Logger.error(`Error logging in: ${err}`, true);
            }
        }

        return authorized;
    }

    private async loadCLI() {
        Logger.success(`Welcome ${this.user?.name}`, true);
        Logger.log(`Loading...`, true);

        try {
            await Storage.writeToFile(AppData.User, JSON.stringify(this.key));
        } catch (err) {
            Logger.error(`Could not save user data ${this.user}`);
        }

        try {
            Env.setUser(this.user);
            Main.getInstance(this.user).then((main) => {
                main.run();
            });
        } catch (err) {
            Logger.log(err, true);
        }
    }

    private async getUser() {
        try {
            const contents = Storage.readFileSync(AppData.User);

            if (contents) {
                this.key = JSON.parse(contents);
            } else {
                this.key = undefined;
            }
        } catch (e) {
            this.key = undefined;
        }
    }
}
new Login();
