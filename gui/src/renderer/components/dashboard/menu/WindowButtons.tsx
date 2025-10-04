import * as React from 'React';
import { remote } from 'electron';
import './WindowButtons.scss';

const { BrowserWindow } = remote;

const minimizeWindow = () => BrowserWindow.getFocusedWindow()?.minimize();
const closeWindow = () => BrowserWindow.getFocusedWindow()?.close();

const WindowButtons: React.FC = () => {
    return (
        <div className="nav-control-buttons">
            <div className="nav-control-button nav-control-minimize" role="button" onClick={minimizeWindow} />
            <div className="nav-control-divider" />
            <div className="nav-control-button nav-control-close" role="button" onClick={closeWindow} />
        </div>
    );
};

export default WindowButtons;
