import * as React from 'React';
import './Search.scss';

interface Props {
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
}

const Search = ({ placeholder, value, onChange }: Props) => {
    return (
        <input
            className="input-component"
            style={{ width: '240px' }}
            type="text"
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            value={value}
        />
    );
};
export default Search;
