import DiscordRPC from 'discord-rpc';
import { isDev } from '../../../cli/src/utils/general';
const clientId = '678050640475324478';

const registerDiscordRPC = () => {
    DiscordRPC.register(clientId);
    const rpc = new DiscordRPC.Client({ transport: 'ipc' });
    rpc.on('ready', () => {
        rpc.setActivity({
            details: `${isDev() ? 'Developer Mode 👾' : 'Pre-Redemption - CLI'}`,
            startTimestamp: Date.now(),
            largeImageKey: 'avi',
            largeImageText: 'The Hottest AIO',
            instance: false,
        });
    });

    rpc.login({ clientId }).catch((e) => {
        isDev() && console.error(e);
    });
};

export default registerDiscordRPC;
