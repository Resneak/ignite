import * as React from 'React';
import { useForm } from 'react-hook-form';
import { useEffect, useRef, useState } from 'react';

import Fade from '../../shared/Fade';
import Profile from '../../../../../../lib/models/profile';
import countries from '../../../../lib/data/countries';
import newTaskSVG from '../../../../../assets/svg/newTaskGreen.svg';

import { fillForm, fillFormBilling, formToProfile } from './form/helpers';
import ProfileName from './form/ProfileName';
import Address from './form/Address';
import Payment from './form/Payment';

interface Props {
    addProfile: Function;
    updateProfile: Function;
    currentProfile: Profile | undefined;
    focus: boolean;
    toggleActive: Function;
}

const ProfileForm = ({ addProfile, updateProfile, currentProfile, focus, toggleActive }: Props) => {
    const { register, unregister, handleSubmit, errors, clearError, setValue, getValues, reset, watch, triggerValidation } = useForm({
        mode: 'onChange',
    });
    const formContext = {
        register,
        unregister,
        setValue,
        getValues,
        clearError,
        watch,
        errors,
    };

    const nameRef: any = useRef(null);

    const [sameBilling, setSameBilling] = useState(false);
    const [isCopy, setIsCopy] = useState(false);

    // focus the profile name input when use clicks create in profile list
    useEffect(() => {
        nameRef.current.focus();
        if (currentProfile) {
            nameRef.current.value = `${currentProfile.name} Copy`;
            setIsCopy(true);
        }
    }, [focus]);

    // fill form with current profile
    useEffect(() => {
        fillForm(currentProfile || undefined, setValue, setSameBilling, resetForm);
        triggerValidation();
    }, [currentProfile]);

    // fill billing section if different billing checked and if current profile has billing section and if billing section is displayed
    useEffect(() => {
        if (!sameBilling && !!currentProfile?.billingAddress && !getValues('billingFirst')) {
            fillFormBilling(setValue, currentProfile);
        }
    }, [sameBilling, getValues('billingFirst'), currentProfile]);

    const resetForm = () => {
        reset();
        setSameBilling(false);
        setIsCopy(false);
        nameRef.current.focus();
    };

    return (
        <form id="profile-form">
            <ProfileName register={register} nameRef={nameRef} errors={errors} />
            <Address formContext={formContext} countries={countries} isShipping={true} sameBilling={sameBilling} setSameBilling={setSameBilling} />
            <Fade show={!sameBilling}>
                <Address
                    formContext={formContext}
                    countries={countries}
                    isShipping={false}
                    sameBilling={sameBilling}
                    setSameBilling={setSameBilling}
                />
            </Fade>
            <Payment formContext={formContext}>
                <div
                    className={
                        errors.code ? 'column right display-flex flex-column mt-auto mb-3' : 'column right display-flex flex-column mt-auto mb-0'
                    }>
                    <div className="display-flex flex-grow-1" />
                    <div
                        role="button"
                        className="task-option profile-save green mb-0"
                        onClick={handleSubmit(async (form: any) => {
                            const result = await triggerValidation();
                            if (result) {
                                const profile = formToProfile(form, currentProfile, sameBilling, isCopy);
                                if (currentProfile && !isCopy) {
                                    updateProfile(profile);
                                } else {
                                    addProfile(profile);
                                }
                                toggleActive('');
                                resetForm();
                            }
                        })}>
                        <img alt="New" className="task-top-controls" src={newTaskSVG} />
                        Save Changes
                    </div>
                </div>
            </Payment>
        </form>
    );
};
export default ProfileForm;
