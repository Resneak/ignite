import * as React from 'React';
import { useState } from 'react';
import './Settings.scss';
import { UpdateCheckResult, UpdateInfo } from 'electron-updater';
import { ipcRenderer, remote } from 'electron';
import { DateTime } from 'luxon';

import Updates from './Updates';
import UpdateModal from './update-modal/UpdateModal';
import IpcChannel from '../../../../main/ipc';
import Logger from '../../../../main/logger';
import YourAccountContainer from './YourAccountContainer';
import YourKeyContainer from './YourKeyContainer';
import IntegrationsContainer from './IntegrationsContainer';

const { app } = remote;

const Settings = () => {
    const updated = DateTime.local().toLocaleString({
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });

    const [updateInfo, setUpdateInfo] = useState<UpdateInfo>();
    const [showUpdateModal, setShowUpdateModal] = useState(false);

    const checkForUpdates = () => {
        Logger.info('manually checking for updates');
        const updateResultListener = (_: any, updateCheckResult: UpdateCheckResult) => {
            Logger.info(updateCheckResult);
            if (updateCheckResult !== null) {
                Logger.info(updateCheckResult.updateInfo.version);

                if (app.getVersion() === updateCheckResult.updateInfo.version) setUpdateInfo(updateCheckResult.updateInfo);
                setShowUpdateModal(true);
            }
        };
        ipcRenderer.removeAllListeners(IpcChannel.UpdateCheck); // make sure to only add 1 listener every time
        ipcRenderer.on(IpcChannel.UpdateCheck, updateResultListener);
        ipcRenderer.send(IpcChannel.UpdateCheck);
    };

    return (
        <div className="content-box" id="settings">
            <div className="columns checkout-stats">
                <YourAccountContainer />
                <YourKeyContainer />
            </div>
            <div className="columns checkout-history">
                <Updates updated={updated} version={app.getVersion()} onCheckForUpdates={checkForUpdates} />
                <IntegrationsContainer />
            </div>
            <UpdateModal updateInfo={updateInfo} show={showUpdateModal} onHide={() => setShowUpdateModal(false)} />
        </div>
    );
};

export default Settings;
