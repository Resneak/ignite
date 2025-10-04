import { App, BrowserWindow } from 'electron';
import { join } from 'path';
import { format } from 'url';

import Icon from '../../../../assets/logo.png';
import { isDevEnv } from '../../../lib/helpers';

export default function createUpdaterWindow(app: App) {
    const win = new BrowserWindow({
        width: 401,
        height: 437,
        frame: false,
        transparent: true,
        maximizable: false,
        fullscreenable: false,
        resizable: false,
        icon: Icon,
        webPreferences: { nodeIntegration: true, devTools: !app.isPackaged },
        show: false,
    });

    if (isDevEnv) {
        win.loadURL(`http://localhost:2004/updater.html`);
        win.webContents.once('dom-ready', () => win.webContents.openDevTools({ mode: 'detach' }));
    } else {
        win.loadURL(
            format({
                pathname: join(__dirname, 'updater.html'),
                protocol: 'file:',
                slashes: true,
            })
        );
    }

    win.on('ready-to-show', () => win.show());

    return win;
}
