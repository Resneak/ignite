import * as React from 'React';
import ReCAPTCHA from 'react-google-recaptcha';
import '../Application.scss';
import './Harvester.scss';
import { ipcRenderer, remote } from 'electron';
import { useEffect, useState } from 'react';
import { hot } from 'react-hot-loader/root';
import Logger from '../../../main/logger';
import IpcChannel from '../../../main/ipc';
import HarvesterAccount from '../../../lib/models/harvesterAccount';
import { proxyRegex } from '../../helpers/constants';
import { Captcha, CaptchaType } from '../../../lib/models/captcha';

interface Props {
    accounts: HarvesterAccount[];
    addAccount: (account: HarvesterAccount) => void;
    deleteAccount: (id: string) => void;
    updateAccount: (account: HarvesterAccount) => void;
}

const Harvester = ({ accounts: accountsProp, addAccount, deleteAccount, updateAccount }: Props) => {
    const [currentAccount, setCurrentAccount] = useState<HarvesterAccount | undefined>();
    const [proxyStr, setProxyStr] = useState('');
    const [proxyError, setProxyError] = useState(false);
    const { BrowserWindow } = remote;
    const [accounts, setAccounts] = useState<HarvesterAccount[]>([]);
    const [captcha, setCaptcha] = useState<Captcha | undefined>();

    useEffect(() => {
        requestCaptcha();
    }, []);

    useEffect(() => {
        setAccounts(accountsProp);
    }, [accountsProp]);

    const onRecaptchaLoaded = (element: any) => {
        if (element && element.captcha && captcha?.version === CaptchaType.reCaptchaInvisible) {
            const rect = element.captcha.getBoundingClientRect();

            const y = Math.floor(rect.top + window.scrollY + 14 + Math.random() * 20);
            const x = Math.floor(rect.left + window.scrollX + 24 + Math.random() * 20);

            click({ x, y });
        }
    };

    const click = (coords: { x: number; y: number }) => {
        const window = remote.getCurrentWindow();

        const sendClick = () => {
            window.webContents.sendInputEvent({ type: 'mouseMove', ...coords });
            window.webContents.sendInputEvent({ type: 'mouseEnter', ...coords });
            window.webContents.sendInputEvent({
                type: 'mouseDown',
                ...coords,
                clickCount: 1,
            });
            window.webContents.sendInputEvent({
                type: 'mouseUp',
                ...coords,
                clickCount: 1,
            });
        };
        window.addListener('focus', () => {
            console.log(`window is now focused`);
            sendClick();
        });
    };

    const onLogin = () => {
        ipcRenderer.invoke(IpcChannel.HarvesterLogin).then((accountToAdd: HarvesterAccount) => {
            Logger.log(`Account recieved ${JSON.stringify(accountToAdd)}`);
            accountToAdd && addAccount(accountToAdd);
        });
    };

    const onDeleteAccount = () => {
        Logger.log(currentAccount?.sessionId);
        currentAccount && deleteAccount(currentAccount.sessionId);
    };

    const onAccountSelected = (sessionId: string) => {
        const account = accounts.find((item: HarvesterAccount) => item.sessionId === sessionId);
        account && setCurrentAccount(account);
    };

    const requestCaptcha = () => {
        ipcRenderer
            .invoke(IpcChannel.HarvesterRequestCaptcha)
            .then((c: Captcha) => {
                setCaptcha(c);
            })
            .catch((err) => {
                Logger.log(`Token request error: ${err}`);
                // try to request another captcha
                requestCaptcha();
            });
    };

    const onCaptchaSolved = (token: string | null) => {
        if (token && captcha) {
            const result = {
                taskId: captcha.taskId,
                token,
                createdAt: Date.now(),
                request: undefined,
            };
            ipcRenderer.send(IpcChannel.HarvesterResult, result);
        } else if (captcha) {
            // failed to solve captcha
            ipcRenderer.send(IpcChannel.HarvesterResult, undefined);
        }
        setCaptcha(undefined);
        requestCaptcha();
    };

    const validateProxy = (proxy: string) => {
        setProxyStr(proxy);
        if (proxy === '' || proxyRegex.test(proxy)) {
            setProxyError(false);
            const account = currentAccount;
            if (account) {
                account.proxy = proxy;
                updateAccount(account);
                // ipcRenderer.invoke(IpcChannel.harvesterSetProxy, proxy);
            }
        } else {
            setProxyError(true);
        }
    };

    const minimizeWindow = () => BrowserWindow.getFocusedWindow()?.minimize();
    const closeWindow = () => BrowserWindow.getFocusedWindow()?.close();

    return (
        <div className="content">
            <div className="top-bar">
                <div className="top-bar-title">Captcha Harvester</div>
                <div className="top-bar-controls">
                    <div role="button" className="top-bar-control minimize-button" onClick={minimizeWindow} />
                    <div role="button" className="top-bar-control close-button" onClick={closeWindow} />
                </div>
            </div>
            <div className="captcha-container">
                {captcha ? (
                    <ReCAPTCHA ref={onRecaptchaLoaded} sitekey={captcha.siteKey} onChange={onCaptchaSolved} />
                ) : (
                    <div className="spinner">
                        <div className="spinner-circle" />
                    </div>
                )}
            </div>

            <div className="options-container">
                <div className="google-account-options">
                    <select
                        className="select reset-box-appearance google-account-select"
                        value={currentAccount?.sessionId || ''}
                        onChange={(e) => onAccountSelected(e.target.value)}>
                        <option value="">Google Account</option>
                        {accounts?.map(({ sessionId, email }) => (
                            <option key={sessionId} value={sessionId}>
                                {email}
                            </option>
                        ))}
                    </select>
                    <div role="button" className="google-account-button add-button" onClick={() => onLogin()}>
                        <div className="add-button-icon" />
                    </div>
                    <div role="button" className="google-account-button delete-button" onClick={() => onDeleteAccount()}>
                        <div className="delete-button-icon" />
                    </div>
                </div>

                <input
                    className={`input reset-box-appearance proxy-input form-control ${proxyError && 'is-invalid'}`}
                    placeholder="Proxy"
                    value={proxyStr}
                    onChange={(e) => validateProxy(e.target.value)}
                />
            </div>
        </div>
    );
};

export default hot(Harvester);
