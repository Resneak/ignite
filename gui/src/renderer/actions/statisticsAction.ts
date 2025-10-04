import { Action, ActionCreator } from 'redux';
import Purchase from '../../lib/models/purchase';

// action constants
export const ADD_PURCHASE = 'ADD_PURCHASE';

// action interfaces
export interface AddPurchaseAction extends Action {
    type: 'ADD_PURCHASE';
    purchase: Purchase;
}

// action creators
export const addPurchase: ActionCreator<AddPurchaseAction> = (purchase: Purchase) => ({
    type: ADD_PURCHASE,
    purchase,
});

// action type
export type PurchaseAction = AddPurchaseAction;
