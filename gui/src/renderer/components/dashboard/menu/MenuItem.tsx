import * as React from 'React';
import { NavLink } from 'react-router-dom';

import './MenuItem.scss';

interface Props {
    text: string;
    children: any;
    route: string;
    exactRoute?: boolean;
}

const MenuItem: React.FC<Props> = (props: Props) => {
    return (
        <NavLink
            style={{ color: 'inherit', textDecoration: 'inherit' }}
            exact={props.exactRoute}
            to={props.route}
            activeClassName="selected"
            className="nav-option">
            {props.children}
            {props.text}
        </NavLink>
    );
};

export default MenuItem;
