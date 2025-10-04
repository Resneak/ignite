import * as React from 'react';
import { render } from 'react-dom';
import { Provider } from 'react-redux';
import { AppContainer } from 'react-hot-loader';

import { PersistGate } from 'redux-persist/integration/react';
import store, { persistor } from './store';

import ApplicationContainer from './components/ApplicationContainer';

// Create main element
const mainElement = document.createElement('div');
document.body.appendChild(mainElement);

render(
    <AppContainer>
        <Provider store={store}>
            <PersistGate persistor={persistor}>
                <ApplicationContainer />
            </PersistGate>
        </Provider>
    </AppContainer>,
    mainElement
);
