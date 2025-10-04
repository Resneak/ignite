import { Action, ActionCreator } from 'redux';
import Currency from '../../../../lib/models/currency';
import UserAccount from '../../../../lib/models/user';

// action constants
export const LOGIN_USER = 'LOGIN_USER';
export const LOGOUT_USER = 'LOGOUT_USER';
export const UPDATE_USER = 'UPDATE_USER';
export const UPDATE_USER_CURRENCY = 'UPDATE_USER_CURRENCY';

// action interfaces
export interface LoginUser extends Action {
    type: 'LOGIN_USER';
    user: UserAccount;
}
export interface LogoutUserAction extends Action {
    type: 'LOGOUT_USER';
}
export interface UpdateUserAction extends Action {
    type: 'UPDATE_USER';
    user: UserAccount;
}
export interface UpdateUserCurrencyAction extends Action {
    type: 'UPDATE_USER_CURRENCY';
    currency: Currency;
}

// action creators
export const loginUser: ActionCreator<LoginUser> = (user: UserAccount) => ({
    type: LOGIN_USER,
    user,
});
export const logoutUser: ActionCreator<LogoutUserAction> = () => ({
    type: LOGOUT_USER,
});
export const updateUser: ActionCreator<UpdateUserAction> = (user: UserAccount) => ({
    type: UPDATE_USER,
    user,
});
export const updateUserCurrency: ActionCreator<UpdateUserCurrencyAction> = (currency: Currency) => ({
    type: UPDATE_USER_CURRENCY,
    currency,
});

// action type
export type UserAction = LoginUser | LogoutUserAction | UpdateUserAction | UpdateUserCurrencyAction;
