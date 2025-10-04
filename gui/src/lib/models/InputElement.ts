export enum InputType {
    Text = 'text',
    Dropdown = 'dropdown',
}

export interface FormContext {
    register: Function;
    unregister: Function;
    setValue: Function;
    clearError: Function;
    watch: Function;
    errors: any;
}

/**
 * React hook form register object https://react-hook-form.com/api#register
 */
export interface Register {
    /**
     * A Boolean which, if true, indicates that the input must have a value before the form can be submitted.
     * You can assign a string to return an error message in the errors object.
     */
    required?: string | boolean | { value: boolean; message: string };

    /**
     * The maximum length of the value to accept for this input.
     */
    maxLength?: { value: number; message: string };

    /**
     * The minimum length of the value to accept for this input.
     */
    minLength?: { value: number; message: string };

    /**
     * The maximum value to accept for this input.
     */
    max?: { value: number; message: string };

    /**
     * The minimum value to accept for this input.
     */
    min?: { value: number; message: string };

    /**
     * The regex pattern for the input.
     */
    pattern?: { value: RegExp; message: string };

    /**
     * You can pass a callback function as the argument to validate,
     * or you can pass an object of callback functions to validate all of them.
     */
    validate?: Function | Record<string, any>;
}

export default class InputElement {
    /** unique name for element */
    name: string;

    /** label that the user sees */
    label: string;

    /** the placeholder for text input or default value for dropdown */
    placeHolder: string;

    type: InputType;

    /** React hook forms register object */
    register: Register;

    /** options for a dropdown */
    options?: string[];

    /** whether or not the element is disabled */
    disabled?: boolean;

    constructor({ name, label, placeHolder, type, options, disabled, register }: InputElement) {
        this.name = name;
        this.label = label;
        this.placeHolder = placeHolder;
        this.type = type;
        this.options = options;
        this.disabled = disabled;
        this.register = register;
    }
}
