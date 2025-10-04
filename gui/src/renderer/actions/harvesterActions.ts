import { Action, ActionCreator } from 'redux';
import HarvesterAccount from '../../lib/models/harvesterAccount';

export const ADD_ACCOUNT = 'ADD_ACCOUNT';
export const DELETE_ACCOUNT = 'DELETE_ACCOUNT';
export const UPDATE_ACCOUNT = 'UPDATE_ACCOUNT';

export interface AddAccountAction extends Action {
    type: 'ADD_ACCOUNT';
    account: HarvesterAccount;
}

export interface DeleteAccountAction extends Action {
    type: 'DELETE_ACCOUNT';
    id: string;
}

export interface UpdateAccountAction extends Action {
    type: 'UPDATE_ACCOUNT';
    account: HarvesterAccount;
}

// action creeators
export const addAccount: ActionCreator<AddAccountAction> = (account: HarvesterAccount) => ({
    type: ADD_ACCOUNT,
    account,
});

export const deleteAccount: ActionCreator<DeleteAccountAction> = (id: string) => ({
    type: DELETE_ACCOUNT,
    id,
});

export const updateAccount: ActionCreator<UpdateAccountAction> = (account: HarvesterAccount) => ({
    type: UPDATE_ACCOUNT,
    account,
});

export type HarvesterAction = AddAccountAction | DeleteAccountAction | UpdateAccountAction;
