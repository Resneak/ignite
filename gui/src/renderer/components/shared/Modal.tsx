import * as React from 'react';

interface Props {
    children: any;
    show: boolean;
    onClose: () => void;
}

const Modal = ({ children, show, onClose }: Props) => {
    const classes = show ? 'modal-component modal is-active' : 'modal-component modal';
    return (
        <div className={classes}>
            <div className="modal-background" />
            <div className="modal-content modal-component-modal-content">
                <button
                    key="modalButton"
                    aria-label="close"
                    className="modal-close is-large modal-component-close-button"
                    onClick={onClose}
                />
                {children}
            </div>
        </div>
    );
};

export default Modal;
