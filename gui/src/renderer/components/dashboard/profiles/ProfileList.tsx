import * as React from 'react';
import { remote } from 'electron';
import * as fs from 'fs';

import Profile from '../../../../../../lib/models/profile';

import ProfileItem from './ProfileItem';

import newTaskSVG from '../../../../../assets/svg/newTaskGreen.svg';
import importTaskSVG from '../../../../../assets/svg/importTask.svg';
import exportTaskSVG from '../../../../../assets/svg/exportTask.svg';
import binSVG from '../../../../../assets/svg/bin.svg';
import Logger from '../../../../main/logger';

interface Props {
    addProfile: Function;
    currentProfileID: string;
    deleteProfile: Function;
    initiateCreate: Function;
    profileList: Profile[] | undefined;
    toggleOneCheckout: Function;
    toggleActive: Function;
}

const ProfileList = ({ addProfile, currentProfileID, deleteProfile, initiateCreate, profileList, toggleOneCheckout, toggleActive }: Props) => {
    const { dialog } = remote;

    const onDelete = () => {
        toggleActive();
        deleteProfile(currentProfileID);
    };

    const importProfiles = async () => {
        const { filePaths, canceled } = await dialog.showOpenDialog({
            buttonLabel: 'Import',
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'JSON Files', extensions: ['json'] }],
            title: 'Import Profiles',
        });
        if (canceled) return;
        filePaths.forEach((filePath) => {
            let data = '';
            fs.createReadStream(filePath, 'utf8')
                .on('data', (chunk) => {
                    data += chunk;
                })
                .on('error', (err) => {
                    Logger.info(`Error reading profiles from file ${err}`);
                })
                .on('end', () => {
                    const jsonProfiles = JSON.parse(data);
                    jsonProfiles.forEach((item: Profile) => {
                        const profile = new Profile(item);
                        addProfile(profile);
                    });
                });
        });
    };

    const exportProfiles = async () => {
        const { filePath, canceled } = await dialog.showSaveDialog({
            title: 'Export Profiles',
            buttonLabel: 'Export',
            defaultPath: 'profiles.json',
            properties: ['createDirectory', 'showOverwriteConfirmation'],
            filters: [{ name: 'JSON Files', extensions: ['json'] }],
        });
        if (canceled) return;
        if (filePath) {
            fs.writeFile(filePath, JSON.stringify(profileList), (err) => {
                if (err) {
                    Logger.log(`Error writing profile: ${err}`);
                }
            });
        }
    };

    return (
        <div>
            <div className="task-top-bar profiles-top">
                <span className="ml-75rem font-weight-bold">Profile List</span>
                <div className="flex-grow-1" />
                <div className="task-option width-100px" id="import-profile" role="button" onClick={() => importProfiles()}>
                    <img className="task-top-controls" alt="Import" src={importTaskSVG} />
                    Import
                </div>
                <div className="task-option mr-75rem width-100px" id="export-profile" role="button" onClick={() => exportProfiles()}>
                    <img className="task-top-controls" alt="Export" src={exportTaskSVG} />
                    Export
                </div>
            </div>
            <div className="task-top-bar border-radius-0 bg-transparent">
                <div className="columns is-vcentered profile-content bg-transparent width-100per mb-0 h-60px">
                    <div className="column font-weight-bold">Profile</div>
                    <div className="column is-4 font-weight-bold">One Checkout</div>
                </div>
            </div>
            <div className="task-table-rows" id="profile-items">
                {profileList?.map((profile: Profile) => (
                    <ProfileItem
                        key={profile.id}
                        active={profile.id === currentProfileID}
                        profile={profile}
                        toggleOneCheckout={() => toggleOneCheckout(profile.id)}
                        toggleActive={() => toggleActive(profile.id)}
                    />
                ))}
            </div>
            <div className="task-top-bar profiles-top border-radius-0 mt-1rem">
                <div className="flex-grow-1" />
                <div className="task-option green mr-75rem width-100px" id="create-profile" role="button" onClick={() => initiateCreate()}>
                    <img className="task-top-controls" alt="New" src={newTaskSVG} />
                    Create
                </div>
                <div
                    role="button"
                    onClick={() => onDelete()}
                    className={!currentProfileID ? 'task-option disabled-button mr-75rem width-100px' : 'task-option mr-75rem width-100px'}
                    id="delete-profile">
                    <img className="task-top-controls" alt="Delete" src={binSVG} />
                    Delete
                </div>
            </div>
        </div>
    );
};
export default ProfileList;
