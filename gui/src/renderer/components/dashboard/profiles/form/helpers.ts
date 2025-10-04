import { countryCodeToName, countryNameToCode } from '../../../../../lib/data/countries';
import Profile, { ProfileBilling, ProfilePayment, ProfileShipping } from '../../../../../../../lib/models/profile';
import { genGuuid } from '../../../../helpers';
import { splitMMYY, toMMYY } from '../../../../helpers/strings';

export const fillFormBilling = (setValue: Function, profile: any) => {
    setValue('billingFirst', profile?.billingAddress?.firstName);
    setValue('billingLast', profile?.billingAddress?.lastName);
    setValue('billingEmail', profile?.billingAddress?.email);
    setValue('billingPhone', profile?.billingAddress?.phone);
    setValue('billingAddress', profile?.billingAddress?.address);
    setValue('billingAddress2', profile?.billingAddress?.secondaryAddress);
    setValue('billingCity', profile?.billingAddress?.city);
    setValue('billingZip', profile?.billingAddress?.zip);
    setValue('billingState', profile?.billingAddress?.state || 'Select State');
    setValue('billingCountry', profile?.billingAddress?.country || 'Select Country');
};

export const fillForm = (profile: Profile | undefined, setValue: Function, setSameBilling: Function, resetForm: Function) => {
    if (profile) {
        // Use country name in drop down and code in obj
        const countryCode = profile?.shippingAddress?.country;
        const countryName = countryCode ? countryCodeToName(countryCode) : undefined;
        setValue('name', profile.name);
        setValue('shippingFirst', profile.shippingAddress.firstName);
        setValue('shippingLast', profile.shippingAddress.lastName);
        setValue('shippingEmail', profile.shippingAddress.email);
        setValue('shippingPhone', profile.shippingAddress.phone);
        setValue('shippingAddress', profile.shippingAddress.address);
        setValue('shippingAddress2', profile.shippingAddress.secondaryAddress);
        setValue('shippingCity', profile.shippingAddress.city);
        setValue('shippingZip', profile.shippingAddress.zip);
        setValue('shippingState', profile.shippingAddress.state || 'Select State');
        setValue('shippingCountry', countryName || 'Select Country');
        setValue('number', profile.payment.number);
        setValue('expiration', toMMYY(profile.payment.month, profile.payment.year));
        setValue('code', profile.payment.code);
        setSameBilling(!profile.billingAddress);
    } else {
        resetForm();
    }
};

export const formToProfile = (form: any, profile: any, sameBilling: boolean, isCopy: boolean) => {
    const shippingCountryCode = countryNameToCode(form.shippingCountry);
    const billingCountryCode = countryNameToCode(form.billingCountry);
    const shippingAddress = new ProfileShipping({
        firstName: form.shippingFirst,
        lastName: form.shippingLast,
        email: form.shippingEmail,
        phone: form.shippingPhone,
        address: form.shippingAddress,
        secondaryAddress: form.shippingAddress2,
        city: form.shippingCity,
        state: form.shippingState,
        stateCode: 'CA', //TODO get state code from the state
        zip: form.shippingZip,
        country: shippingCountryCode!,
    });
    const billingAddress = sameBilling
        ? undefined
        : new ProfileBilling({
              firstName: form.shippingFirst,
              lastName: form.shippingLast,
              email: form.shippingEmail,
              phone: form.shippingPhone,
              address: form.shippingAddress,
              secondaryAddress: form.shippingAddress2,
              city: form.shippingCity,
              state: form.billingState,
              stateCode: 'CA', //TODO get state code from the state
              zip: form.shippingZip,
              country: billingCountryCode!,
          });
    const { month, year } = splitMMYY(form.expiration);
    const payment = new ProfilePayment({
        number: form.number,
        code: form.code,
        month,
        year,
    });

    const { id, createdAt } = getIdAndCreatedAt(isCopy, profile?.id, profile?.createdAt);

    return new Profile({
        name: form.name,
        id,
        profileName: id, //TODO should users be able to name profiles in the gui?
        createdAt,
        sameAddress: !billingAddress,
        singleCheckout: profile?.singleCheckout || false,
        shippingAddress,
        billingAddress,
        payment,
    });
};

const getIdAndCreatedAt = (isCopy: boolean, profileId: string, profileCreatedAt: Date) => {
    let id: string;
    let createdAt: Date;
    if (isCopy) {
        id = genGuuid();
        createdAt = new Date();
    } else {
        id = profileId || genGuuid();
        createdAt = profileCreatedAt || new Date();
    }
    return { id, createdAt };
};
