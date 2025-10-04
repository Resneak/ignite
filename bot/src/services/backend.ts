// import { isDev } from '../../../cli/src/utils/general';

// export const server = () => (isDev() ? 'http://localhost:3000' : `https://ignitebot.io`);
export const server = () => `https://ignitebot.io`;

interface SocketNamespace {
    namespace: string;
    events: any;
}

export const FootsitesSocket: SocketNamespace = {
    namespace: '/footsites',
    events: {
        clientRequestJoinProductGroups: 'footsites:client-request:join-product-group',
        clientRequestNodesWithoutTTLs: 'footsites:client-request:cache-nodes-without-ttls',
        clientSendCacheNodeUpdates: 'footsites:client-send:cache-node-updates',
        clientSendTTLUpdate: 'footsites:client-send:ttl-update',
        serverSendUpcomingTTLs: 'footsites:server-send:upcoming-ttls',
        serverSendCacheNodesWithoutTTLs: 'footsites:server-send:cache-nodes-without-ttls',
    },
};

export const AmazonSocket: SocketNamespace = {
    namespace: '/amazon',
    events: {},
};

export const WalmartSocket: SocketNamespace = {
    namespace: '/walmart',
    events: {},
};

export const UserSocket: SocketNamespace = {
    namespace: '/',
    events: {
        clientSendTaskEvent: 'client-send:task-event',
    },
};
