import { PDP, VariantAttributes, SizeGroup, SizeAttribute, StyleAttribute } from './IFootsites';
import Size from '../../../../lib/models/size';

const adyen18 = require('../../utils/cryptography/adyen18');
const adyenKey = '10001|A237060180D24CDEF3E4E27D828BDB6A13E12C6959820770D7F2C1671DD0AEF4729670C20C6C5967C664D18955058B69549FBE8BF3609EF64832D7C033008A818700A9B0458641C5824F5FCBB9FF83D5A83EBDF079E73B81ACA9CA52FDBCAD7CD9D6A337A4511759FA21E34CD166B9BABD512DB7B2293C0FE48B97CAB3DE8F6F1A8E49C08D23A98E986B8A995A8F382220F06338622631435736FA064AEAC5BD223BAF42AF2B66F1FEA34EF3C297F09C10B364B994EA287A5602ACF153D0B4B09A604B987397684D19DBC5E6FE7E4FFE72390D28D6E21CA3391FA3CAADAD80A729FEF4823F6BE9711D4D51BF4DFCB6A3607686B34ACCE18329D415350FD0654D';

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getAvailableSizes = (sizeGroups: SizeGroup[], codePrefix: string) => {
    const sizes: Size[] = [];
    for (const sizeGroup of sizeGroups) {
        const sizeAttr = sizeGroup.attributes.find((attribute: SizeAttribute | StyleAttribute) => {
            const isSizeAttr = (attribute.type as string) === 'size';
            const isCorrectVariant = new RegExp(`^${codePrefix}`).test(attribute.id);
            return isSizeAttr && isCorrectVariant;
        });
        if (sizeAttr) sizes.push(new Size(`${parseFloat(sizeAttr.value)}`, `${parseFloat(sizeAttr.value)}`, sizeAttr.id));
    }
    return sizes;
};

const getTimeToWait = (ttl: number) => {
    const now = Date.now();
    const productLiveIn = ttl - now;
    const requestTime = (Math.random() * 2.5 + 0.5) * 1000; //random number between 500 and 3000
    const requestIn = productLiveIn - requestTime;
    return requestIn < 0 ? 0 : requestIn;
};

const formatXCache = (response) => {
    const xCache = `${response?.headers?.['x-cache']}`
        ?.split(', ')
        ?.map((item) => item?.replace('HIT', '+')?.replace('MISS', '-'))
        ?.join('')
        .trim();
    return xCache;
};

const encryptPayment = (payment: {
    number: string, 
    code: string,
    name: string,
    month: number,
    year: string
}): string => {
    const cardData = {
        number: payment.number.match(/.{1,4}/g)!.join(' '),
        cvc: payment.code,
        holderName: payment.name,
        expiryMonth: `${payment.month}`.length === 1 ? `0${payment.month}` : `${payment.month}`,
        expiryYear: `${payment.year}`.length === 2 ? `20${payment.year}` : `${payment.year}`,
        generationtime: new Date().toISOString(),
    }
    const cseInstance = adyen18.createEncryption(adyenKey, {});
    cseInstance.validate(cardData);
    return cseInstance.encrypt(cardData);
};

export { encryptPayment, pause, getTimeToWait, formatXCache, getAvailableSizes };