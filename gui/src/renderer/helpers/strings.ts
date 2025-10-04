// String Formatters
export const toMMYY = (month: number | string, year: number | string) => {
    return `${month}/${year}`;
};

export const splitMMYY = (mmyy: string) => {
    const [month, year] = mmyy.split('/');
    return { month: parseInt(month, 10), year: parseInt(year, 10) };
};
