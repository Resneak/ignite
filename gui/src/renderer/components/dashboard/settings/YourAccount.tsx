import * as React from 'React';
import { useState } from 'react';
import currencies from '../../../../lib/data/currencies';
import Currency from '../../../../../../lib/models/currency';
import Logger from '../../../../main/logger';
import DropDown from '../../shared/DropDown/DropDown';

const defaultProfilePicture = '../../../../../assets/svg/defaultProfilePicture.svg';

interface Props {
    currency: Currency;
    updateCurrency: (currency: Currency) => void;
    profilePicture?: string;
    username?: string;
}

const YourAccount = ({ currency, updateCurrency, profilePicture, username }: Props) => {
    const [profilePic, setDefaultProfilePic] = useState(profilePicture);

    return (
        <div className="column is-7 max-width-650">
            <div className="bg4">
                <div className="stats-header">
                    <span className="stat-1 light-b">Your Account</span>
                    <div className="flex-grow-1" />
                </div>
                <div className="stats-header font-size-1">
                    <div className="flex-grow-1" />
                    <span className="stat-1 mb-0 width-135 ml-25px">Currency Type</span>
                </div>
                <div className="stats-header align-items-center">
                    <div className="d-inline-flex cursor-pointer p-10px border-radius-5px">
                        <div style={{ margin: 'auto' }}>
                            <figure className="image is-128x128 width-40px height-40px m-auto">
                                <img
                                    id="profile-photo2"
                                    className="is-rounded"
                                    alt="Profile Pic"
                                    onError={() => setDefaultProfilePic(defaultProfilePicture)}
                                    src={profilePic}
                                />
                            </figure>
                        </div>
                        <div className="text-left ml-10px line-h-12 font-size-1">
                            <span id="profile-username2" className="d-block font-weight-bold">
                                {username ?? ''}
                            </span>
                            <span className="light-b d-block">Discord Account</span>
                        </div>
                    </div>
                    <div className="flex-grow-1" />
                    <DropDown
                        value={currency.code}
                        onChange={(code: string) => {
                            Logger.info(code);
                            const selectedCurrency = currencies.find((c) => c.code === code);
                            if (selectedCurrency) updateCurrency(selectedCurrency);
                        }}
                        options={currencies.map((c) => c.code)}
                    />
                </div>
            </div>
        </div>
    );
};
export default YourAccount;
