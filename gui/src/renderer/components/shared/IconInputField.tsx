import * as React from 'react';
import { IconType } from 'react-icons/lib';

interface Props {
    icon: IconType;
    children: any;
}

const IconInput = (props: Props) => {
    return (
        <div className="input-group">
            <div className="input-group-prepend">
                <div className="input-group-text">
                    <props.icon />
                </div>
            </div>
            {props.children}
        </div>
    );
};

export default IconInput;
