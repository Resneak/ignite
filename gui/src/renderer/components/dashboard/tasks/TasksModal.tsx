import * as React from 'React';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import '../proxies/modal/ProxiesModal';

import { genGuuid } from '../../../helpers';
import Profile from '../../../../../../lib/models/profile';
import Product from '../../../../lib/models/product';
import { findSize } from '../../../../lib/data/sizes';
import Task from '../../../../lib/models/task';
import Variant from '../../../../../../lib/models/Variant';
import ErrorMessage from '../../shared/ErrorMessage';
import ModalRow from '../../shared/ModalRow';
import DropDown from '../../shared/DropDown/DropDown';
import FormDropDown from '../../shared/DropDown/FormDropDown';
import Input from '../../shared/Input';
import ProxyList from '../../../../lib/models/proxyList';
import { filterDuplicates } from '../../../../lib/helpers/arrays';
import Logger from '../../../../main/logger';
import { InputType } from '../../../../lib/models/inputElement';
import websites from '../../../../../../bot/src/websites'


interface Props {
    task?: Task;
    show: boolean;
    onHide: () => void;
    addTask: (task: Task) => void;
    updateTask: (task: Task) => void;
    profiles: Profile[];
    proxies: ProxyList[];
}

const TasksModal = ({ task, show, onHide, addTask, updateTask, profiles, proxies }: Props) => {
    const { register, unregister, setValue, handleSubmit, errors, watch, clearError, reset, triggerValidation } = useForm({
        mode: 'onChange',
    });

    const [site, setSite] = useState(websites[0]);

    const profileOptions: string[] = profiles.map((item: Profile) => item.name);
    const proxiesOptions: string[] = filterDuplicates(['Localhost', ...proxies.map((item: ProxyList) => item.name)]);
    // const sizeOptions: string[] = sizes.map((item) => item.name || '');
    const websiteOptions: string[] = websites.map((item) => item.name);

    const [defaultProfile, setDefaultProfile] = useState('Select Profile');
    const [defaultProxyList, setDefaultProxyList] = useState('Select Proxies');
    const [defaultMode, setDefaultMode] = useState('Select Mode');
    // const [defaultSize, setDefaultSize] = useState('Select Size');

    const formContext = {
        register,
        unregister,
        setValue,
        clearError,
        errors,
        watch,
    };

    useEffect(() => {
        fillForm();
    }, [show, task]);

    useEffect(() => {
        Logger.log(errors);
    }, [errors]);

    const fillForm = () => {
        const taskSite = websites.find((item) => item.name === task?.websiteName);
        taskSite && setSite(taskSite);
        setValue('search', task?.product.name);
        setValue('style', task?.product.variant.style);
        setValue('checkoutDelay', task?.checkoutDelay);
        setValue('monitorDelay', task?.monitorDelay);
        setValue('quantity', task?.product.quantity);
        const account = task?.email && task?.password ? `${task?.email}:${task?.password}` : '';
        setValue('account', account);
        setDefaultProfile(profiles.find((profile) => profile.id === task?.profileId)?.name || 'Select Profile');
        setDefaultProxyList(proxies.find((proxy) => proxy.id === task?.proxyListId)?.name || 'Select Proxies');
        setDefaultMode(task?.mode || 'Select Mode');
        // setDefaultSize(task?.product.variant.size.name || 'Select Size');
    };

    const handleSiteChange = (siteName: string) => {
        const s = websites.find((item) => item.name === siteName);
        s && setSite(s);
        clearError();
    };

    const getId = (name: string, list: any[]) => {
        return list.find((item) => item.name === name).id;
    };


    const formToTask = (data: any) => {
        const { form, isUpdate } = data;
        const { captchaBypass } = form;
        const [email, password] = form.account ? form.account.split(':') : [undefined, undefined];
        const id = isUpdate ? task?.id : undefined;
        const createdAt = isUpdate ? task?.createdAt : undefined;

        return new Task({
            id: id || genGuuid(),
            createdAt: createdAt || new Date(),
            profileId: getId(form.profile, profiles),
            proxyListId: getId(form.proxylist, proxies),
            websiteName: site.name,
            mode: form.mode,
            product: new Product(form.search, new Variant(findSize(form.size), undefined, form.style), form.quantity),
            checkoutDelay: form.checkoutDelay,
            captchaBypass,
            monitorDelay: form.monitorDelay,
            category: form.category,
            email,
            password,
            isActive: false,
        });
    };

    return (
        <div className={`${show ? 'modal-component modal is-active' : 'modal-component modal'}`}>
            <div className="modal-background" />
            <div className="modal-content modal-component-modal-content">
                <button key="modalButton" aria-label="close" className="modal-close is-large modal-component-close-button" onClick={onHide} />
                <form
                    id="taskForm"
                    onSubmit={handleSubmit(async (form: any) => {
                        const result = await triggerValidation();
                        if (result) {
                            const { amount } = form;
                            for (let x = 0; x < parseInt(amount, 10); x += 1) {
                                if (task && x === 0) {
                                    updateTask(formToTask({ form, isUpdate: true }));
                                } else {
                                    addTask(formToTask({ form, isUpdate: false }));
                                }
                            }
                            reset();
                            onHide();
                        }
                    })}>
                    <ModalRow firstChildLabel="Search Query" secondChildLabel={!task ? 'Site' : ''}>
                        <Input
                            formContext={formContext}
                            inputType={InputType.Text}
                            name="search"
                            placeholder="Keywords, variant or URL"
                            register={{ required: 'Query parameters required' }}
                            errorMessage={ErrorMessage(errors, 'search')}
                        />
                        {!task && (
                            <DropDown
                                isModalDropDown
                                value={site.name}
                                onChange={(value: string) => handleSiteChange(value)}
                                options={websiteOptions}
                            />
                        )}
                    </ModalRow>
                    <ModalRow firstChildLabel="Profile" secondChildLabel="Proxies">
                        <FormDropDown
                            isModalDropDown
                            defaultValue={defaultProfile}
                            options={profileOptions}
                            name="profile"
                            formContext={formContext}
                            register={{
                                required: 'Profile required',
                                validate: (v: string) => !(v === defaultProfile) || 'Profile required',
                            }}
                            ErrorMessage={ErrorMessage(formContext.errors, 'profile')}
                        />
                        <FormDropDown
                            isModalDropDown
                            defaultValue={defaultProxyList}
                            options={proxiesOptions}
                            name="proxylist"
                            formContext={formContext}
                            register={{
                                required: 'Proxies required',
                                validate: (v: string) => !(v === defaultProxyList) || 'Proxies required',
                            }}
                            ErrorMessage={ErrorMessage(formContext.errors, 'proxylist')}
                        />
                    </ModalRow>
                    <ModalRow firstChildLabel="Mode" >
                        <FormDropDown
                            disabled={site.modes.length < 1}
                            isModalDropDown
                            defaultValue={defaultMode}
                            options={site.modes}
                            name="mode"
                            formContext={formContext}
                            register={{
                                required: 'Mode required',
                                validate: (v: string) => !(v === defaultMode) || 'Mode required',
                            }}
                            ErrorMessage={ErrorMessage(formContext.errors, 'mode')}
                        />
                        {/* <FormDropDown
                            key="size"
                            isModalDropDown
                            defaultValue={defaultSize}
                            options={sizeOptions}
                            name="size"
                            formContext={formContext}
                            register={{
                                required: 'Size required',
                                validate: (v: string) => !(v === defaultSize) || 'Size required',
                            }}
                            ErrorMessage={ErrorMessage(formContext.errors, 'size')}
                        /> */}
                    </ModalRow>

                    {site.additionalElements?.map((item, index) => {
                        // Two elements to add
                        if (index % 2 === 0 && site.additionalElements!.length > index + 1) {
                            const item2 = site.additionalElements![index + 1];
                            
                            return (
                                <ModalRow firstChildLabel={item.label} secondChildLabel={item2.label} key={item.label}>
                                    <Input
                                        key={item.name}
                                        formContext={formContext}
                                        inputType={item.type === 'dropdown' ? InputType.Dropdown : InputType.Text}
                                        name={item.name}
                                        options={item.options || ['']}
                                        placeholder={item.placeHolder}
                                        register={item.register}
                                        errorMessage={ErrorMessage(formContext.errors, item.name)}
                                    />
                                    <Input
                                        key={item2.name}
                                        formContext={formContext}
                                        inputType={item2.type=== 'dropdown' ? InputType.Dropdown : InputType.Text} //TOOD improve creation of additional elements
                                        name={item2.name}
                                        options={item2.options || ['']}
                                        placeholder={item2.placeHolder}
                                        register={item2.register}
                                        errorMessage={ErrorMessage(formContext.errors, item2.name)}
                                    />
                                </ModalRow>
                            );
                        }
                        // One last element to add
                        if (index % 2 === 0) {
                            return (
                                <ModalRow firstChildLabel={item.label} key={item.label}>
                                    <Input
                                        key={item.name}
                                        formContext={formContext}
                                        inputType={item.type=== 'dropdown' ? InputType.Dropdown : InputType.Text}
                                        name={item.name}
                                        options={item.options || ['']}
                                        placeholder={item.placeHolder}
                                        register={item.register}
                                        errorMessage={ErrorMessage(formContext.errors, item.name)}
                                    />
                                </ModalRow>
                            );
                        }
                    })}

                    <ModalRow firstChildLabel="Monitor Delay (milliseconds)">
                        <Input
                            formContext={formContext}
                            inputType={InputType.Text}
                            name="monitorDelay"
                            placeholder="600"
                            register={{
                                required: 'Monitor delay required',
                                pattern: { value: /\d */, message: 'Invalid monitor delay' },
                            }}
                            errorMessage={ErrorMessage(errors, 'monitorDelay')}
                        />
                    </ModalRow>

                    <div className="form-component-submit-row">
                        {!task && (
                            <div className="display-flex flex-column">
                                <input
                                    className={
                                        errors.amount
                                            ? 'input form-component-input tasks-task-modal-count-input form-control is-invalid'
                                            : 'input form-component-input tasks-task-modal-count-input'
                                    }
                                    style={{ width: '60px' }}
                                    name="amount"
                                    placeholder="1"
                                    ref={register({
                                        required: 'Amount required',
                                        pattern: { value: /\d*/, message: 'Invalid amount' },
                                    })}
                                />
                                <div className="position-absolute mt-3 pt-4">{ErrorMessage(errors, 'amount')}</div>
                            </div>
                        )}
                        <button className="form-component-submit-button" form="taskForm" type="submit">
                            <div className="form-component-submit-button-icon">
                                <div className="icon-component-green-plus" style={{ height: '13px', width: '13px' }} />
                            </div>
                            <div>{task ? 'Edit Task' : 'Create Tasks'}</div>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TasksModal;
