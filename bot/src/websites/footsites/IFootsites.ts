import Size from '../../../../lib/models/size';

interface StyleAttribute {
    id: string;
    type: 'style';
    value: string;
}

interface SizeAttribute {
    id: string;
    type: 'style';
    value: string;
}

interface SizeGroup {
    attributes: Array<SizeAttribute | StyleAttribute>;
    barcode: string;
    code: string;
    isBackOrderable: boolean;
    isPreOrder: boolean;
    isRecaptchaOn: boolean;
    price: any;
    singleStoreInventory: boolean;
    sizeAvailableInStores: boolean;
    stockLevelStatus: 'inStock' | 'outOfStock';
    sizeAvailableInStoresMessage: string;
}

interface VariantAttributes {
    code: string;
    cstSkuLaunchDate: string | undefined;
    definedTimeForCountDown: string;
    displayCountDownTimer: boolean;
    eligiblePaymentTypesForProduct: string;
    fitVariant: string;
    freeShipping: boolean;
    freeShippingMessage: boolean;
    isSelected: boolean;
    launchProduct: boolean;
    mapEnable: boolean;
    pdpActivationDate: string;
    price: any;
    recaptchaOn: boolean;
    riskified: boolean;
    shipToAndFromStore: boolean;
    shippingRestrictionExists: boolean;
    sku: string;
    skuExclusions: boolean;
    skuLaunchDate: string;
    stockLevelStatus: string;
    webOnlyLaunch: boolean;
    width: string;
}

interface PDP {
    skuLaunch: number;
    sizes: Size[];
    name: string;
    image: string;
    price: string;
    isRecaptchaEnabled: boolean;
}

export {PDP, VariantAttributes, SizeGroup, SizeAttribute, StyleAttribute};