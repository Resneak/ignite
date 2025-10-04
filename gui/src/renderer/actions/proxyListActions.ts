import { Action, ActionCreator } from 'redux';
import ProxyList from '../../lib/models/proxyList';

export const ADD_PROXY_LIST = 'ADD_PROXY_LIST';
export const DELETE_ALL_PROXIES = 'DELETE_ALL_PROXIES';
export const DELETE_PROXY = 'DELETE_PROXY';
export const UPDATE_PROXY_LIST = 'UPDATE_PROXY_LIST';

// Action interfaces
export interface AddProxyListAction extends Action {
    type: 'ADD_PROXY_LIST';
    proxyList: ProxyList;
}

export interface DeleteAllProxiesAction extends Action {
    type: 'DELETE_ALL_PROXIES';
}

export interface DeleteProxyAction extends Action {
    type: 'DELETE_PROXY';
    id: string;
}

export interface UpdateProxyListAction extends Action {
    type: 'UPDATE_PROXY_LIST';
    proxyList: ProxyList;
}

// Action Creators
export const addProxyList: ActionCreator<AddProxyListAction> = (proxyList: ProxyList) => ({
    type: ADD_PROXY_LIST,
    proxyList,
});

export const deleteAllProxies: ActionCreator<DeleteAllProxiesAction> = () => ({
    type: DELETE_ALL_PROXIES,
});

export const deleteProxy: ActionCreator<DeleteProxyAction> = (id: string) => ({
    type: DELETE_PROXY,
    id,
});

export const updateProxyList: ActionCreator<UpdateProxyListAction> = (proxyList: ProxyList) => ({
    type: UPDATE_PROXY_LIST,
    proxyList,
});

export type ProxyListAction = AddProxyListAction | DeleteAllProxiesAction | DeleteProxyAction | UpdateProxyListAction;
