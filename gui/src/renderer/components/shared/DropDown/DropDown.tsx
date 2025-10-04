import * as React from 'React';
import { useEffect, useRef, useState } from 'react';
import './DropDown.scss';

interface Props {
    value: string;
    onChange: (value: string) => void;
    options: string[];
    isModalDropDown?: boolean;
    disabled?: boolean;
    error?: boolean;
}

function useOuterClick(callback: Function) {
    const innerRef: any = useRef();
    const callbackRef: any = useRef();

    // set current callback in ref, before second useEffect uses it
    useEffect(() => {
        // useEffect wrapper to be safe for concurrent mode
        callbackRef.current = callback;
    });

    useEffect(() => {
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);

        // read most recent callback and innerRef dom node from refs
        function handleClick(e: any) {
            if (innerRef.current && callbackRef.current && !innerRef.current.contains(e.target)) {
                callbackRef.current(e);
            }
        }
    }, []); // no need for callback + innerRef dep

    return innerRef; // return ref; client can omit `useRef`
}

const DropDown = ({ value, onChange, options, isModalDropDown, disabled, error }: Props) => {
    const [isActive, toggleActive] = useState(false);

    // close drop-down when if user clicks outside of it
    const innerRef = useOuterClick(() => {
        toggleActive(false);
    });

    let classnames = `dropdown ${isActive && 'is-active'} ${error && 'form-control is-invalid p-0 bg-transparent'} }`;
    if (isModalDropDown) {
        classnames += ' inModal';
    }

    return (
        <div className={classnames} style={{ marginLeft: '25px' }} ref={innerRef}>
            <div className={`dropdown-trigger `}>
                <button aria-haspopup="true" className="button" disabled={disabled} type="button" onClick={() => toggleActive(!isActive)}>
                    <span id="dropdown-holder">{value}</span>
                    <div style={{ flex: '1' }} />
                    <span className={`icon is-small ${error && 'mr-3'}`}>
                        <svg
                            aria-hidden="true"
                            className="svg-inline--fa fa-angle-down fa-w-10"
                            data-fa-i2svg=""
                            data-icon="angle-down"
                            data-prefix="fas"
                            role="img"
                            viewBox="0 0 320 512"
                            xmlns="http://www.w3.org/2000/svg">
                            <path
                                d="M143 352.3L7 216.3c-9.4-9.4-9.4-24.6 0-33.9l22.6-22.6c9.4-9.4 24.6-9.4 33.9 0l96.4 96.4 96.4-96.4c9.4-9.4 24.6-9.4 33.9 0l22.6 22.6c9.4 9.4 9.4 24.6 0 33.9l-136 136c-9.2 9.4-24.4 9.4-33.8 0z"
                                fill="currentColor"
                            />
                        </svg>
                    </span>
                </button>
            </div>
            <div className="dropdown-menu" role="menu">
                <div className="dropdown-content">
                    {options.map((option) => (
                        <div
                            role="option"
                            aria-selected={value === option}
                            className="dropdown-item"
                            key={option}
                            onClick={() => {
                                onChange(option);
                                toggleActive(!isActive);
                            }}>
                            {option}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
export default DropDown;
