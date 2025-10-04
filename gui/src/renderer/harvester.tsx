import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { AppContainer } from 'react-hot-loader';
import { PersistGate } from 'redux-persist/integration/react';
import HarvesterContainer from './components/harvester/HarvesterContainer';
import store, { persistor } from './store';

// Create main element
const mainElement = document.createElement('div');
document.body.appendChild(mainElement);

// Render components
const render = (Component: () => JSX.Element) => {
    ReactDOM.render(
        <AppContainer>
            <Provider store={store}>
                <PersistGate persistor={persistor}>
                    <Component />
                </PersistGate>
            </Provider>
        </AppContainer>,
        mainElement
    );
};

render(() => <HarvesterContainer />);
