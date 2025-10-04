import * as React from 'React';

import './PurchaseHistory.scss';

import Purchase from '../../../../lib/models/purchase';
import Table from '../../shared/Table';
import PurchaseItem from './PurchaseItem';

interface Props {
    purchases: Purchase[];
}

const PurchaseHistory = ({ purchases }: Props) => {
    const homeColumns = [
        { name: 'No', width: '10%' },
        { name: 'Product Name', width: '30%' },
        { name: 'Date', width: '20%' },
        { name: 'Store', width: '20%' },
        { name: 'Price', width: '20%' },
    ];

    return (
        <div className="dashboard-bottom-row-item dashboard-purchase-history">
            <div className="dashboard-bottom-row-item-title">Purchase History</div>
            <div className="dashboard-bottom-row-item-content">
                <Table columns={homeColumns}>
                    {purchases.slice(1, 20)?.map((item: Purchase, index: number) => (
                        <PurchaseItem key={item.id} item={item} index={index} columns={homeColumns} />
                    ))}
                </Table>
            </div>
        </div>
    );
};
export default PurchaseHistory;
