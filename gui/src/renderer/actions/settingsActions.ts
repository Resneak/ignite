import { Action, ActionCreator } from 'redux';

// action constants
export const CHANGE_DISCORD_WEBHOOK_URL = 'CHANGE_DISCORD_WEBHOOK_URL';

// action interfaces
export interface ChangeDiscordWebhookAction extends Action {
    type: 'CHANGE_DISCORD_WEBHOOK_URL';
    webhook: string;
}

// action creators
export const updateDiscordWebhook: ActionCreator<ChangeDiscordWebhookAction> = (
    webhook: string
) => ({
    type: CHANGE_DISCORD_WEBHOOK_URL,
    webhook,
});

// action type
export type SettingsAction = ChangeDiscordWebhookAction;
