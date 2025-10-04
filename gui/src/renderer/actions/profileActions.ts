import { Action, ActionCreator } from 'redux';
import Profile from '../../../../lib/models/profile';

// action constants
export const ADD_PROFILE = 'ADD_PROFILE';
export const DELETE_PROFILE = 'DELETE_PROFILE';
export const UPDATE_PROFILE = 'UPDATE_PROFILE';

// action interfaces
export interface AddProfileAction extends Action {
    type: 'ADD_PROFILE';
    profile: Profile;
}
export interface DeleteProfileAction extends Action {
    type: 'DELETE_PROFILE';
    id: string;
}
export interface UpdateProfileAction extends Action {
    type: 'UPDATE_PROFILE';
    profile: Profile;
}

// action creators
export const addProfile: ActionCreator<AddProfileAction> = (profile: Profile) => ({
    type: ADD_PROFILE,
    profile,
});
export const deleteProfile: ActionCreator<DeleteProfileAction> = (id: string) => ({
    type: DELETE_PROFILE,
    id,
});
export const updateProfile: ActionCreator<UpdateProfileAction> = (profile: Profile) => ({
    type: UPDATE_PROFILE,
    profile,
});

// action type
export type ProfileAction = AddProfileAction | DeleteProfileAction | UpdateProfileAction;
