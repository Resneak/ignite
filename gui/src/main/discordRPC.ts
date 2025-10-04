import { version } from '../../package.json';
import DiscordRPC from 'discord-rpc';
import { isDev } from '../../../cli/src/utils/general';

DiscordRPC.register('678050640475324478');
const rpc = new DiscordRPC.Client({ transport: 'ipc' });

const registerDiscordRPC = () => {
    rpc.on('ready', () => {
        rpc.setActivity({
            details: `v${version}`,
            startTimestamp: Date.now(),
            largeImageKey: 'avi',
            largeImageText: 'The Hottest AIO',
            instance: false,
        });
    });

    rpc.on('error', (e) => {
        isDev() && console.log(e);
    });
};

export default registerDiscordRPC;
