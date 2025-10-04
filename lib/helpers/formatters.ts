export const formatPrice = (price?: string | number) => {
    let strippedPrice = `${price}`;
    if (/\$/.test(strippedPrice)) {
        strippedPrice = strippedPrice.split('$')?.[1] || '';
    }
    const priceNumber = parseFloat(strippedPrice);
    if (Number.isNaN(priceNumber)) {
        return 'Failed to parse';
    }
    return `$${priceNumber}`;
};

export const parsePrice = (price: string) => {
    let strippedPrice = `${price}`;
    if (/\$/.test(strippedPrice)) {
        strippedPrice = strippedPrice.split('$')?.[1] || '';
    }
    const priceNumber = Math.floor(parseFloat(strippedPrice) * 100) / 100;
    if (Number.isNaN(priceNumber)) {
        return 'Failed to parse';
    }

    return priceNumber;
};
