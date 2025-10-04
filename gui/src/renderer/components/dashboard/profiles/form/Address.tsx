import * as React from 'React';
import { useEffect, useState } from 'react';
import { FormContext, InputType } from '../../../../../lib/models/inputElement';
import { emailRegex, phoneRegex, zipRegex } from '../../../../helpers/constants';
import ErrorMessage, { ErrorMessageComp } from '../../../shared/ErrorMessage';
import Input from '../../../shared/Input';
import Toggle from '../../../shared/Toggle';
import Divider from './Divider';
import Country from '../../../../../../../lib/models/country';
import { countryNameToStates } from '../../../../../lib/data/countries';
import State from '../../../../../lib/models/state';

interface Props {
    formContext: FormContext;
    countries: Country[];
    isShipping: boolean;
    sameBilling: boolean;
    setSameBilling: Function;
}

const Address = ({ formContext, countries, isShipping, sameBilling, setSameBilling }: Props) => {
    const statePlaceholder = 'Select State';
    const countryPlaceholder = 'Select Country';
    const countryOptions = countries.map((countryItem) => countryItem.name);
    const prefix = isShipping ? 'shipping' : 'billing';
    const fields = {
        first: prefix.concat('First'),
        last: prefix.concat('Last'),
        email: prefix.concat('Email'),
        phone: prefix.concat('Phone'),
        address: prefix.concat('Address'),
        address2: prefix.concat('Address2'),
        country: prefix.concat('Country'),
        state: prefix.concat('State'),
        city: prefix.concat('City'),
        zip: prefix.concat('Zip'),
    };

    const country = formContext.watch(fields.country);
    const state = formContext.watch(fields.state);
    const [stateOptions, setStateOptions] = useState<string[]>([]);

    useEffect(() => {
        const countryStates = countryNameToStates(country) || [];
        const stateNames = countryStates.map((stateItem: State) => stateItem.name);
        setStateOptions(stateNames);
        if (!stateNames.includes(state)) {
            formContext.setValue(fields.state, statePlaceholder);
        }
    }, [country]);

    return (
        <div className="profile-shipping">
            <div className="columns profile-forms">
                <div className="column is-2 prof-head">
                    <span className="profile-section-header">{isShipping ? 'Shipping' : 'Billing'}</span>
                </div>
                <div className="column">
                    <div className="columns double-profile-field">
                        <div className="column left">
                            <span className="profile-field-header">First Name</span>
                            <div className="field">
                                <div className="control">
                                    <Input
                                        formContext={formContext}
                                        inputType={InputType.Text}
                                        name={fields.first}
                                        placeholder="First Name"
                                        register={{ required: 'First name required' }}
                                    />
                                    {ErrorMessage(formContext.errors, fields.first)}
                                </div>
                            </div>
                        </div>
                        <div className="column right">
                            <span className="profile-field-header">Last Name</span>
                            <div className="field">
                                <div className="control">
                                    <Input
                                        formContext={formContext}
                                        inputType={InputType.Text}
                                        name={fields.last}
                                        placeholder="Last Name"
                                        register={{ required: 'Last name required' }}
                                    />
                                    {ErrorMessage(formContext.errors, fields.last)}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="columns double-profile-field">
                        <div className="column left">
                            <span className="profile-field-header">Email</span>
                            <div className="field">
                                <div className="control">
                                    <Input
                                        formContext={formContext}
                                        inputType={InputType.Text}
                                        name={fields.email}
                                        placeholder="Email Address"
                                        register={{
                                            required: 'Email required',
                                            pattern: {
                                                value: emailRegex,
                                                message: 'Invalid email',
                                            },
                                        }}
                                    />
                                    {ErrorMessage(formContext.errors, fields.email)}
                                </div>
                            </div>
                        </div>
                        <div className="column right">
                            <span className="profile-field-header">Phone Number</span>
                            <div className="field">
                                <div className="control">
                                    <Input
                                        formContext={formContext}
                                        inputType={InputType.Text}
                                        name={fields.phone}
                                        placeholder="Phone Number"
                                        register={{
                                            required: 'Phone number required',
                                            pattern: {
                                                value: phoneRegex,
                                                message: 'Invalid phone number',
                                            },
                                        }}
                                    />
                                    {ErrorMessage(formContext.errors, fields.phone)}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="columns double-profile-field">
                        <div className="column left">
                            <span className="profile-field-header">Address</span>
                            <div className="field">
                                <div className="control">
                                    <Input
                                        formContext={formContext}
                                        inputType={InputType.Text}
                                        name={fields.address}
                                        placeholder="Address"
                                        register={{
                                            required: 'Address required',
                                        }}
                                    />
                                    {ErrorMessage(formContext.errors, fields.address)}
                                </div>
                            </div>
                        </div>
                        <div className="column right">
                            <span className="profile-field-header">Address 2 (optional)</span>
                            <div className="field">
                                <div className="control">
                                    <Input
                                        formContext={formContext}
                                        inputType={InputType.Text}
                                        name={fields.address2}
                                        placeholder="Address 2"
                                        register={{ required: false }}
                                    />
                                    {ErrorMessage(formContext.errors, fields.address2)}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="columns double-profile-field">
                        <div className="column left">
                            <span className="profile-field-header">Country</span>
                            <div className="input select countries order-alpha">
                                <Input
                                    inputType={InputType.Dropdown}
                                    name={fields.country}
                                    options={countryOptions}
                                    placeholder={countryPlaceholder}
                                    formContext={formContext}
                                    register={{
                                        validate: (v: string) => {
                                            return v !== countryPlaceholder || 'Country required';
                                        },
                                    }}
                                />
                                {ErrorMessage(formContext.errors, fields.country)}
                            </div>
                        </div>
                        <div className="column right">
                            <span className="profile-field-header">State/Region</span>
                            <div className="input select states order-alpha">
                                <Input
                                    inputType={InputType.Dropdown}
                                    name={fields.state}
                                    options={stateOptions}
                                    placeholder={statePlaceholder}
                                    formContext={formContext}
                                    disabled={stateOptions.length === 0}
                                    register={{
                                        required: stateOptions.length > 0 && 'State required',
                                        validate: (v: string) => stateOptions.length === 0 || v !== statePlaceholder || 'State required',
                                    }}
                                />
                                {ErrorMessage(formContext.errors, fields.state)}
                            </div>
                        </div>
                    </div>
                    <div className="columns double-profile-field">
                        <div className="column left">
                            <span className="profile-field-header">City</span>
                            <div className="field">
                                <div className="control">
                                    <Input
                                        formContext={formContext}
                                        inputType={InputType.Text}
                                        name={fields.city}
                                        placeholder="City"
                                        register={{
                                            required: 'City required',
                                        }}
                                    />
                                    {ErrorMessage(formContext.errors, fields.city)}
                                </div>
                            </div>
                        </div>
                        <div className="column right">
                            <span className="profile-field-header">ZIP/Post Code</span>
                            <div className="field">
                                <div className="control">
                                    <Input
                                        formContext={formContext}
                                        inputType={InputType.Text}
                                        name={fields.zip}
                                        placeholder="ZIP/Post Code"
                                        register={{
                                            required: 'Zip/Post Code required',
                                            pattern: {
                                                value: zipRegex,
                                                message: 'Invalid zip/post code',
                                            },
                                        }}
                                    />
                                    {formContext.errors[`${fields.zip}`] && (
                                        <div className="pb-3">
                                            <ErrorMessageComp errors={formContext.errors} inputName={fields.zip} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    {isShipping && (
                        <div className="profile-switch">
                            <Toggle value={sameBilling} setValue={() => setSameBilling(!sameBilling)} />
                            <span className="switch-label-profile">Same Shipping and Billing Address</span>
                        </div>
                    )}
                    <Divider />
                </div>
            </div>
        </div>
    );
};
export default Address;
