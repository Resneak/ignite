import * as React from 'React';

interface Props {
    updated: string;
    version: string;
    onCheckForUpdates: () => void;
}

const Updates = ({ updated, version, onCheckForUpdates }: Props) => {
    return (
        <div className="column is-7 max-width-650 z-i-1">
            <span>System</span>
            <div className="bg5 settings-system-tile">
                <div className="settings-app-icon" />
                <div className="settings-update-info">
                    <div className="settings-version-text">
                        {'Ignite Version '}
                        <span className="settings-version-number">{version}</span>
                    </div>
                    <div className="settings-update-time">Last checked on {updated}</div>
                </div>
                <button
                    id="settings-update-check-button"
                    className="settings-update-check-button"
                    onClick={onCheckForUpdates}>
                    Check for Updates
                </button>
            </div>
        </div>
    );
};
export default Updates;
