import { Reducer } from 'redux';

import HarvesterAccount from '../../lib/models/harvesterAccount';

import { ADD_ACCOUNT, DELETE_ACCOUNT, HarvesterAction, UPDATE_ACCOUNT } from '../actions/harvesterActions';
import Logger from '../../main/logger';

export interface HarvesterState {
    readonly accounts: HarvesterAccount[];
}

const defaultState: HarvesterState = {
    accounts: [],
};

export const harvesterReducer: Reducer<HarvesterState, HarvesterAction> = (state = defaultState, action: HarvesterAction) => {
    switch (action.type) {
        case ADD_ACCOUNT:
            if (!state.accounts.find((item) => item.sessionId === action.account.sessionId)) {
                return {
                    ...state,
                    accounts: [...state.accounts, action.account],
                };
            }
            Logger.error(`Account already exists with sessionId: ${action.account.sessionId}`);
            return {
                ...state,
            };

        case DELETE_ACCOUNT:
            return {
                ...state,
                accounts: state.accounts.filter((account) => account.sessionId !== action.id),
            };

        case UPDATE_ACCOUNT:
            return {
                ...state,
                accounts: state.accounts.map((account) => {
                    return account.sessionId === action.account.sessionId ? action.account : account;
                }),
            };
        default:
            return state;
    }
};
