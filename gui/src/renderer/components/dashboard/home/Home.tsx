import React, { useEffect, useState } from 'react';

import { useSelector } from 'react-redux';
import { DateTime, DurationObject } from 'luxon';
import got from 'got';

import DropDown from '../../shared/DropDown/DropDown';
import HomeTile from './HomeTile';
import PurchaseHistory from './PurchaseHistory';
import Stats from './Stats';

import './Home.scss';
import { RootState } from '../../../reducers';
import { CompletionType } from '../../../../../../lib/errors';
import Purchase from '../../../../lib/models/purchase';

const periods: { [key: string]: DurationObject } = {
    day: {
        days: 1,
    },
    week: {
        weeks: 1,
    },
    month: {
        months: 1,
    },
    year: {
        years: 1,
    },
};

/**
 * get the period endpoints from given period name & milliseconds
 * @param name period name
 * @param pruchaseDateInMillis datetime in milliseconds
 */
const getPeriodEndpoints = (name: string, pruchaseDateInMillis: number) => {
    const pruchaseDate = DateTime.fromMillis(pruchaseDateInMillis);

    return {
        startMillis: pruchaseDate.minus(periods[name]).toMillis(),
        endMillis: pruchaseDate.toMillis(),
    };
};

const Home: React.FC = () => {
    const periodOptions = Object.keys(periods);

    const [checkoutsPeriod, setCheckooutsPeriod] = useState(periodOptions[0]);
    const [declinesPeriod, setDeclinesPeriod] = useState(periodOptions[0]);

    const purchases = useSelector((state: RootState) => state.statistics.purchases);
    const successfulPurchases = purchases.filter((p) => p.type === CompletionType.PaymentSuccess);
    const declinedPurchases = purchases.filter((p) => p.type === CompletionType.PaymentDeclined);

    const filterPurchase = (purchase: Purchase) => {
        const periodEndpoints = getPeriodEndpoints(checkoutsPeriod, purchase.dateInMilliseconds);
        return purchase.dateInMilliseconds > periodEndpoints.startMillis && purchase.dateInMilliseconds <= periodEndpoints.endMillis;
    };

    const totalCheckouts = successfulPurchases.filter(filterPurchase).length;
    const totalDeclines = declinedPurchases.filter(filterPurchase).length;

    const currency = useSelector((state: RootState) => state.user.account!.currency);
    const [rates, setRates] = useState({});

    useEffect(() => {
        async function getRates() {
            try {
                const res: any = await got(`https://api.ratesapi.io/api/latest?base=${currency.code}`, { responseType: 'json' });

                if (res && res.body && res.body.rates) {
                    setRates(res.body.rates);
                }
            } catch (error) {
                console.log(error);
                setTimeout(() => {
                    getRates();
                }, 1000);
            }
        }
        getRates();
    }, []);

    const getTotalSpent = () => {
        let totalSpent = 0;

        successfulPurchases.forEach((p) => {
            const rate = 1 / rates[p.product.priceCurrency.code];
            totalSpent += rate * p.product.price;
        });

        return Math.round(totalSpent);
    };

    return (
        <div className="dashboard-page">
            <HomeTile
                isPrimary={true}
                title="Total Spent"
                text={`${currency.symbol || currency.code} ${JSON.stringify(rates) === '{}' ? '...' : getTotalSpent()}`}
            />
            <HomeTile
                title="Total Checkouts"
                text={totalCheckouts.toString()}
                select={
                    <DropDown
                        value={checkoutsPeriod}
                        options={periodOptions}
                        onChange={(value) => {
                            setCheckooutsPeriod(value);
                        }}
                    />
                }
            />
            <HomeTile
                title="Total Declines"
                text={totalDeclines.toString()}
                select={
                    <DropDown
                        value={declinesPeriod}
                        options={periodOptions}
                        onChange={(value) => {
                            setDeclinesPeriod(value);
                        }}
                    />
                }
            />
            <PurchaseHistory purchases={successfulPurchases} />
            <Stats />
        </div>
    );
};
export default Home;
