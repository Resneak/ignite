import { sizes } from '../../../../lib/data/sizes';
import Website, { AdditionalElement } from '../../../../lib/models/website';
import Footsites from './Footsites';

export enum FootsitesModes {
    Release = 'release',
    Rotate = 'rotate',
    Experimental = 'experimental',
}
export const footsitesModes = [FootsitesModes.Release, FootsitesModes.Rotate];

const footsiteSpecific: AdditionalElement = {
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
    options: sizes.map((s) => s.value),
};

const footlocker = new Website({
    botTaskType: Footsites,
    url: 'https://footlocker.com/',
    name: 'footlocker',
    category: 'footsites',
    modes: [FootsitesModes.Release, FootsitesModes.Rotate, FootsitesModes.Experimental],
    additionalElements: [footsiteSpecific],
    supportsAccount: false,
    accountToTaskMatchingStategy: 'N/A',
});

const footlockerca = new Website({
    botTaskType: Footsites,
    url: 'https://footlocker.ca/',
    name: 'footlockerca',
    category: 'footsites',
    modes: [FootsitesModes.Release, FootsitesModes.Rotate, FootsitesModes.Experimental],
    additionalElements: [footsiteSpecific],
    supportsAccount: false,
    accountToTaskMatchingStategy: 'N/A',
});

const champssports = new Website({
    botTaskType: Footsites,
    url: 'https://champssports.com/',
    name: 'champssports',
    category: 'footsites',
    modes: [FootsitesModes.Release, FootsitesModes.Rotate, FootsitesModes.Experimental],
    additionalElements: [footsiteSpecific],
    supportsAccount: false,
    accountToTaskMatchingStategy: 'N/A',
});

const eastbay = new Website({
    botTaskType: Footsites,
    url: 'https://eastbay.com/',
    name: 'eastbay',
    category: 'footsites',
    modes: [FootsitesModes.Release, FootsitesModes.Rotate, FootsitesModes.Experimental],
    additionalElements: [footsiteSpecific],
    supportsAccount: false,
    accountToTaskMatchingStategy: 'N/A',
});

const kidsfootlocker = new Website({
    botTaskType: Footsites,
    url: 'https://kidsfootlocker.com/',
    name: 'kidsfootlocker',
    category: 'footsites',
    modes: [FootsitesModes.Release, FootsitesModes.Rotate, FootsitesModes.Experimental],
    additionalElements: [footsiteSpecific],
    supportsAccount: false,
    accountToTaskMatchingStategy: 'N/A',
});

const footaction = new Website({
    botTaskType: Footsites,
    url: 'https://footaction.com/',
    name: 'footaction',
    category: 'footsites',
    modes: [FootsitesModes.Release, FootsitesModes.Rotate, FootsitesModes.Experimental],
    additionalElements: [footsiteSpecific],
    supportsAccount: false,
    accountToTaskMatchingStategy: 'N/A',
});

const staging = new Website({
    botTaskType: Footsites,
    url: 'https://staging.kidsfootlocker.com/',
    name: 'staging',
    category: 'footsites',
    modes: [FootsitesModes.Release, FootsitesModes.Rotate, FootsitesModes.Experimental],
    additionalElements: [footsiteSpecific],
    supportsAccount: false,
    accountToTaskMatchingStategy: 'N/A',
});

const sites = [footlocker, champssports, footlockerca, eastbay, kidsfootlocker, footaction, staging];
export default sites;
