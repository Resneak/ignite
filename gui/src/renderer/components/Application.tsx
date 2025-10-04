import { hot } from 'react-hot-loader/root';
import * as React from 'react';

import Dashboard from './dashboard/Dashboard';

import './Application.scss';
import UserAccount from '../../../../lib/models/user';
import License from './license/License';
import { authenticate } from '../services/auth';
import Loading from './loading/Loading';

interface Props {
    account?: UserAccount;
    login: (user: UserAccount) => void;
    logout: () => void;
}

const Application = ({ account, login, logout }: Props) => {
    const [isAuthenticated, setIsAuthenticated] = React.useState(false);

    // this function updates the redux store with the current user & shows the dashboard
    const loginSuccess = (user: UserAccount) => {
        login(user);
        setIsAuthenticated(true);
    };

    if (account) {
        if (isAuthenticated) return <Dashboard />;

        return (
            <Loading
                initializer={async () => {
                    const res: any = await authenticate(account.license.key);

                    if (res.status !== 'success') {
                        logout();
                    } else {
                        setIsAuthenticated(true);
                    }
                }}
            />
        );
    }

    return <License onLogin={loginSuccess} />;
};

export default hot(Application);
