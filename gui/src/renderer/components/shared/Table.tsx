import * as React from 'React';
import './Table.scss';

interface Props {
    columns: Col[];
    children: any;
}

interface Col {
    name: string;
    width: string;
}

const Table = ({ columns, children }: Props) => {
    return (
        <div className="table-component">
            <div className="table-component-header-row">
                <div className="table-component-header-row-content">
                    {columns.map((col: Col) => {
                        return (
                            <div
                                key={col.name}
                                className="table-component-header-cell"
                                style={{ width: col.width }}>
                                {col.name}
                            </div>
                        );
                    })}
                </div>
            </div>
            <div className="table-component-data-rows">{children}</div>
        </div>
    );
};

export default Table;
