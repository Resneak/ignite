import { Reducer } from 'redux';
import Purchase from '../../lib/models/purchase';
import { ADD_PURCHASE, AddPurchaseAction } from '../actions/statisticsAction';

export interface StatisticsState {
    readonly purchases: Purchase[];
}

const defaultState: StatisticsState = {
    purchases: [],
};

export const statisticsReducer: Reducer<StatisticsState, AddPurchaseAction> = (state = defaultState, action: AddPurchaseAction) => {
    switch (action.type) {
        case ADD_PURCHASE:
            return {
                ...state,
                purchases: [...state.purchases, action.purchase],
            };
        default:
            return state;
    }
};
