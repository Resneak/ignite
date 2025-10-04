import { DateTime } from 'luxon';
import React from 'React';

import Purchase from '../../../../lib/models/purchase';

interface Props {
    item: Purchase;
    index: number;
    columns: any;
}

const PurchaseItem = ({ item, index, columns }: Props) => {
    return (
        <div className="table-component-data-row-content" role="button">
            <div className="table-component-data-cell" style={{ width: columns[0].width }}>
                {index + 1}
            </div>
            <div className="table-component-data-cell" style={{ width: columns[1].width }}>
                {item.product.name}
            </div>
            <div className="table-component-data-cell" style={{ width: columns[2].width }}>
                {DateTime.fromMillis(item.dateInMilliseconds).toLocaleString()}
            </div>
            <div className="table-component-data-cell" style={{ width: columns[3].width }}>
                {item.websiteName}
            </div>
            <div className="table-component-data-cell" style={{ width: columns[4].width, color: '#3b9e71' }}>
                {`${item.product.price} ${item.product.priceCurrency.symbol || item.product.priceCurrency.code}`}
            </div>
        </div>
    );
};
export default PurchaseItem;
