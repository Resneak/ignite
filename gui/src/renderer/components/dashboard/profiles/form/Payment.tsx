import * as React from 'React';
import { useEffect, useState } from 'react';
import ErrorMessage, { ErrorMessageComp } from '../../../shared/ErrorMessage';
import { creditCardRegex, cvvRegex } from '../../../../helpers/constants';
import { FormContext, InputType } from '../../../../../lib/models/inputElement';
import Input from '../../../shared/Input';

interface Props {
    formContext: FormContext;
    children: any;
}

const Payment = ({ formContext, children }: Props) => {
    const expirationDate = formContext.watch('expiration');
    const [prevExpLen, setPrevExpLen] = useState(expirationDate?.length || 0);

    useEffect(() => {
        const expDateLen = expirationDate?.length || 0;
        if (prevExpLen === 1 && expDateLen === 2) {
            formContext.setValue('expiration', `${expirationDate}/`);
        }
        setPrevExpLen(expDateLen);
    }, [expirationDate]);

    const now: Date = new Date();
    const month = now.getMonth();
    const year = now.getFullYear() % 100;
    const maxYear = year + 10;
    const format = /^(\d{2})\/(\d{2})$/;

    const validateExpiration = (expiration: string) => {
        const [, expMonthString, expYearString] = expiration.match(format) || [];
        if (!expMonthString || !expYearString) {
            return 'Invalid expiration';
        }
        const expMonth = parseInt(expMonthString, 10);
        const expYear = parseInt(expYearString, 10);
        if (expYear < year || expYear > maxYear) {
            return 'Invalid expiration';
        }
        if (expYear === year && expMonth < month) {
            return 'Invalid expiration';
        }
        return true;
    };

    return (
        <div className="profile-billing">
            <div className="columns profile-forms">
                <div className="column is-2 prof-head">
                    <span className="profile-section-header">Payment</span>
                </div>
                <div className="column">
                    <div>
                        <div className="columns double-profile-field">
                            <div className="column left">
                                <span className="profile-field-header">Card Number</span>
                                <div className="field">
                                    <div className="control">
                                        <Input
                                            formContext={formContext}
                                            inputType={InputType.Text}
                                            name="number"
                                            placeholder="Card Number"
                                            register={{
                                                required: 'Card number required',
                                                pattern: {
                                                    value: creditCardRegex,
                                                    message: 'Invalid card number',
                                                },
                                            }}
                                        />
                                        {ErrorMessage(formContext.errors, 'number')}
                                    </div>
                                </div>
                                <div className="columns double-profile-field">
                                    <div className="column left">
                                        <span className="profile-field-header">Expiration Date</span>
                                        <div className="field">
                                            <div className="control">
                                                <Input
                                                    formContext={formContext}
                                                    inputType={InputType.Text}
                                                    name="expiration"
                                                    placeholder="MM/YY"
                                                    register={{
                                                        required: 'Expiration required',
                                                        validate: (exp: string) => {
                                                            return validateExpiration(exp);
                                                        },
                                                    }}
                                                />
                                                {formContext.errors.expiration && (
                                                    <div className="position-absolute">
                                                        <ErrorMessageComp errors={formContext.errors} inputName="expiration" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="column right">
                                        <span className="profile-field-header">CVV</span>
                                        <div className="field">
                                            <div className="control">
                                                <Input
                                                    formContext={formContext}
                                                    inputType={InputType.Text}
                                                    name="code"
                                                    placeholder="CVV"
                                                    register={{
                                                        required: 'CVV required',
                                                        pattern: {
                                                            value: cvvRegex,
                                                            message: 'Invalid CVV',
                                                        },
                                                    }}
                                                />
                                                {formContext.errors.code && (
                                                    <div className="">
                                                        <ErrorMessageComp errors={formContext.errors} inputName="code" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default Payment;
