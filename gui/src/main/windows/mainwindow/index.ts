import { App, BrowserWindow, screen } from 'electron';
import { join } from 'path';
import { format } from 'url';

import Icon from '../../../../assets/logo.png';
import { isDevEnv } from '../../../lib/helpers';

/**
 * calculates the optimal electron window size
 */
function calcWindowSize(optimalSize = { width: 1300, height: 850 }): Electron.Size {
    const screenSize = screen.getPrimaryDisplay().workAreaSize;
    return {
        width: screenSize.width < optimalSize.width ? screenSize.width : optimalSize.width,
        height: screenSize.height < optimalSize.height ? screenSize.height : optimalSize.height,
    };
}

export default function createMainWindow(app: App) {
    const windowSize = calcWindowSize();

    const win = new BrowserWindow({
        width: windowSize.width,
        height: windowSize.height,
        webPreferences: { nodeIntegration: true, devTools: !app.isPackaged, contextIsolation: false },
        frame: false,
        minWidth: 1300,
        minHeight: 725,
        transparent: true,
        icon: Icon,
    });

    if (isDevEnv) {
        win.loadURL(`http://localhost:2004`);
        win.webContents.once('dom-ready', () => win.webContents.openDevTools({ mode: 'detach' }));
    } else {
        win.loadURL(
            format({
                pathname: join(__dirname, 'index.html'),
                protocol: 'file:',
                slashes: true,
            })
        );
    }

    return win;
}
