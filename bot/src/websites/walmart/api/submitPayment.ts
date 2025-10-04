import { Got } from 'got/dist/source';
import Profile from '../../../../../lib/models/profile';
import { WalmartAccountType } from '../Walmart';

export interface EncryptionInformation {
    PIE_key_id: string;
    PIE_key_phase: string;
    piHash: string;
    creditCard: {
        encryptedPanCreditcard: string;
        encryptedCvvPaymentCreditcard: string;
        integrityCheckCreditcard: string;
    };
    payment: {
        encryptedPanPayment: string;
        encryptedCvvPayment: string;
        integrityCheckPayment: string;
    };
}

const submitPayment = (
    httpClient: Got,
    userAgent: string,
    accountType: WalmartAccountType,
    cardType: string,
    encryption: EncryptionInformation,
    profile: Profile,
    preferenceID?: string
) => {
    const guestHeaders = httpClient.defaults.options.http2
        ? {
              'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
              dnt: '1',
              inkiru_precedence: 'false',
              'sec-ch-ua-mobile': '?0',
              'user-agent': userAgent,
              'content-type': 'application/json',
              accept: 'application/json, text/javascript, */*; q=0.01',
              wm_cvv_in_session: 'true',
              wm_vertical_id: '0',
              origin: 'https://www.walmart.com',
              'sec-fetch-site': 'same-origin',
              'sec-fetch-mode': 'cors',
              'sec-fetch-dest': 'empty',
              referer: 'https://www.walmart.com/checkout/',
              'accept-encoding': 'gzip, deflate, br',
              'accept-language': 'en-US,en;q=0.9',
          }
        : {
              Host: 'www.walmart.com',
              Connection: 'keep-alive',
              accept: 'application/json, text/javascript, */*; q=0.01',
              DNT: '1',
              inkiru_precedence: 'false',
              wm_cvv_in_session: 'true',
              'User-Agent': userAgent,
              wm_vertical_id: '0',
              'content-type': 'application/json',
              Origin: 'https://www.walmart.com',
              'Sec-Fetch-Site': 'same-origin',
              'Sec-Fetch-Mode': 'cors',
              'Sec-Fetch-Dest': 'empty',
              Referer: 'https://www.walmart.com/checkout/',
              'Accept-Encoding': 'gzip, deflate, br',
              'Accept-Language': 'en-US,en;q=0.9',
          };

    const loggedInHeaders = httpClient.defaults.options.http2
        ? {
              'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
              dnt: '1',
              inkiru_precedence: 'false',
              'sec-ch-ua-mobile': '?0',
              'user-agent': userAgent,
              'content-type': 'application/json',
              accept: 'application/json, text/javascript, */*; q=0.01',
              wm_cvv_in_session: 'true',
              wm_vertical_id: '0',
              origin: 'https://www.walmart.com',
              'sec-fetch-site': 'same-origin',
              'sec-fetch-mode': 'cors',
              'sec-fetch-dest': 'empty',
              referer: 'https://www.walmart.com/checkout/',
              'accept-encoding': 'gzip, deflate, br',
              'accept-language': 'en-US,en;q=0.9',
          }
        : {
              Host: 'www.walmart.com',
              Connection: 'keep-alive',
              'sec-ch-ua': '"Chromium";v="92", " Not A;Brand";v="99", "Google Chrome";v="92"',
              DNT: '1',
              inkiru_precedence: 'false',
              'sec-ch-ua-mobile': '?0',
              'User-Agent': userAgent,
              'content-type': 'application/json',
              accept: 'application/json, text/javascript, */*; q=0.01',
              wm_cvv_in_session: 'true',
              wm_vertical_id: '0',
              Origin: 'https://www.walmart.com',
              'Sec-Fetch-Site': 'same-origin',
              'Sec-Fetch-Mode': 'cors',
              'Sec-Fetch-Dest': 'empty',
              Referer: 'https://www.walmart.com/checkout/',
              'Accept-Encoding': 'gzip, deflate, br',
              'Accept-Language': 'en-US,en;q=0.9',
          };

    const guestBody = {
        payments: [
            {
                paymentType: 'CREDITCARD',
                cardType: cardType,
                firstName: profile.billingAddress!.firstName,
                lastName: profile.billingAddress!.lastName,
                addressLineOne: profile.billingAddress!.address,
                addressLineTwo: profile.billingAddress!.secondaryAddress || '',
                city: profile.billingAddress!.city,
                state: profile.billingAddress!.stateCode,
                postalCode: profile.billingAddress!.zip,
                expiryMonth: profile.payment.month > 10 ? `${profile.payment.month}` : `0${profile.payment.month}`, // yes this should be a string
                expiryYear: `${profile.payment.year}`, // same here
                email: profile.billingAddress!.email,
                phone: profile.billingAddress!.phone,
                encryptedPan: encryption.payment.encryptedPanPayment,
                encryptedCvv: encryption.payment.encryptedCvvPayment,
                integrityCheck: encryption.payment.integrityCheckPayment,
                keyId: encryption.PIE_key_id,
                phase: encryption.PIE_key_phase,
                piHash: encryption.piHash,
            },
        ],
        cvvInSession: true,
    };

    const loggedInBody = {
        payments: [
            {
                paymentType: 'CREDITCARD',
                preferenceId: preferenceID,
                isNew: true, // what about old accounts?
                cardType: cardType,
                firstName: profile.billingAddress!.firstName,
                lastName: profile.billingAddress!.lastName,
                addressLineOne: profile.billingAddress!.address,
                addressLineTwo: profile.billingAddress!.secondaryAddress || '',
                city: profile.billingAddress!.city,
                state: profile.billingAddress!.stateCode,
                postalCode: profile.billingAddress!.zip,
                expiryMonth: profile.payment!.month, // yes this should be a number
                expiryYear: profile.payment!.year, // same here
                // email: profile.billingAddress.email, // no email with accounts
                phone: profile.billingAddress!.phone,
                encryptedPan: encryption.payment.encryptedPanPayment,
                encryptedCvv: encryption.payment.encryptedCvvPayment,
                integrityCheck: encryption.payment.integrityCheckPayment,
                keyId: encryption.PIE_key_id,
                phase: encryption.PIE_key_phase,
                piHash: encryption.piHash,
            },
        ],
        cvvInSession: true,
    };

    let headers = accountType === WalmartAccountType.Guest ? guestHeaders : loggedInHeaders;
    let json = accountType === WalmartAccountType.Guest ? guestBody : loggedInBody;

    return httpClient.post('https://www.walmart.com/api/checkout/v3/contract/:PCID/payment', {
        headers,
        json,
    });
};

export default submitPayment;
