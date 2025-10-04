import * as React from 'React';
import './Input.scss';
import { FormContext, InputType, Register } from '../../../lib/models/inputElement';
import FormDropDown from './DropDown/FormDropDown';

interface Props {
    formContext: FormContext;
    inputType: InputType;
    name: string;
    placeholder: string;
    register: Register;
    options?: string[];
    disabled?: boolean;
    errorMessage?: any;
}

const Input = ({
    formContext,
    inputType,
    name,
    placeholder,
    register,
    options,
    disabled,
    errorMessage,
}: Props) => {
    if (inputType === InputType.Text) {
        return (
            <div>
                <input
                    className={`input form-component-input form-control ${
                        formContext.errors[`${name}`] ? 'is-invalid' : 'valid'
                    }`}
                    placeholder={placeholder}
                    name={name}
                    ref={formContext.register(register)}
                />
                <div className="position-absolute">{errorMessage}</div>
            </div>
        );
    }
    // Dropdown
    return (
        <FormDropDown
            name={name}
            options={options || ['']}
            defaultValue={placeholder}
            formContext={formContext}
            disabled={disabled}
            isModalDropDown
            register={register}
            ErrorMessage={errorMessage}
        />
    );
};
export default Input;
