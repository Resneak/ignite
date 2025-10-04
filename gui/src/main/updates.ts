import { BrowserWindow, ipcMain } from 'electron';
import { autoUpdater, UpdateInfo } from 'electron-updater';
import { getHWID } from 'hwid';
import IpcChannel from './ipc';
import { UpdateProgress, UpdateStatus } from '../lib/models/update';

// configure auto updater
autoUpdater.autoDownload = false;

const updateStatus = {
    progress: UpdateProgress.Checking,
    description: 'Checking for updates...',
} as UpdateStatus;

ipcMain.on(IpcChannel.UpdateStatus, (event) => event.reply(IpcChannel.UpdateStatus, updateStatus));
ipcMain.on(IpcChannel.UpdateCheck, (event) => {
    checkForUpdates()
        .then((res) => {
            event.reply(IpcChannel.UpdateCheck, res);
        })
        .catch(() => {
            event.reply(IpcChannel.UpdateCheck, null);
        });
});

export default async function checkForUpdates(window?: BrowserWindow) {
    autoUpdater.removeAllListeners();

    if (window) attachEventListeners(window);

    const hwid = await getHWID();
    // TODO: should we actually get license here or nah?
    const licenseKey = '';

    autoUpdater.requestHeaders = {
        'Ignite-Key': licenseKey,
        'Ignite-HWID': hwid,
    };

    const updateCheckerResult = await autoUpdater.checkForUpdates();

    return updateCheckerResult;
}

function attachEventListeners(window: BrowserWindow) {
    const sendUpdateStatus = (status: UpdateStatus) => window.webContents.send(IpcChannel.UpdateStatus, status);

    // https://www.electron.build/auto-update#events

    autoUpdater.addListener('error', () => {
        // TODO fix the updater
        // updateStatus.progress = UpdateProgress.Error;
        // updateStatus.description = 'Error checking for updates';
        // sendUpdateStatus(updateStatus);
        updateStatus.progress = UpdateProgress.Done;
        updateStatus.description = 'Starting';
        sendUpdateStatus(updateStatus);
    });
    autoUpdater.addListener('checking-for-update', () => {
        updateStatus.progress = UpdateProgress.Checking;
        updateStatus.description = 'Checking for updates';
        sendUpdateStatus(updateStatus);
    });
    autoUpdater.addListener('update-available', (info: UpdateInfo) => {
        updateStatus.progress = UpdateProgress.UpdateFound;
        updateStatus.description = `Found v${info.version.toString()}`;
        sendUpdateStatus(updateStatus);
        autoUpdater.downloadUpdate();
    });
    autoUpdater.addListener('update-not-available', () => {
        updateStatus.progress = UpdateProgress.Done;
        updateStatus.description = 'Starting';
        sendUpdateStatus(updateStatus);
    });
    autoUpdater.addListener('update-downloaded', () => {
        updateStatus.progress = UpdateProgress.UpdateDone;
        updateStatus.description = 'Launching new version';
        sendUpdateStatus(updateStatus);
        const silentInstall = true;
        const forceRunAfterInstall = true;
        autoUpdater.quitAndInstall(silentInstall, forceRunAfterInstall);
    });
    autoUpdater.addListener('download-progress', (info: { percent: number }) => {
        updateStatus.progress = UpdateProgress.UpdateDownloading;
        updateStatus.description = `Downloading update - ${Math.round(info.percent)}%`;
        sendUpdateStatus(updateStatus);
    });
}
