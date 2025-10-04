import * as React from 'React';
import { UpdateInfo } from 'electron-updater';
import { remote } from 'electron';
import Modal from '../../../shared/Modal';
import './UpdateModal.scss';

const { app } = remote;

interface Props {
    updateInfo?: UpdateInfo;
    show: boolean;
    onHide: () => void;
}

const UpdateModal = ({ updateInfo, show, onHide }: Props) => {
    const performUpdate = () => {
        app.relaunch();
        app.exit();
    };

    return (
        <Modal show={show} onClose={onHide}>
            <p className="update-modal-component-title">{updateInfo ? 'Update Available' : 'No Update Available'}</p>

            <p className="update-modal-component-description">
                {updateInfo && (
                    <>
                        {`An update to version ${updateInfo.version} is available and will be installed upon restart.`}
                        <br />
                    </>
                )}
                {updateInfo ? `${updateInfo?.releaseNotes || 'No changelog was provided for this update.'}` : 'Currently up to date'}
            </p>

            <div className="update-modal-component-buttons">
                <button className="update-modal-component-button" onClick={onHide}>
                    {updateInfo ? 'Ignore' : 'Close'}
                </button>
                {updateInfo && (
                    <button className="update-modal-component-button update-modal-component-button-primary" onClick={performUpdate}>
                        Restart Ignite
                    </button>
                )}
            </div>
        </Modal>
    );
};

export default UpdateModal;
