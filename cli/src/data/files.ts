/**
 * files stored in app data dir
 * (those not edited by a user)
 */
export const AppData = {
    User: 'user',
    Webhook: 'webhook',
    Logs: 'log.txt',
};

/**
 * files stored inside the application
 * (packed as an asset)
 */
export const Asset = {
    IgnitePub: 'ignite.pub',
    CheckoutSound: 'checkout.mp3',
    DeviceData: 'DeviceData.csv'
};

/**
 * files that users should interact with
 * (stored next to the exe)
 */
export const User = {
    Tasks: 'tasks.csv',
    Profiles: 'profiles.txt',
    Proxies: 'proxies.txt',
    Settings: 'settings.txt',
    Accounts: 'accounts.txt',
    Checkouts: 'checkouts.csv',
};

export const Bundle = {
    Main: 'main',
    // let file = './ignite.loader.js';
    // if (isDev()) file = './main.dev.js';
    // if (isProd() && /bundled$/.test(`${__dirname}`)) file = './main.prod.js';
};

export const profilesHeader = /PROFILE NAME,FIRST NAME,LAST NAME,EMAIL/;
export const proxyHeader = /IP:PORT/;
export const tasksHeader = /STORE, MODE/;
export const accountsHeader = /Email Address/;
