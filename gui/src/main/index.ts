import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';

import { exitOnInvalidEnvironment, preventMultipleInstances } from './windows/security';
import createMainWindowTray from './windows/mainwindow/tray';
import createMainWindow from './windows/mainwindow';

import { isDevEnv } from '../lib/helpers';
import installExtensions from './windows';
import createUpdaterWindow from './windows/updater';
import checkForUpdates from './updates';
import registerDiscordRPC from './discordRPC';

import IpcChannel from './ipc';
import './windows/harvester/index';

app.setAppLogsPath(join(app.getPath('userData'), 'Logs'));

exitOnInvalidEnvironment(app);
preventMultipleInstances(app);

let mainWin: BrowserWindow | null;
let updaterWin: BrowserWindow | null;
let updateCheckDone = false;

// called when the updater found no update
ipcMain.on(IpcChannel.UpdateDone, async () => {
    if (mainWin) return;

    mainWin = createMainWindow(app);
    mainWin.on('closed', () => {
        mainWin = null;
        app.quit();
    });

    createMainWindowTray(mainWin);
    mainWin.show();

    registerDiscordRPC();

    // close updater window
    // eslint-disable-next-line no-return-assign
    updaterWin?.on('closed', () => (updaterWin = null));
    updaterWin?.close();
    updateCheckDone = true;
});

app.on('ready', () => {
    if (isDevEnv) {
        installExtensions();
    }

    updaterWin = createUpdaterWindow(app);
    checkForUpdates(updaterWin);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (mainWin == null && updateCheckDone) mainWin = createMainWindow(app);
});

app.on('second-instance', () => {
    if (!mainWin) return;
    if (mainWin.isMinimized()) mainWin.restore();
    mainWin.focus();
});
