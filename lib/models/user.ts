export default class UserAccount {
    id: string;

    name: string;

    key: string;

    discriminator: string;

    avatarURL: string;

    constructor({ id, name, key, discriminator, avatarURL }: UserAccount) {
        this.id = id;
        this.name = name;
        this.key = key;
        this.discriminator = discriminator;
        this.avatarURL = avatarURL;
    }
}
