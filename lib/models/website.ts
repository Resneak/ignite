// eslint-disable-next-line import/no-cycle
import BotTask, { BotTaskProperties, BotTaskType } from '../../bot/src/models/tasks/botTask';

/**
 * see the inquirer module for a description of all options https://www.npmjs.com/package/inquirer
 */
export interface AdditionalElement {
    /**
     * name of the input
     */
    name: string;

    /**
     * label that the user sees
     */
    label: string;

    placeHolder: string;

    /**
     * type of input to create
     */
    type: 'text' | 'dropdown';

    register: any;

    options?: string[] | { name: string; value: string }[];

    disabled?: boolean;
}

export default class Website {
    /** task type that will be used to instantiate a new bot Task for this site */
    botTaskType: BotTaskType;

    /** target website URL */
    url: URL;

    /**
     * uique target website name
     *
     * e.g footlocker US
     */
    name: string;

    /**
     * website category
     *
     * e.g footsites
     */
    category: string;

    /** site supported modes
     *
     * e.g. Fast, Hybrid, Safe, Private
     */
    modes: string[];

    /**
     * additional GUI elements that can be filled in by the user
     *
     * resulting values will be merged with `properties`
     */
    additionalElements?: AdditionalElement[] | undefined;

    /**
     * custom properties/settings related to this website
     *
     * this can be useful when you need to manage values that can change over time in one place
     *
     * if `additionalElements` is specified as well,
     * properties with the same name will be overwritten
     */
    properties?: { [property: string]: any } = {};
    // properties?: Record<string, any>;

    /** whether or not this website supports logging in with an account (and if it's implemented in this software) */
    supportsAccount?: boolean = false;

    /**
     * resuse: continually loop through available accounts until all tasks have been created
     * oneTaskPerAccount: create a task with each account available, any remaining tasks will be created without an account
     * oneTaskPerAccountAndAccountRequired: create a task with each account available, and any remaining tasks will NOT be created
     */
    accountToTaskMatchingStategy: 'N/A' | 'reuse' | 'oneTaskPerAccount' | 'oneTaskPerAccountAndAccountRequired';

    constructor(
        opts: Pick<
            Website,
            'botTaskType' | 'name' | 'category' | 'modes' | 'additionalElements' | 'properties' | 'supportsAccount' | 'accountToTaskMatchingStategy'
        > & {
            url: string;
        }
    ) {
        this.botTaskType = opts.botTaskType;
        this.url = new URL(opts.url);
        this.name = opts.name;
        this.category = opts.category;
        this.supportsAccount = opts.supportsAccount;
        this.modes = opts.modes;
        this.additionalElements = opts.additionalElements;
        this.properties = opts.properties || {};
        this.accountToTaskMatchingStategy = opts.accountToTaskMatchingStategy;
        if (this.supportsAccount === true && this.accountToTaskMatchingStategy === 'N/A') {
            throw new Error(
                `Invalid arguments while creating account. Supports account = ${this.supportsAccount}, accountToTaskMatchingStrategy = ${this.accountToTaskMatchingStategy}`
            );
        }
    }

    /**
     * creates a new bot task for this site
     * @param props details to use for the task
     */
    createBotTask(props: Omit<BotTaskProperties, 'website'>): BotTask {
        // eslint-disable-next-line new-capx
        return new this.botTaskType({
            website: this,
            ...props,
        });
    }

    /**
     * returns a (pre)configured property
     * @param name name of the propety i n camelCase
     */
    getProperty(name: string) {
        let property: any;

        if (this.properties) property = this.properties[name];

        const element = this.additionalElements?.find((elem) => elem.name === name);
        if (element) property = element.options;

        return property;
    }
}
