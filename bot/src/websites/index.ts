import Website, { AdditionalElement } from '../../../lib/models/website';

import Gap from './gap';
// import Pacsun from './pacsun';
import Walmart from './walmart/Walmart';
// import Zalando from './Zalando';
// import Example from './Example';
import { pacsunSizes, sizes, zalandoSizes } from '../../../lib/data/sizes';
import footsitesSites from './footsites/footsites.config';
import Zalando from './Zalando';
import Target from './Target';
import Amazon from './amazon/Amazon';
import Dicks from './Dicks';
import Amd from './Amd';
import Uniqlo from './Uniqlo';
import { uniqloSizes } from '../../../lib/data/sizes';
import Snkrs from './snkrs';

export enum SiteSpecificProperties {
    Sizes = 'sizes',
}

/**
 * use this if the site has one mode
 */
export const SingleMode = 'allow any mode';

export enum WalmartModes {
    /**
     * fast uses accounts from the accounts file that match profiles
     * if no accounts matches it does guest checkout
     */
    Fast = 'fast',
    /**
     * Creates accounts for emails in the profiles file and uses those
     */
    Auto = 'auto',
}

const gapSpecific: AdditionalElement = {
    name: 'sizes',
    label: 'Select Size',
    placeHolder: 'Select Size',
    type: 'dropdown',
    register: {
        validate: (values: string[]) => {
            const valid = values.length > 0;
            return valid || 'Please select at least one size';
        },
    },
    options: sizes.map((s) => s.value),
};

const gap = new Website({
    botTaskType: Gap,
    url: 'https://www.gap.com/',
    name: 'gap',
    category: 'gap',
    modes: [SingleMode],
    supportsAccount: false,
    accountToTaskMatchingStategy: 'N/A',
    additionalElements: [gapSpecific],
});

const walmart = new Website({
    botTaskType: Walmart,
    url: 'https://walmart.com/',
    name: 'walmart',
    category: 'walmart',
    modes: [WalmartModes.Auto, WalmartModes.Fast],
    supportsAccount: true,
    accountToTaskMatchingStategy: 'oneTaskPerAccount',
});

const dicks = new Website({
    botTaskType: Dicks,
    url: 'https://www.dickssportinggoods.com/',
    name: 'dsg',
    category: 'dsg',
    modes: ['Default'],
    supportsAccount: false,
    accountToTaskMatchingStategy: 'N/A',
});

export enum TargetModes {
    Preload = 'preload',
    Fast = 'fast',
}

const target = new Website({
    botTaskType: Target,
    url: 'https://www.target.com/',
    name: 'target',
    category: 'target',
    modes: [TargetModes.Preload, TargetModes.Fast],
    supportsAccount: true,
    accountToTaskMatchingStategy: 'oneTaskPerAccountAndAccountRequired',
});
// const amd = new Website({
//     botTaskType: Amd,
//     url: 'https://www.amd.com/',
//     name: 'amd',
//     category: 'amd',
//     modes: [SingleMode],
//     supportsAccount: false,
//     accountToTaskMatchingStategy: 'N/A',
// });

// const kickz = new Website({
//     botTaskType: Kickz,
//     url: 'https://www.kickz.com/',
//     name: 'kickz',
//     category: 'kickz',
//     modes: [SingleMode],
//     supportsAccount: false,
//     accountToTaskMatchingStategy: 'N/A',
// });

const pacsunSpecific: AdditionalElement = {
    // type: InputElement.
    name: 'sizes',
    label: 'Select Size',
    placeHolder: 'Select Size',
    type: 'dropdown',
    register: {
        validate: (values: string[]) => {
            const valid = values.length > 0;
            return valid || 'Please select at least one size';
        },
    },
    options: pacsunSizes.map((s) => {
        return s.name!;
    }),
};

// const pacsun = new Website({
//     botTaskType: Pacsun,
//     url: 'https://www.pacsun.com/',
//     name: 'pacsun',
//     category: 'pacsun',
//     modes: [SingleMode],
//     additionalElements: [pacsunSpecific],
//     supportsAccount: false,
//     accountToTaskMatchingStategy: 'N/A',
// });

const zalandoSpecific: AdditionalElement = {
    name: 'sizes',
    label: 'Select Size',
    placeHolder: 'Select Size',
    type: 'dropdown',
    register: {
        validate: (values: string[]) => {
            const valid = values.length > 0;
            return valid || 'Please select at least one size';
        },
    },
    options: zalandoSizes.map((s) => s.value),
};

export enum ZalandoModes {
    Fast = 'fast',
    Preload = 'preload',
    Default = 'default',
    Restock = 'restock',
}

const zalando = new Website({
    botTaskType: Zalando,
    url: 'https://fr.zalando.be/',
    name: 'zalando',
    category: 'zalando',
    modes: [ZalandoModes.Fast, ZalandoModes.Preload, ZalandoModes.Restock],
    additionalElements: [zalandoSpecific],
    supportsAccount: true,
    accountToTaskMatchingStategy: 'oneTaskPerAccountAndAccountRequired',
});

const amazon = new Website({
    botTaskType: Amazon,
    url: 'https://www.amazon.com/',
    name: 'amazon',
    category: 'amazon',
    modes: ['Fast', 'Restock'],
    additionalElements: [],
    supportsAccount: true,
    accountToTaskMatchingStategy: 'reuse',
});

const uniqloSpecific: AdditionalElement = {
    // type: InputElement.
    name: 'sizes',
    label: 'Select Size',
    placeHolder: 'Select Size',
    type: 'dropdown',
    register: {
        validate: (values: string[]) => {
            const valid = values.length > 0;
            return valid || 'Please select at least one size';
        },
    },
    options: uniqloSizes.map((s) => {
        return s.name!;
    }),
};

const uniqlo = new Website({
    botTaskType: Uniqlo,
    url: 'https://www.uniqlo.com/',
    name: 'uniqlo',
    category: 'uniqlo',
    modes: ['Fast'],
    additionalElements: [uniqloSpecific],
    supportsAccount: false,
    accountToTaskMatchingStategy: 'reuse',
});

const snkrs = new Website({
    botTaskType: Snkrs,
    url: 'https://www.nike.com/launch',
    name: 'snkrs',
    category: 'nike',
    modes: ['Fast'],
    additionalElements: [],
    supportsAccount: true,
    accountToTaskMatchingStategy: 'reuse',
});

// const example = new Website({
//     botTaskType: Example,
//     url: 'https://www.ignitebot.io',
//     name: 'example',
//     category: 'development',
//     modes: [SingleMode],
// });

let sites = [...footsitesSites, walmart, target, zalando, snkrs];

export default sites;

/**
 * map sites to their names and enforce typing as a literal
 */
export const siteNames: string[] = sites.map((site) => site.name);
export type Site = typeof siteNames[number];

export const getWebsiteByName = (name: string) => {
    return sites.find((site) => site.name.toLowerCase() === name.toLowerCase());
};
