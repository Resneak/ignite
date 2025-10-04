import * as React from 'React';

import MenuItem from './MenuItem';
import Routes from '../../Routes';
import WindowButtons from './WindowButtons';

import './Menu.scss';

import logoGold from '../../../../../assets/svg/logoGold.svg';
import dashboardIcon from '../../../../../assets/svg/dashboardIcon.svg';
import taskIcon from '../../../../../assets/svg/taskIcon.svg';
import profileIcon from '../../../../../assets/svg/profileIcon.svg';
import proxiesIcon from '../../../../../assets/svg/proxiesIcon.svg';
import settingsIcon from '../../../../../assets/svg/settingsIcon.svg';
import MenuProfileContainer from './MenuProfileContainer';

const Menu: React.FC = () => {
    return (
        <nav aria-label="main navigation" className="navbar active">
            <div className="nav-title-box" style={{ alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                <img className="nav-logo" alt="Ignite Bot" src={logoGold} />

                <MenuItem exactRoute={true} route={Routes.root} text="Dashboard">
                    <img className="nav-item" alt="Dashboard" src={dashboardIcon} />
                </MenuItem>

                <MenuItem route={Routes.tasks} text="Tasks">
                    <img className="nav-item" alt="Tasks" src={taskIcon} />
                </MenuItem>

                <MenuItem route={Routes.profiles} text="Profiles">
                    <img className="nav-item" alt="Profiles" src={profileIcon} />
                </MenuItem>

                <MenuItem route={Routes.proxies} text="Proxies">
                    <img className="nav-item" alt="Proxies" src={proxiesIcon} />
                </MenuItem>

                <MenuItem route={Routes.settings} text="Settings">
                    <img className="nav-item" alt="Settings" src={settingsIcon} />
                </MenuItem>

                <div style={{ flexGrow: 1 }} />

                <MenuProfileContainer />

                <WindowButtons />
            </div>
        </nav>
    );
};

export default Menu;
