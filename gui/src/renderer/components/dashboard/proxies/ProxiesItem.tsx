import * as React from 'React';
import '../../shared/Table.scss';
import ProxyWrapper from './ProxyWrapper';

interface Props {
    proxyWrapper: ProxyWrapper;
    index: number;
    columns: any;
    onItemClick: () => void;
}

const ProxiesItem = ({ proxyWrapper, index, columns, onItemClick }: Props) => {
    const classes = proxyWrapper.active
        ? 'table-component-data-row-content table-component-data-row-content-selected'
        : 'table-component-data-row-content';

    let speedColor = '';
    if (proxyWrapper.speed) {
        if (proxyWrapper.speed > 2500) {
            speedColor = '#BE2A50';
        } else if (proxyWrapper.speed > 1000) {
            speedColor = '#E4FF3D';
        } else {
            speedColor = '#29C871';
        }
    }

    const statusColor = proxyWrapper.status === 'Good' ? '#29C871' : '#BE2A50';

    return (
        <div className={classes} onClick={() => onItemClick()} role="button">
            <div className="table-component-data-cell" style={{ width: columns[0].width }}>
                {index + 1}
            </div>
            <div className="table-component-data-cell" style={{ width: columns[1].width }}>
                {proxyWrapper.listName}
            </div>
            <div className="table-component-data-cell" style={{ width: columns[2].width }}>
                {proxyWrapper.proxy.ip}
            </div>
            <div className="table-component-data-cell" style={{ width: columns[3].width }}>
                {proxyWrapper.proxy.port}
            </div>
            <div className="table-component-data-cell" style={{ width: columns[4].width }}>
                {proxyWrapper.country}
            </div>
            <div className="table-component-data-cell" style={{ width: columns[5].width }}>
                <div style={{ color: speedColor }}>{proxyWrapper.speed ? `${proxyWrapper.speed}ms` : ''}</div>
            </div>
            <div className="table-component-data-cell" style={{ width: columns[6].width }}>
                <div style={{ color: statusColor }}>{proxyWrapper.status ? proxyWrapper.status : ''}</div>
            </div>
        </div>
    );
};
export default ProxiesItem;
