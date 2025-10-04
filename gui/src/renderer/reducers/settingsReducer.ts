import { Reducer } from 'redux';
import { SettingsAction } from '../actions/settingsActions';

export interface SettingsState {
    readonly discordWebhookUrl?: string;
}

const defaultState: SettingsState = {
    discordWebhookUrl: undefined,
};

export const settingsReducer: Reducer<SettingsState, SettingsAction> = (state = defaultState, action: SettingsAction) => {
    switch (action.type) {
        case 'CHANGE_DISCORD_WEBHOOK_URL':
            return {
                ...state,
                discordWebhookUrl: action.webhook,
            };
        default:
            return state;
    }
};
