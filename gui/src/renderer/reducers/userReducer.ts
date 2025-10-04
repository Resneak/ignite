import { Reducer } from 'redux';

import { LOGIN_USER, LOGOUT_USER, UPDATE_USER, UPDATE_USER_CURRENCY, UserAction } from '../actions/userActions';
import UserAccount from '../../../../lib/models/user';

export interface UserState {
    readonly account?: UserAccount;
}

const defaultState: UserState = {
    account: undefined,
};

export const userReducer: Reducer<UserState, UserAction> = (state = defaultState, action: UserAction) => {
    switch (action.type) {
        case LOGIN_USER:
            if (state.account === undefined) {
                return {
                    ...state,
                    account: action.user,
                };
            }
            return { ...state };
        case LOGOUT_USER:
            return {
                ...state,
                account: undefined,
            };
        case UPDATE_USER:
            return {
                ...state,
                account: {
                    ...state.account,
                    ...action.user,
                },
            };
        case UPDATE_USER_CURRENCY:
            return {
                ...state,
                account: {
                    ...(state.account as UserAccount),
                    currency: action.currency,
                },
            };
        default:
            return state;
    }
};
