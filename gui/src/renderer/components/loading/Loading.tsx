import * as React from 'react';
import loadingGif from '../../../../assets/loading.gif';

import './Loading.scss';

interface Props {
    /** initializer function to execute while the loading screen is showed */
    initializer: () => void;
}

const Loading = ({ initializer }: Props) => {
    initializer();

    return (
        <>
            <div className="radial-glow" />
            <div className="spinner-content" id="spinner-content">
                <img className="spinner" alt="progress spinner" src={loadingGif} />
                <h1 id="spinner">Initialising Application</h1>
            </div>
        </>
    );
};
export default Loading;
