import { Reducer } from 'redux';

import { ADD_PROFILE, DELETE_PROFILE, ProfileAction, UPDATE_PROFILE } from '../actions/profileActions';
import Profile from '../../../../lib/models/profile';
import Logger from '../../main/logger';

export interface ProfileState {
    readonly profiles: Profile[];
}

const defaultState: ProfileState = {
    profiles: [],
};

export const profileReducer: Reducer<ProfileState, ProfileAction> = (state = defaultState, action: ProfileAction) => {
    switch (action.type) {
        case ADD_PROFILE:
            if (state.profiles.find((item) => item.id === action.profile.id) === undefined) {
                return {
                    ...state,
                    profiles: [...state.profiles, action.profile],
                };
            }
            Logger.warn('Cannot upload profiles with the same id');
            return { ...state };

        case DELETE_PROFILE:
            return {
                ...state,
                profiles: state.profiles.filter((profile) => profile.id !== action.id),
            };
        case UPDATE_PROFILE:
            return {
                ...state,
                profiles: state.profiles.map((profile) => {
                    return profile.id === action.profile.id ? action.profile : profile;
                }),
            };
        default:
            return state;
    }
};
