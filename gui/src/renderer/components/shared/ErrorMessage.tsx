import * as React from 'react';

import './ErrorMessage.scss';

interface Props {
    errors: Record<string, any>;
    inputName: string;
}

export const ErrorMessageComp = ({ errors, inputName }: Props) => {
    return <div className="text-danger error">{errors[`${inputName}`].message}</div>;
};

const Wrapper = (errors: Record<string, any>, inputName: string) => {
    const show = errors[`${inputName}`];
    return show ? <ErrorMessageComp errors={errors} inputName={inputName} /> : <></>;
};
export default Wrapper;
