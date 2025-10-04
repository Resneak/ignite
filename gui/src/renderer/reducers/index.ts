import { combineReducers } from 'redux';

import { harvesterReducer, HarvesterState } from './harvesterReducer';
import { profileReducer, ProfileState } from './profileReducer';
import { proxyListReducer, ProxyListState } from './proxyListReducer';
import { settingsReducer, SettingsState } from './settingsReducer';
import { statisticsReducer, StatisticsState } from './statisticsReducer';
import { taskReducer, TaskState } from './taskReducer';
import { userReducer, UserState } from './userReducer';

export interface RootState {
    harvester: HarvesterState;
    profile: ProfileState;
    proxy: ProxyListState;
    task: TaskState;
    user: UserState;
    statistics: StatisticsState;
    settings: SettingsState;
}

export const rootReducer = combineReducers<RootState | undefined>({
    harvester: harvesterReducer,
    proxy: proxyListReducer,
    profile: profileReducer,
    task: taskReducer,
    user: userReducer,
    statistics: statisticsReducer,
    settings: settingsReducer,
});
