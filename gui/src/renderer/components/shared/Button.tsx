import * as React from 'React';

import './Button.scss';

interface Props {
    onClick: () => void;
    className?: string;
    primary?: boolean;
    theme?: string;
    disabled?: boolean;
    icon?: any;
    children?: any;
}

const Button = ({ onClick, className, primary, theme, disabled, icon, children }: Props) => {
    const themeClass = theme ? `button-component-${theme}` : '';
    return (
        <div style={{ display: 'flex' }}>
            <div
                role="button"
                onClick={() => {
                    if (!disabled) onClick();
                }}
                className={`button-component ${className || ''} ${
                    primary ? 'button-component-primary' : ''
                } ${disabled ? 'button-component-disabled' : ''} ${themeClass} ${
                    !icon ? 'button-component-no-icon' : ''
                }`}>
                {icon && <div className="button-component-icon">{icon}</div>}
                <div className="button-component-text">{children}</div>
            </div>
        </div>
    );
};
export default Button;
