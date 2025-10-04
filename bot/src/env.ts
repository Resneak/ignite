import UserAccount from '../../lib/models/user';

export default class Env {
    public static isDev = false;

    public static user?: UserAccount;

    public static ip?: string;

    public static hwid?: string;

    private static instance: Env;

    public static getInstance() {
        if (!this.instance) this.instance = new Env();
        return this.instance;
    }

    private constructor() {}

    public setDev(isDev: boolean) {
        Env.isDev = isDev;
    }

    public static setUser(user?: UserAccount) {
        Env.user = user;
    }
}
