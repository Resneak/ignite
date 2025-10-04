import * as React from 'react';
import { useEffect, useState } from 'react';
import { ipcRenderer } from 'electron';
import './Updater.scss';
import IpcChannel from '../../../main/ipc';
import Logger from '../../../main/logger';
import { UpdateProgress, UpdateStatus } from '../../../lib/models/update';

const Updater = () => {
    const [status, setStatus] = useState({ progress: UpdateProgress.Checking } as UpdateStatus);

    useEffect(() => {
        // listen for update status events
        ipcRenderer.on(IpcChannel.UpdateStatus, (_, s: UpdateStatus) => {
            Logger.info(`updater: ${UpdateProgress[s.progress]} - ${s.description}`);
            setStatus(s);
            if (s.progress === UpdateProgress.Done) ipcRenderer.send(IpcChannel.UpdateDone);
        });
        // get initial update status
        ipcRenderer.send(IpcChannel.UpdateStatus);
    }, []);

    const retry = () => ipcRenderer.send(IpcChannel.UpdateCheck);

    return (
        <div className="page">
            <div className="title-bar">Ignite Updater</div>
            <div className="content">
                <div className="logo" />
                <div className="status">{status.description}</div>
                {status.progress === UpdateProgress.Error && (
                    <button className="retry-button" onClick={retry}>
                        Retry
                    </button>
                )}
            </div>
        </div>
    );
};

export default Updater;
