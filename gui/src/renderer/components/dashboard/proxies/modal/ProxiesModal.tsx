import * as React from 'React';
import { useForm } from 'react-hook-form';
import './ProxiesModal.scss';
import ProxyList from '../../../../../lib/models/proxyList';
import Proxy from '../../../../../lib/models/proxy';
import { ErrorMessageComp } from '../../../shared/ErrorMessage';
import Input from '../../../shared/Input';
import { InputType } from '../../../../../lib/models/inputElement';
import { forEachLine } from '../../../../../lib/helpers/strings';

interface Props {
    show: boolean;
    onHide: () => void;
    addProxies: (proxyList: ProxyList) => void;
}

const ProxiesModal = ({ show, onHide, addProxies }: Props) => {
    const { register, unregister, setValue, clearError, handleSubmit, reset, errors, watch } = useForm({
        mode: 'onChange',
    });
    const formContext = { register, unregister, setValue, clearError, errors, watch };
    const formToProxies = (form: any) => {
        return new ProxyList({ name: form.name, proxies: form.proxies });
    };

    const validateProxies = (value: string) => {
        let isValid: string | boolean = true;
        forEachLine(value, (line) => {
            try {
                line && Proxy.parse(line);
            } catch (err) {
                isValid = `Invalid proxy: ${line} (Ex. 172.16.254.1:3000)`;
            }
        });
        return isValid;
    };

    const classes = show ? 'modal-component modal is-active' : 'modal-component modal';
    return (
        <div className={classes}>
            <div className="modal-background" />
            <div className="modal-content modal-component-modal-content">
                <button aria-label="close" className="modal-close is-large modal-component-close-button" onClick={onHide} />
                <form
                    onSubmit={handleSubmit((form: any) => {
                        addProxies(formToProxies(form));
                        reset();
                        onHide();
                    })}>
                    <div className="columns form-component-row">
                        <div className="column">
                            <div className="form-component-label">Group Name</div>
                            <div className="field-proxies">
                                <div className="control">
                                    <Input
                                        formContext={formContext}
                                        inputType={InputType.Text}
                                        name="name"
                                        placeholder="My proxy group"
                                        register={{ required: 'Name required' }}
                                    />
                                    {errors.name && (
                                        <div className="position-absolute">
                                            <ErrorMessageComp errors={errors} inputName="name" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="columns form-component-row">
                        <div className="column">
                            <div className="form-component-label">Proxy List</div>
                            <div className="field-proxies">
                                <div className="control">
                                    <textarea
                                        className={
                                            errors.proxies
                                                ? 'input textarea form-component-textarea form-control is-invalid'
                                                : 'input textarea form-component-textarea'
                                        }
                                        placeholder="host:port:username:password"
                                        name="proxies"
                                        ref={register({
                                            required: 'Proxies required',
                                            validate: {
                                                isValid: validateProxies,
                                            },
                                        })}
                                    />
                                    {errors.proxies && (
                                        <div className="position-absolute">
                                            <ErrorMessageComp errors={errors} inputName="proxies" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="form-component-submit-row">
                        <button className="form-component-submit-button" type="submit">
                            <div className="form-component-submit-button-icon">
                                <div className="icon-component-green-plus" style={{ height: '13px', width: '13px' }} />
                            </div>
                            <div>Create proxies</div>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProxiesModal;
