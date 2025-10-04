import got from 'got';
import Task from '../../../lib/models/task';
import Profile from '../../../lib/models/profile';
import { capitalizeFirstLetter } from '../utils/general';
import { sleep } from '../../../lib/helpers';
import Queue from 'promise-queue';
import { formatPrice } from '../../../lib/helpers/formatters';
export interface CheckoutWebhookProps {
    task: Task;
    profile: Profile;
    successful: boolean;
    url: string;
}

interface QueueWrapper {
    retryAt: number;
    queue: Queue;
}

interface EmbedData {
    url: string;
    embed: any;
}

export default class Discordwebhook {
    private readonly image = 'https://cdn.discordapp.com/attachments/825763376897589280/855125142417834024/ignite-logo.png';

    /**
     * maps a url to a webhook queue
     */
    private queues: Map<string, QueueWrapper>;

    private queueSizeListeners: ((size: number) => void)[];

    private static instance: Discordwebhook;

    static getInstance() {
        if (this.instance === undefined) this.instance = new Discordwebhook();
        return this.instance;
    }

    private constructor() {
        this.queues = new Map();
        this.queueSizeListeners = [];
    }

    public notifyCheckout(props: CheckoutWebhookProps, isGlobal = false) {
        const embedData = isGlobal ? this.getGlobalCheckoutEmbed(props) : this.getCheckoutEmbed(props);
        this.enqueueWebhook(embedData);
    }

    public getNumWebhooksQueued() {
        let total = 0;
        for (const [, queueWrapper] of this.queues) {
            total += queueWrapper.queue.getQueueLength() + queueWrapper.queue.getPendingLength();
        }
        return total;
    }

    public notifyTest(url: string): Promise<any> {
        const embedData = this.getTestEmbed(url);
        return this.sendWebhook(embedData);
    }

    public registerQueueSizeListener(listener: (size: number) => void) {
        this.queueSizeListeners.push(listener);
    }

    /**
     *
     * @param embedData to add to a queue of webhooks
     */
    private enqueueWebhook(embedData: EmbedData) {
        const queueWrapper = this.getQueue(embedData.url);

        queueWrapper?.queue
            .add(async () => {
                const duration = queueWrapper.retryAt - Date.now();
                await sleep(duration);
                return await this.sendWebhook(embedData);
            })
            .then(() => {
                queueWrapper.retryAt = 0;
                this.notifyQueueSizeChange();
                // delete empty queues
                if (queueWrapper.queue.getQueueLength() + queueWrapper.queue.getPendingLength() === 0) this.queues.delete(embedData.url);
            })
            .catch((err: any) => {
                // get retry and re-add item to queue
                const retryIn = JSON.parse(err.response.body)?.retry_after;
                queueWrapper.retryAt = Date.now() + retryIn;
                this.enqueueWebhook(embedData);
            });
    }

    /**
     *
     * @param url of the queue to get
     * @returns a queue for the url
     */
    private getQueue(url: string) {
        if (!this.queues.has(url)) {
            const maxConcurrent = 1;
            const maxQueue = Infinity;
            const queue = { retryAt: Date.now(), queue: new Queue(maxConcurrent, maxQueue) };
            this.queues.set(url, queue);
        }
        return this.queues.get(url);
    }

    /**
     * @param data used to create embed
     * @returns a formatted checkout embed
     */
    private getCheckoutEmbed({ task, profile, successful, url }: CheckoutWebhookProps): EmbedData {
        const urlField = url ? { url: task.checkoutUrl } : {};
        const e = {
            url,
            embed: {
                title: successful ? 'Successful checkout !' : 'Payment Declined',
                color: successful ? 7142283 : 16711680,
                ...urlField,
                fields: [
                    {
                        name: 'Website',
                        value: capitalizeFirstLetter(task.websiteName),
                        inline: true,
                    },
                    {
                        name: 'Mode',
                        value: capitalizeFirstLetter(task.mode),
                        inline: true,
                    },
                    {
                        name: '\u200b',
                        value: '\u200b',
                        inline: true,
                    },
                    {
                        name: 'Product',
                        value: task.product.name,
                        inline: true,
                    },
                    {
                        name: 'Size',
                        value: task?.product?.size?.toString() || 'One Size',
                        inline: true,
                    },
                    {
                        name: 'Price',
                        value: formatPrice(task.product.price),
                        inline: true,
                    },
                    {
                        name: 'Email',
                        value: `||${task.username || profile.shippingAddress.email}||`,
                        inline: true,
                    },
                    {
                        name: 'Profile',
                        value: `||${profile?.profileName}||`,
                        inline: true,
                    },
                    {
                        name: 'Quantity',
                        value: `${task.atcQuantity}`,
                        inline: true,
                    },
                    {
                        name: 'Proxy',
                        value: `||${task.checkoutProxy || 'Localhost'}||`,
                        inline: true,
                    },
                ],
                footer: {
                    text: 'Ignite • Version 1.0.0',
                    icon_url: this.image,
                },
                timestamp: new Date().toISOString(),
                thumbnail: {
                    url: task.product.image,
                },
            },
        };
        if (task.orderId)
            e.embed.fields.push({
                name: 'Order ID',
                value: `||${task.orderId}||`,
                inline: true,
            });
        return e;
    }

    /**
     * @param data used to create embed
     * @returns a formatted checkout embed
     */
    private getGlobalCheckoutEmbed({ task, successful, url }: CheckoutWebhookProps): EmbedData {
        return {
            url,
            embed: {
                title: task.product.name,
                color: 12320856,
                fields: [
                    {
                        name: 'Website',
                        value: capitalizeFirstLetter(task.websiteName),
                        inline: true,
                    },
                    {
                        name: 'Mode',
                        value: capitalizeFirstLetter(task.mode),
                        inline: true,
                    },
                    {
                        name: 'Monitor input',
                        value: task.product.id,
                        inline: true,
                    },
                    {
                        name: 'Size',
                        value: task.product.size?.name || 'N/A',
                        inline: true,
                    },
                    {
                        name: 'Price',
                        value: formatPrice(task.product.price),
                        inline: true,
                    },
                ],
                footer: {
                    text: 'Ignite Success Logger - Version 1.0.0',
                    icon_url: this.image,
                },
                timestamp: new Date().toISOString(),
                thumbnail: {
                    url: task.product.image,
                },
            },
        };
    }

    /**
     *
     * @param url to send the webhook to
     * @returns a formatted test embed
     */
    private getTestEmbed(url: string): EmbedData {
        return {
            url,
            embed: {
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
        };
    }

    /**
     * @param embed data containing url and embed to send in webhook
     */
    private sendWebhook({ url, embed }: EmbedData) {
        return got
            .post(url, {
                body: JSON.stringify({
                    avatar_url: 'https://pbs.twimg.com/profile_images/1390675530010218498/uVX5FvNr_400x400.jpg',
                    username: 'Ignite',
                    embeds: [embed],
                }),
                headers: {
                    'Content-Type': 'application/json',
                },
            })
            .then((response) => {
                return response;
            });
            // .catch((error) => {
            //     console.log(error.response.body);
            // });
    }

    /**
     * notifies the registered queue size listeners when a webhook has been sent
     */
    private notifyQueueSizeChange() {
        const size = this.getNumWebhooksQueued();
        for (const listener of this.queueSizeListeners) {
            listener(size);
        }
    }
}
