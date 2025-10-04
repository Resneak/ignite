import * as React from 'React';
import { FaKey, FaLock, FaPencilAlt } from 'react-icons/fa';

import Logger from '../../../../main/logger';
import DiscordWebhook from '../../../services/discord';

interface Props {
    discordWebhookUrl?: string;
    updateDiscordWebhook: (url: string) => void;
}

const testDiscordWebhook = async (url: string) => {
    Logger.info(url);
    try {
        await new DiscordWebhook(url).test();
    } catch (ex) {
        Logger.error(ex);
        // ignore
        // TODO: maybe show error message in a way? Perhaps add a 'test' btn instead to make this easier?
    }
};

const Integrations = ({ discordWebhookUrl, updateDiscordWebhook }: Props) => {
    return (
        <div className="column float-right position-absolute right-25 width-600">
            <span>Integrations</span>
            <div className="bg4 flex-column min-height-0 height-auto flex-none">
                <div className="stats-header font-size-1">
                    <span className="stat-1 mb-75rem">Discord Webhook URL</span>
                    <div className="flex-grow-1" />
                </div>
                <div className="stats-header z-i-1 font-size-1 pt-0 pb-1rem">
                    <div className="field flex width-100per align-item-center z-i-1">
                        <div className="control has-icons-right width-100per z-i-neg-1">
                            <span id="edit-webhook" className="icon is-small is-right icon-color z-i-10">
                                <FaPencilAlt className="z-i-10 icon-color" />
                            </span>
                            <input
                                className="input profile-input mt-0 z-i-0"
                                id="webhook-address"
                                placeholder="https://discordapp.com/api/webhooks/661904259570204672/p..."
                                value={discordWebhookUrl}
                                type="text"
                                onChange={(e) => {
                                    const url = e.target.value.trim();
                                    updateDiscordWebhook(url);
                                    if (url.startsWith('http')) {
                                        Logger.info(url);
                                        testDiscordWebhook(url);
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className="columns py-0 px-125rem mb-neg-1rem display-flex">
                    <div className="column">
                        <div className="stats-header font-size-1 px-0 py-0">
                            <span className="stat-1 mb-75rem">AutoSolve API Key</span>
                        </div>
                        <div className="stats-header p-0 z-i-0 font-size-1 pb-25rem">
                            <div className="field display-flex width-100per align-items-center z-i-1">
                                <div className="control has-icons-right width-100per z-i-neg-1">
                                    <span id="edit-webhook" className="icon is-small is-right icon-color z-i-10">
                                        <FaKey className="icon-color z-i-10" />
                                    </span>
                                    <input className="input profile-input mt-0 z-i-0" id="autosolve-api-key" placeholder="Your API Key" type="text" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="column">
                        <div className="stats-header font-size-1 p-0">
                            <span className="stat-1 mb-75rem">AutoSolve Access Token</span>
                            <div className="flex-grow-1" />
                        </div>
                        <div className="stats-header z-i-1 font-size-1 p-0 pb-25rem">
                            <div className="field display-flex width-100per align-items-center z-i-1">
                                <div className="control has-icons-right width-100per z-i-neg-1">
                                    <span id="edit-webhook" className="icon is-small is-right icon-color z-i-10">
                                        <FaLock className="icon-color z-i-10" />
                                    </span>
                                    <input
                                        className="input profile-input mt-0 z-i-0"
                                        id="autosolve-access-token"
                                        placeholder="Your Access Token"
                                        type="text"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default Integrations;
