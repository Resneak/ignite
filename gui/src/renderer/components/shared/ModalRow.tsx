import * as React from 'React';
import { useEffect, useState } from 'react';
import './ModalRow.scss';

interface Props {
    firstChildLabel: string;
    secondChildLabel?: string;
    children: any;
}

const ModalRow = ({ firstChildLabel, secondChildLabel, children }: Props) => {
    const [firstChild, setFirstChild] = useState();
    const [secondChild, setSecondChild] = useState();

    useEffect(() => {
        if (Array.isArray(children)) {
            setFirstChild(children[0]);
            setSecondChild(children[1]);
        } else {
            setFirstChild(children);
        }
    }, [children]);

    return (
        <div className="columns form-component-row">
            <div className="column" key={firstChildLabel}>
                <div className="form-component-label">{firstChildLabel}</div>
                <div className="field">
                    <div className="control">{firstChild}</div>
                </div>
            </div>
            {secondChild && (
                <div className="column" key={secondChildLabel}>
                    <div className="form-component-label">{secondChildLabel}</div>
                    <div className="field">
                        <div className="control">{secondChild}</div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default ModalRow;
