import { shell } from 'electron';
import { DateTime } from 'luxon';
import * as React from 'React';
import LicenseKey from '../../../../../../lib/models/licenseKey';

interface Props {
    license?: LicenseKey;
}

const openExternalDashboard = () => shell.openExternal('https://www.ignitebot.io/dashboard');

const YourKey = ({ license }: Props) => {
    return (
        <div className="column">
            <div className="bg5">
                <div className="stats-header">
                    <span className="stat-1 light-r">Your Key</span>
                    <div className="flex-grow-1" />
                </div>
                <div className="stats-header font-size-1">
                    <span id="typeCard" className="stat-1">
                        <span className="light-r">Your key type: </span>
                        <span id="type-card-key-type">{license ? LicenseKey.getType(license.type) : ''}</span>
                    </span>
                    <div className="flex-grow-1" />
                    <span id="expiresCard" className="stat-1">
                        <span className="light-r">Expiration Date: </span>
                        <span id="expires-card-expiration-date">
                            {license ? DateTime.fromJSDate(new Date(license.expirationDate)).toLocaleString() : ''}
                        </span>
                    </span>
                </div>
                <div className="license-box">
                    <span id="license-display" className="license-display">
                        {license?.key}
                    </span>
                    <div className="flex-grow-1" />
                    <button
                        className="task-option profile-save add-new height-40px w-auto mb-0 px-20px open-dahsboard-btn"
                        onClick={openExternalDashboard}
                        id="renew-license">
                        <img className="task-top-controls" src="../../../../../assets/svg/newTask.svg" alt="open" />
                        Open Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
};
export default YourKey;
