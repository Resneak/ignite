import {constants, publicEncrypt} from 'crypto';

const cyberSourceEncryptV1 = (cardNumber: string, publicKey: string): string => {
    let formatPublicKey = publicKey;
    const dataBuffer = Buffer.from(cardNumber);

    if (!publicKey.includes('-BEGIN PUBLIC KEY-'))
        formatPublicKey = `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;

    const encryptedCardBuffer = publicEncrypt({
        key: formatPublicKey,
        oaepHash: 'sha256',
        padding: constants.RSA_PKCS1_OAEP_PADDING,
    }, dataBuffer);

    return encryptedCardBuffer.toString('base64');
};

export { cyberSourceEncryptV1 }