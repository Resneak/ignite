import Currency from '../../../../lib/models/currency';

export const defaultCurrency = new Currency('USD', 'United States Dollar', '$');

export default [defaultCurrency, new Currency('GBP', 'Great British Pound', '£'), new Currency('EUR', 'Euro', '€')];
