import * as React from 'react';

const Stop = (props: React.SVGProps<SVGSVGElement>) => {
    return (
        <svg
            width="16px"
            height="16px"
            viewBox="0 0 16 16"
            xmlns="http://www.w3.org/2000/svg"
            {...props}>
            <rect x="1" y="1" width="14" height="14" rx="4" />
        </svg>
    );
};

export default Stop;
