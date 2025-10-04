import * as React from 'React';
import { useEffect, useState } from 'react';

import ProfileForm from './ProfileForm';
import ProfileList from './ProfileList';

import Profile from '../../../../../../lib/models/profile';

import './Profiles.scss';

interface Props {
    profiles: Profile[];
    addProfile: (profile: Profile) => void;
    deleteProfile: (id: string) => void;
    updateProfile: (profile: Profile) => void;
}

const Profiles = ({ profiles, addProfile, deleteProfile, updateProfile }: Props) => {
    const [focus, initiateFocus] = useState<boolean>(false);
    const [currentProfile, setCurrentProfile] = useState<Profile | undefined>();
    const [currentProfileID, setCurrentProfileID] = useState<string>('');

    // Set current profile using current profile id
    useEffect(() => {
        const cur = profiles?.find((profile: Profile) => profile.id === currentProfileID);
        cur !== undefined ? setCurrentProfile(cur) : setCurrentProfile(undefined);
    }, [currentProfileID]);

    const toggleOneCheckout = (id: string) => {
        const profile = profiles.find((item) => item.id === id);
        if (profile) {
            profile.singleCheckout = !profile.singleCheckout;
            updateProfile(profile);
        }
    };

    const toggleActive = (id: string) => {
        currentProfileID === id ? setCurrentProfileID('') : setCurrentProfileID(id);
    };

    return (
        <div className="content-box" id="profiles">
            <div className="content-block">
                <div className="profiles-flex-container pb-4">
                    <div className="columns profile-columns pb-5">
                        <div className="column">
                            <ProfileForm
                                addProfile={addProfile}
                                updateProfile={updateProfile}
                                currentProfile={currentProfile}
                                focus={focus}
                                toggleActive={toggleActive}
                            />
                        </div>

                        <div className="column is-one-third profile-columns">
                            <ProfileList
                                addProfile={addProfile}
                                currentProfileID={currentProfileID}
                                deleteProfile={deleteProfile}
                                initiateCreate={() => {
                                    initiateFocus(!focus);
                                }}
                                profileList={profiles}
                                toggleOneCheckout={toggleOneCheckout}
                                toggleActive={toggleActive}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default Profiles;
