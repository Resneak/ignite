import * as React from 'react';

const Captcha = (props: React.SVGProps<SVGSVGElement>) => {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}>
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M2 1C1.44772 1 1 1.44772 1 2V6C1 6.55228 1.44772 7 2 7H6C6.55228 7 7 6.55228 7 6V2C7 1.44772 6.55228 1 6 1H2ZM2 9C1.44772 9 1 9.44772 1 10V14C1 14.5523 1.44772 15 2 15H6C6.55228 15 7 14.5523 7 14V10C7 9.44772 6.55228 9 6 9H2ZM9 2C9 1.44772 9.44772 1 10 1H14C14.5523 1 15 1.44772 15 2V6C15 6.55228 14.5523 7 14 7H10C9.44772 7 9 6.55228 9 6V2ZM10 9C9.44772 9 9 9.44772 9 10V14C9 14.5523 9.44772 15 10 15H14C14.5523 15 15 14.5523 15 14V10C15 9.44772 14.5523 9 14 9H10Z"
            />
        </svg>
    );
};

export default Captcha;
