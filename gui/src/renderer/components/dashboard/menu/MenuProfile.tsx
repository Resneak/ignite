import * as React from 'React';
import { useState } from 'react';
import './MenuProfile.scss';

import defaultProfilePicture from '../../../../../assets/svg/defaultProfilePicture.svg';

interface Props {
    profilePicture?: string;
    username?: string;
    licenseType?: string;
}

const MenuProfile: React.FC<Props> = ({ profilePicture, username, licenseType }: Props) => {
    const [profilePic, setDefaultProfilePic] = useState(profilePicture);

    return (
        <div className="nav-user-profile">
            <div>
                <img
                    id="profile-photo"
                    alt="User avatar"
                    className="nav-user-profile-image"
                    onError={() => setDefaultProfilePic(defaultProfilePicture)}
                    src={profilePic}
                />
            </div>
            <div className="nav-user-profile-right">
                <span id="profile-username" className="nav-user-profile-username">
                    {username ?? ''}
                </span>
                <span id="profile-type" className="nav-user-profile-type">
                    {licenseType ?? ''}
                </span>
            </div>
        </div>
    );
};

export default MenuProfile;
