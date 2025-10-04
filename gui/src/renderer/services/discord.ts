import got from 'got';

import BotTask from '../../../../bot/src/botTask';
import { CompletionType } from '../../../../lib/errors/index';

export default class Discordwebhook {
    private readonly discordWebhook: string;

    private readonly image = 'https://pbs.twimg.com/profile_images/1316616391773114369/Q8fqdRck_400x400.jpg';

    constructor(url: string) {
        this.discordWebhook = url;
    }

    notifyCheckout(type: CompletionType, botTask: BotTask) {
        const { task, profile } = botTask;

        return got.post(this.discordWebhook, {
            body: JSON.stringify({
                avatar_url: this.image,
                username: 'Ignite',
                embeds: [
                    {
                        color: type === CompletionType.PaymentDeclined ? 13834796 : 4849481,
                        timestamp: new Date().toISOString(),
                        footer: {
                            text: 'Cooked with Ignite - 1.0.0',
                            icon_url: 'https://media.discordapp.net/attachments/802945282915434516/837063849236365372/logo.png?width=700&height=676',
                        },
                        thumbnail: {
                            url: task.product.image || this.image,
                        },
                        author: {
                            name: `${type === CompletionType.PaymentDeclined ? 'Payment declined' : 'Successful Checkout'} | ${task.websiteName}`,
                            icon_url: 'https://media.discordapp.net/attachments/776495557974687776/837081285251825684/unknown.png',
                        },
                        fields: [
                            {
                                name: 'Product',
                                value: task.product.name,
                            },
                            {
                                name: 'Size',
                                // value: task.product.variant.size.name || task.product.variant.size.value, //TODO add size
                                inline: true,
                            },
                            {
                                name: 'Price',
                                value: '100€',
                                inline: true,
                            },
                            {
                                name: 'Profile',
                                value: `|| ${profile.name} ||`,
                            },
                            // ADD PROXY HERE
                            {
                                name: 'Proxy',
                                value: `|| proxy ||`,
                                inline: true,
                            },
                        ],
                    },
                ],
            }),
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    test() {
        return got.post(this.discordWebhook, {
            body: JSON.stringify({
                avatar_url: this.image,
                username: 'Ignite',
                embeds: [
                    {
                        title: 'Ignite Test Webhook',
                        color: 7142283,
                        fields: [
                            {
                                name: 'Webhook Updated',
                                value: 'Your Webhook has been successfully updated!',
                                inline: true,
                            },
                        ],
                        footer: {
                            icon_url: this.image,
                            text: 'Ignite',
                        },
                        timestamp: new Date().toISOString(),
                    },
                ],
            }),
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}
