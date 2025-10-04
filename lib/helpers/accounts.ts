import { randomEightCharacterString, randomNumber } from '.';

/**
 *
 * @param email to use
 * @param spoof whether the email should be spoofed
 * @returns an object containing an email and random password.
 */
export const createCredentials = (email: string, spoof?: boolean) => {
    return {
        email: spoof ? spoofEmail(email) : email,
        password: createPassword(),
    };
};

/**
 *
 * @param email to spoof
 * @returns email in the form of username+<RANDOM_NUMBER>@domain
 */
export const spoofEmail = (email: string) => {
    const [username, domain] = email?.split?.('@');
    return username + '+' + randomNumber(100, 999999) + '@' + domain;
};

/**
 * @returns a random password
 */
export const createPassword = () => {
    const str = randomEightCharacterString();
    const str2 = randomEightCharacterString();
    return `!6NIT3-${str}-${str2}`;
};
