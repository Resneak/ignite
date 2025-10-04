import { isDev } from './general';
import Logger from './logger';

process.on('unhandledRejection', (reason: any, promise) => {
    const stack = reason?.stack?.toString();
    const message = `Unhandled Rejection at: ${JSON.stringify(promise)} \tReason: ${reason} \n${stack}`;
    isDev() && console.trace(reason);
    Logger.log(message, isDev());
});

process.on('uncaughtException', function (err) {
    const trace = err.stack?.toString();
    Logger.log('Uncaught exception ' + err + '\n' + trace, isDev());
});
