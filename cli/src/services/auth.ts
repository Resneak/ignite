import got, { Got } from 'got';

import { getHWID } from '../utils/hwid';
import { isProd } from '../utils/general';
import Storage from '../utils/storage';
import { Asset } from '../data/files';
import UserAccount from '../../../lib/models/user';
import Logger from '../utils/logger';

export interface AuthResponse {
    // whether the user is authorized
    success: boolean;

    // error message if the user is not authorized
    message?: string;

    /**
     * is account activated
     */
    activated?: boolean;

    /**
     * the user account
     */
    user?: UserAccount;
}

export default class Authenticate {
    private key?: string;

    private initialized?: Promise<any>;

    private hwid!: string;
    private ip!: string;

    private user?: UserAccount;

    private httpClient: Got;

    private onInvalid: (message: string, fatal: boolean) => void;

    constructor(onInvalid: (message: string, fatal: boolean) => void) {
        this.init();
        this.onInvalid = onInvalid;

        const ignitePub = Storage.readFileSync(Asset.IgnitePub);
        this.httpClient = got.extend({
            headers: {
                'User-Agent': `Ignite v1.0.0`,
            },
            prefixUrl: 'https://dashboard.ignitebot.io/api/',
            https: {
                rejectUnauthorized: true,
                checkServerIdentity: (hostname, certificate: any) => {
                    if (ignitePub.toString() !== certificate.pubkey.toString()) {
                        if (isProd()) {
                            Logger.log('Cannot authenticate', true);
                            process.exit();
                        }
                    }
                    return;
                },
            },
        });
    }

    private async init() {
        const promises: Promise<any>[] = [getHWID(), this.getIP()];
        this.initialized = Promise.all(promises)
            .then((resultArray) => {
                [this.hwid, this.ip] = resultArray;
            })
            .catch((e) => {
                Logger.log(`Error getting machine info: ${e}`);
            });
    }

    private async getIP(): Promise<string> {
        return new Promise((resolve, reject) => {
            got.get('https://api.ipify.org?format=json')
                .then((response) => {
                    const ip = JSON.parse(response.body).ip;
                    resolve(ip);
                })
                .catch((e) => {
                    reject('Cannot get IP.');
                });
        });
    }

    private async awaitInit() {
        await this.initialized;
    }

    public async authenticate(key: string | undefined) {
        if (!key) throw new Error('Invalid key.');
        this.key = key;

        try {
            await this.awaitInit();

            let authResponse = await this.verify();

            if (!authResponse.success) {
                const message = authResponse?.message || 'Unauthorized.';
                await this.onInvalid(message, false);
                return;
            }

            if (!authResponse.activated) {
                const activatedAuth = await this.activate();
                if (!activatedAuth.success) await this.onInvalid(`Failed to activate key: ${activatedAuth.message}`, true);
                authResponse = activatedAuth;
            }

            this.user = authResponse.user;
            this.monitor();
            return authResponse;
        } catch (e) {
            await this.onInvalid(`Error: ${e?.response?.body?.message}`, true);
            return;
        }
    }

    private async reAuthenticate() {
        try {
            let authResponse = await this.verify();
            if (!authResponse.success) {
                const message = authResponse?.message || 'Unauthorized.';
                await this.onInvalid(message, false);
            }

            if (!authResponse.activated) {
                const message = authResponse?.message || 'Unauthorized.';
                await this.onInvalid(message, true);
            }
        } catch (e) {
            await this.onInvalid(`Error: ${e?.response?.body?.message}`, true);
            return;
        }
    }

    private monitor() {
        const threeMinutes = 180_000;
        setInterval(async () => {
            await this.reAuthenticate();
        }, threeMinutes);
    }

    private async verify(): Promise<AuthResponse> {
        return new Promise((resolve, reject) => {
            this.httpClient
                .post('auth/verify', {
                    json: {
                        key: this.key,
                        hardwareId: this.hwid,
                        hardwareName: this.ip,
                    },
                    responseType: 'json',
                })
                .then((response) => {
                    resolve(response.body as AuthResponse);
                })
                .catch((e) => {
                    reject(e);
                });
        });
    }

    public async activate(): Promise<AuthResponse> {
        await this.initialized;
        return new Promise((resolve, reject) => {
            this.httpClient
                .post('auth/activate', {
                    json: {
                        key: this.key,
                        hardwareId: this.hwid,
                        hardwareName: this.ip,
                    },
                    responseType: 'json',
                })
                .then((response) => {
                    const authResponse = response.body as AuthResponse;
                    resolve(authResponse);
                })
                .catch((e) => {
                    reject(e);
                });
        });
    }
}
