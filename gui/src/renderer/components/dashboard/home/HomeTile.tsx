import * as React from 'React';
import './HomeTile.scss';

interface Props {
    isPrimary?: boolean;
    title: string;
    select?: any;
    text: string;
}

const HomeTile = ({ isPrimary, title, select, text }: Props) => {
    const classes = isPrimary ? 'dashboard-tile dashboard-tile-primary' : 'dashboard-tile';
    return (
        <div className={classes}>
            <div className="dashboard-tile-top">
                <div className="dashboard-tile-title">{title}</div>
                {select && <div className="dashboard-tile-select">{select}</div>}
            </div>
            <div className="dashboard-tile-content">{text}</div>
        </div>
    );
};
export default HomeTile;
