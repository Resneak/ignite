import { applyMiddleware, createStore } from 'redux';
import { persistReducer, persistStore } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { composeWithDevTools } from 'redux-devtools-extension';
import { rootReducer } from './reducers';
import Logger from '../main/logger';

const persistConfig = {
    key: 'root',
    storage,
    ...(process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'persist' && { whitelist: ['development'] }),
};

Logger.info(`env ${process.env.NODE_ENV}`);

const persistedReducer = persistReducer(persistConfig, rootReducer);

const middlewares: any[] = [];
const enhancer = composeWithDevTools(applyMiddleware(...middlewares));

const store = createStore(persistedReducer, enhancer);

if (typeof module.hot !== 'undefined') {
    module.hot.accept('./reducers', () => store.replaceReducer(require('./reducers').rootReducer));
}

export default store;
export const persistor = persistStore(store);
