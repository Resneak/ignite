import { App } from 'electron';
import { isProdEnv } from '../../lib/helpers';

export function exitOnInvalidEnvironment(app: App) {
    if ((app.isPackaged && !isProdEnv) || process.env.NODE_TLS_REJECT_UNAUTHORIZED) process.exit();
}

export function preventMultipleInstances(app: App) {
    if (!app.requestSingleInstanceLock()) app.quit();
}
