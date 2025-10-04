import { Reducer } from 'redux';

import {
    ADD_PROXY_LIST,
    DELETE_ALL_PROXIES,
    DELETE_PROXY,
    ProxyListAction,
    UPDATE_PROXY_LIST
} from '../actions/proxyListActions';
import ProxyList from '../../lib/models/proxyList';
import Proxy from '../../lib/models/proxy';

export interface ProxyListState {
    readonly proxyLists: ProxyList[];
}

const defaultState: ProxyListState = {
    proxyLists: [],
};

export const proxyListReducer: Reducer<ProxyListState, ProxyListAction> = (state = defaultState, action: ProxyListAction) => {
    switch (action.type) {
        case ADD_PROXY_LIST:
            return {
                ...state,
                proxyLists: [...state.proxyLists, action.proxyList],
            };
        case DELETE_ALL_PROXIES:
            return {
                ...state,
                proxyLists: [],
            };
        case DELETE_PROXY:
            return {
                ...state,
                proxyLists: state.proxyLists
                    .map((proxyList: ProxyList) => {
                        proxyList.proxies = proxyList.proxies.filter((proxy: Proxy) => proxy.id !== action.id);
                        return proxyList;
                    })
                    .filter((proxyList: ProxyList) => proxyList.proxies.length > 0),
            };
        case UPDATE_PROXY_LIST:
            return {
                ...state,
                proxyLists: state.proxyLists.map((proxyList) => {
                    return proxyList.id === action.proxyList.id ? action.proxyList : proxyList;
                }),
            };

        default:
            return state;
    }
};
