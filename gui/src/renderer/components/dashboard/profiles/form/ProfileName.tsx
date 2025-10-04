import * as React from 'React';
import '../../../shared/Input.scss';
import { ErrorMessageComp } from '../../../shared/ErrorMessage';
import Divider from './Divider';

interface Props {
    register: Function;
    nameRef: any;
    errors: Record<string, any>;
}

const ProfileName = ({ register, nameRef, errors }: Props) => {
    return (
        <div className="profile-personal">
            <div className="columns profile-forms">
                <div className="column is-2 prof-head">
                    <span className="profile-section-header" />
                </div>
                <div className="column">
                    <span className="profile-field-header">Profile Name</span>
                    <div className="field">
                        <div className="control">
                            <input
                                className={errors.name ? 'input profile-input form-control is-invalid' : 'input profile-input valid'}
                                placeholder="Profile Name"
                                name="name"
                                ref={(e: any) => {
                                    register(e, { required: 'Name required' });
                                    nameRef.current = e;
                                }}
                            />
                            {errors.name && (
                                <div className="pb-3 pt-1">
                                    <ErrorMessageComp errors={errors} inputName="name" />
                                </div>
                            )}
                        </div>
                    </div>
                    <Divider />
                </div>
            </div>
        </div>
    );
};
export default ProfileName;
