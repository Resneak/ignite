import { app, BrowserWindow, Menu, Tray } from 'electron';
import { join } from 'path';

import Icon from '../../../../assets/logo.png';
import { isProdEnv } from '../../../lib/helpers';

export default function createMainWindowTray(window: BrowserWindow) {
    const tray = new Tray(isProdEnv && !app.isPackaged ? join(__dirname, Icon) : Icon);

    tray.setContextMenu(
        Menu.buildFromTemplate([
            {
                label: 'Show App',
                click: () => window.show(),
            },
            {
                label: 'Quit',
                click: () => app.quit(),
            },
        ])
    );

    return tray;
}
