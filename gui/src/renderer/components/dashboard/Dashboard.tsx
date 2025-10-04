import * as React from 'React';
import { HashRouter, Route, Switch } from 'react-router-dom';

import Menu from './menu/Menu';
import ProxyListsContainer from './proxies/ProxyListsContainer';
import ProfileListContainer from './profiles/ProfileListContainer';
import Settings from './settings/Settings';
import TasksContainer from './tasks/TasksContainer';
import Home from './home/Home';

import './Dashboard.scss';

import Routes from '../Routes';

const Dashboad: React.FC = () => {
    return (
        <HashRouter>
            <div className="radial-glow" />
            <div className="main-content">
                <Menu />
                <div className="content-box dashboard-page-content-box" id="dashboard">
                    <div className="dashboard-page-react-container" id="dashboard-page-react-container">
                        <Switch>
                            <Route exact path={Routes.root} component={Home} />
                            <Route path={Routes.tasks} component={TasksContainer} />
                            <Route path={Routes.proxies} component={ProxyListsContainer} />
                            <Route path={Routes.profiles} component={ProfileListContainer} />
                            <Route path={Routes.settings} component={Settings} />
                        </Switch>
                    </div>
                </div>
            </div>
        </HashRouter>
    );
};
export default Dashboad;
