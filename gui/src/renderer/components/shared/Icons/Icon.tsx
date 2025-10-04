import * as React from 'React';

import BroomIcon from './Broom';
import CaptchaIcon from './Captcha';
import CookieIcon from './Cookie';
import EditIcon from './Edit';
import PlayIcon from './Play';
import StopIcon from './Stop';
import TrashCanIcon from './TrashCan';
import ImportIcon from './Import';

export enum Icons {
    Broom,
    Captcha,
    Cookie,
    Edit,
    Play,
    Stop,
    TrashCan,
    Import,
}

interface Props {
    icon: Icons;
}

const Icon = ({ icon }: Props) => {
    switch (icon) {
        case Icons.Broom:
            return <BroomIcon fill="rgba(132,123,255,.8)" strokeWidth={5} />;
        case Icons.Captcha:
            return <CaptchaIcon fill="rgba(132,123,255,0.8)" />;
        case Icons.Cookie:
            return <CookieIcon fill="rgba(132,123,255,0.8)" />;

        case Icons.Edit:
            return <EditIcon fill="rgba(132,123,255,0.8)" />;

        case Icons.Play:
            return <PlayIcon fill="rgb(41, 200, 113)" />;

        case Icons.Stop:
            return <StopIcon fill="#be2a50" />;

        case Icons.TrashCan:
            return <TrashCanIcon fill="rgba(132,123,255,0.8)" />;
        case Icons.Import:
            return <ImportIcon />;
        default:
            return <></>;
    }
};

export default Icon;
