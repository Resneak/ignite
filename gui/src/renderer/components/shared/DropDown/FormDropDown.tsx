import * as React from 'React';
import { useEffect, useState } from 'react';
import { FormContext, Register } from '../../../../lib/models/inputElement';
import DropDown from './DropDown';

interface Props {
    name: string;
    options: string[];
    defaultValue: string;
    formContext: FormContext;
    disabled?: boolean;
    isModalDropDown?: boolean;
    register: Register;
    ErrorMessage?: any;
}

const FormDropDown = ({ name, options, defaultValue, formContext, disabled, isModalDropDown, register, ErrorMessage }: Props) => {
    const watchValue = formContext.watch(name);
    const [value, updateValue] = useState(watchValue);

    const handleChange = (newValue: string) => {
        formContext.setValue(name, newValue);
    };

    useEffect(() => {
        handleChange(defaultValue);
    }, [defaultValue]);

    useEffect(() => {
        if (value !== watchValue) {
            updateValue(watchValue || defaultValue);
        }
    }, [watchValue]);

    useEffect(() => {
        formContext.register({ name, type: 'custom' }, register);
        return () => {
            handleChange(defaultValue);
            return formContext.unregister(name);
        };
    }, [name, formContext.register, formContext.unregister]);

    useEffect(() => {
        if (!!value && formContext.clearError) {
            formContext.clearError(name);
        }
    }, [value]);

    return (
        <>
            <DropDown
                disabled={disabled}
                error={!!formContext.errors[`${name}`]}
                isModalDropDown={isModalDropDown}
                options={options}
                value={value || defaultValue}
                onChange={handleChange}
            />
            {ErrorMessage && ErrorMessage}
        </>
    );
};

export default FormDropDown;
