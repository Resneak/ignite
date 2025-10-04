export type SiteAccountProps = Pick<SiteAccount, 'site' | 'username' | 'password'>;

export default class SiteAccount {
    site: string;

    username: string;

    password: string;

    constructor({ site, username, password }: SiteAccountProps) {
        this.site = site;
        this.username = username;
        this.password = password;
    }

    static toString({ site, username, password }: SiteAccountProps) {
        return `${site}:${username}:${password}`;
    }

    static parse(account: string): SiteAccount {
        const [site, username, password] = account?.split(':').map((item) => item?.trim());

        return new SiteAccount({ site: site.toLowerCase(), username, password });
    }

    validate() {
        if (!this.site || !this.username || !this.password) {
            throw new Error(`Invalid parameters Site: ${this.site} Username: ${this.username} Password: ${this.password}`);
        }
    }
}
