import { Got } from 'got/dist/source';
import Profile from '../../../../../lib/models/profile';
import { WalmartAccountType } from '../Walmart';

interface WalmartCreditCardInfo {
    encryptedPan: string;
    encryptedCvv: string;
    integrityCheck: string;
    PIE_key_id: string;
    PIE_phase: string;
    profile: Profile;
    cardType: string; // MASTERCARD |
}

const submitCreditCard = (httpClient: Got, userAgent: string, accountType: WalmartAccountType, billing: WalmartCreditCardInfo) => {
    const profile = billing.profile.billingAddress ? billing.profile.billingAddress : billing.profile.shippingAddress;
    const isGuest = accountType === WalmartAccountType.Guest ? { isGuest: true } : {};

    const http2Headers = {
        'sec-ch-ua': '"Chromium";v="92", " Not A;Brand";v="99", "Google Chrome";v="92"',
        accept: 'application/json',
        dnt: '1',
        'sec-ch-ua-mobile': '?0',
        'user-agent': userAgent,
        'content-type': 'application/json',
        origin: 'https://www.walmart.com',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        referer: 'https://www.walmart.com/checkout/',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-US,en;q=0.9',
    };

    const http1Headers = {
        Host: 'www.walmart.com',
        Connection: 'keep-alive',

        accept: 'application/json',
        DNT: '1',
        'User-Agent': userAgent,
        'content-type': 'application/json',
        Origin: 'https://www.walmart.com',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        Referer: 'https://www.walmart.com/checkout/',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
    };

    const headers = httpClient.defaults.options.http2 ? http2Headers : http1Headers;
    return httpClient.post('https://www.walmart.com/api/checkout-customer/:CID/credit-card', {
        headers,
        json: {
            encryptedPan: billing.encryptedPan,
            encryptedCvv: billing.encryptedCvv,
            integrityCheck: billing.integrityCheck,
            keyId: billing.PIE_key_id,
            phase: billing.PIE_phase,
            state: profile.stateCode,
            postalCode: profile.zip,
            addressLineOne: profile.address,
            addressLineTwo: profile.secondaryAddress || '',
            city: profile.city,
            firstName: profile.firstName,
            lastName: profile.lastName,
            expiryMonth: billing.profile.payment.month < 10 ? `0${billing.profile.payment.month}` : `${billing.profile.payment.month}`,
            expiryYear: `${billing.profile.payment.year}`,
            phone: profile.phone,
            cardType: billing.cardType,
            ...isGuest,
        },
    });
};

export default submitCreditCard;
