import { remote } from 'electron';
import * as React from 'react';

import Discord from '../../../../../lib/models/discord';
import LicenseKey from '../../../../../lib/models/licenseKey';
import UserAccount from '../../../../../lib/models/user';
import Logger from '../../../main/logger';
import { genUuid } from '../../helpers';
import { authenticate } from '../../services/auth';
import './License.scss';

type OnLogin = (user: UserAccount) => void;

interface Props {
    onLogin: OnLogin;
}

const License = ({ onLogin }: Props) => {
    const [licenseKey, setLicenseKey] = React.useState<string>();
    const [errorMsg, setErrorMsg] = React.useState<string>();

    const auth = async () => {
        if (licenseKey == null) return;

        const response: any = await authenticate(licenseKey);

        try {
            if (response.status === 'success') {
                // TODO: what to do with response.hwid ?
                const user = new UserAccount({
                    id: genUuid(),
                    discord: new Discord({
                        username: response.user.username,
                        profilePicture: response.user.picture,
                    }),
                    license: new LicenseKey({
                        key: response.user.key,
                        expirationDate: LicenseKey.parseExpirationDate(response.user.expiration),
                        type: LicenseKey.parseType(response.user.type),
                    }),
                });
                onLogin(user);
            } else if (response.status === 'fail') {
                setErrorMsg(response.reason);
            } else {
                setErrorMsg('Our servers are having trouble, please try again later!');
            }
        } catch (ex) {
            Logger.error('failed to authenticate user');
            Logger.error(ex);
            Logger.info(response);
            setErrorMsg('Something went wrong, please try again later!');
        }
    };

    return (
        <div className="main-content">
            <div className="content-box" id="login-content">
                <div className="columns login">
                    <div className="column login form">
                        <span>Login to your account</span>
                        {errorMsg && (
                            <span className="text-danger text-left" id="auth-error">
                                {errorMsg}
                            </span>
                        )}
                        <span className="license-text">License Key</span>
                        <div className="mb-5">
                            <input
                                className="license-input"
                                id="licenseInput"
                                placeholder="Enter Your License..."
                                onChange={(e) => setLicenseKey(e.target.value)}
                            />
                            <button className="button discord-login" id="login" onClick={auth} disabled={!licenseKey}>
                                <span>Sign In</span>
                            </button>
                        </div>
                        <span id="auth-app-version">{`IGNITE ${remote.app.getVersion()}`}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default License;
