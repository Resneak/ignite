import { app, BrowserWindow, ipcMain } from 'electron';
import * as url from 'url';
import * as path from 'path';
import IpcChannel from '../../ipc';
import { isDevEnv } from '../../../lib/helpers';
import { genGuuid } from '../../../renderer/helpers';
import HarvesterAccount from '../../../lib/models/harvesterAccount';
import Logger from '../../logger';
import { addStealthCookies } from './stealth';
import HarvesterManager from '../../../lib/models/HarvesterManager';
import { Captcha, CaptchaResponse } from '../../../lib/models/captcha';

const harvesterManager = HarvesterManager.getInstance();

/**
 * creates a new harvester window
 */
ipcMain.on(IpcChannel.HarvesterNew, () => {
    const win = new BrowserWindow({
        width: 400,
        height: 570,
        frame: false,
        transparent: false,
        minimizable: false,
        fullscreen: false,
        backgroundColor: '#091c40',
        webPreferences: {
            preload: path.join(__dirname, "harvester-preload.ts"), //TODO enable this and rewrite harvester-preload
            nodeIntegration: true,
            devTools: !app.isPackaged,
        },
        show: false,
    });

    if (isDevEnv) {
        win.loadURL(`http://localhost:2004/harvester.html`);
        win.webContents.once('dom-ready', () => win.webContents.openDevTools({ mode: 'detach' }));
    } else {
        win.loadURL(
            url.format({
                pathname: path.join(__dirname, 'harvester.html'),
                protocol: 'file:',
                slashes: true,
            })
        );
    }

    win.on('ready-to-show', () => win.show());
    win.on('close', () => {
        harvesterManager.removeCaptchaRequest(`${win.id}`);
    });
});

/**
 * create google login window and return account information to the parent on login
 */
ipcMain.handle(IpcChannel.HarvesterLogin, async (event) => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    const account = parent ? await googleLogin(parent) : undefined;
    Logger.log(`handle: ${account}`);
    return account;
});

/**
 * forward the harvester component's request for a captcha to the HarvesterManager
 */
ipcMain.handle(IpcChannel.HarvesterRequestCaptcha, async (event) => {
    const id = BrowserWindow.fromWebContents(event.sender)?.id;
    const result = await harvesterManager.requestCaptcha(`${id}`);
    return result;
});

/**
 * forward the task's request for a token to the HarvesterManager
 */
ipcMain.handle(IpcChannel.HarvesterRequestToken, async (event, captcha: Captcha) => {
    const result = await harvesterManager.requestToken(captcha);
    return result;
    // autoSolver
    //     .requestToken(captcha)
    //     .then((result: CaptchaResponse) => {
    //         return result;
    //     })
    //     .catch(async (err) => {
    //         const result = await harvesterManager.requestToken(captcha);
    //         return result;
    //     });
});

/**
 * forwards the token result from the harvester to the harvesterManager
 */
ipcMain.on(IpcChannel.HarvesterResult, async (event, captchaResponse: CaptchaResponse | undefined) => {
    harvesterManager.sendResult(captchaResponse);
});

/**
 *
 * @param parent - harvester window responsible for this google login
 */
async function googleLogin(parent: BrowserWindow) {
    const partitionId = `persist:${genGuuid()}`;
    try {
        const { username } = await addStealthCookies(parent, partitionId);
        const account: HarvesterAccount = {
            email: username,
            proxy: undefined,
            sessionId: partitionId,
        };
        return account;
    } catch (err) {
        Logger.error(`Harvester google login error: ${err}`);
    }
}
