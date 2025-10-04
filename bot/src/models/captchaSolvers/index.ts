import CaptchaMonster from './capMonster';
import { CaptchaSolverProps, CaptchaSolverType } from './captchaSolver';
import TwoCaptcha from './twoCaptcha';
import AYCDAutosolve from './aycdAutosolve';

const createSolver = (props: CaptchaSolverProps) => {
    switch (props.type) {
        case CaptchaSolverType.TwoCaptcha:
            return new TwoCaptcha(props.apiKey);
        case CaptchaSolverType.CapMonster:
            return new CaptchaMonster(props.apiKey);
        case CaptchaSolverType.AYCDAutosolve:
            return new AYCDAutosolve(props.apiKey, props.token);
        default:
            throw new Error('Invalid captcha solver.');
    }
};
export default createSolver;
