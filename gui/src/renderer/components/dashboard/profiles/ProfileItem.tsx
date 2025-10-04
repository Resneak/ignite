import * as React from 'React';

import Profile from '../../../../../../lib/models/profile';

import Toggle from '../../shared/Toggle';

interface Props {
    profile: Profile;
    toggleOneCheckout: Function;
    toggleActive: Function;
    active: boolean;
}

const ProfileItem = ({ profile, toggleOneCheckout, toggleActive, active }: Props) => {
    const cardNum = profile.payment.number;
    const last4Digits = cardNum.slice(cardNum.length - 4);
    return (
        <div className="profile-item">
            <div
                role="button"
                className={active ? 'columns is-vcentered profile-content extra selected' : 'columns is-vcentered profile-content extra'}
                onClick={() => toggleActive()}>
                <div className="column">
                    <span className="d-block">{profile.name}</span>
                    <span className="d-block">{`CARD ${last4Digits}`}</span>
                </div>
                <div className="column is-4">
                    <Toggle value={profile.singleCheckout} setValue={() => toggleOneCheckout()} />
                </div>
            </div>
        </div>
    );
};
export default ProfileItem;
