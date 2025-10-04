import * as React from 'React';
import './Toggle.scss';

interface Props {
    value: boolean;
    setValue: (newValue: boolean) => void;
}

const Toggle = ({ value, setValue }: Props) => {
    return (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div onClick={(e) => e.stopPropagation()} role="button">
                <label className="switch">
                    <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => setValue(e.target.checked)}
                    />
                    <span className="slider round" />
                </label>
                <span className="switch-label-profile" />
            </div>
        </div>
    );
};
export default Toggle;
