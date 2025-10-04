import { BrowserWindow, session } from 'electron';
import * as path from 'path';

const stealthUserAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/535.11 (KHTML, like Gecko) Ubuntu/18.04.2 Chrome/78.0.3904.108';

export function addStealthCookies(parent: BrowserWindow, partitionId: string) {
    return new Promise<{ username: string }>((resolve, reject) => {
        const ses = session.fromPartition(partitionId);

        console.log(path.resolve(path.join(__dirname, 'stealth-preload.js')));

        const win = new BrowserWindow({
            height: 500,
            width: 400,
            resizable: false,
            backgroundColor: '#ffffff',
            title: 'Sign In',
            parent,
            alwaysOnTop: true,
            webPreferences: {
                session: ses,
                contextIsolation: false,
                preload: path.resolve(path.join(__dirname, 'stealth-preload.js')),
                partition: partitionId,
            },
        });

        win.setMaximizable(false);

        const { webContents } = win;

        let success = false;
        webContents.on('did-finish-load', async () => {
            if (new URL(webContents.getURL())?.hostname === 'www.google.com') {
                const username = await webContents
                    .executeJavaScript(
                        `(function() {
							let found = null;
							if(document.querySelector("h1").textContent){
								found = document.querySelector("h1").textContent.split(",")[1].trim()
							}
							return found;
						 })()`
                    )
                    .catch(() => null);

                if (username) {
                    success = true;
                    win.close();
                    resolve({ username });
                } else {
                    win.close();
                }
            }
        });

        webContents.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36';
        webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
            const requestHeaders = {
                ...details.requestHeaders,
                ...{
                    ['Accept-Language']: 'en-US,en;q=0.9',
                },
            };
            callback({ cancel: false, requestHeaders });
        });

        win.on('closed', () => {
            if (!success) reject('Sign in window closed');
        });

        win.loadURL('https://www.youtube.com/signin', { userAgent: stealthUserAgent });
    });
}
