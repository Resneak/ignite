import * as React from 'React';
import { useEffect, useState } from 'react';

import './Fade.scss';

interface Props {
    show: boolean;
    children: any;
}

const Fade = ({ show, children }: Props) => {
    const [shouldRender, setRender] = useState(show);

    useEffect(() => {
        if (show) setRender(true);
    }, [show]);

    const onAnimationEnd = () => {
        if (!show) setRender(false);
    };

    return shouldRender ? (
        <div
            style={{ animation: `${show ? 'fadeIn' : 'fadeOut'} 0.5s` }}
            onAnimationEnd={onAnimationEnd}>
            {children}
        </div>
    ) : null;
};

export default Fade;
