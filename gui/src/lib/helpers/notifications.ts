import * as electron from 'electron';
import { isRenderer } from '.';

export interface NotificationSettings {
    body: string;
    icon: string;
}

/**
 * show a notification
 *
 * this function will automatically decide whether it should be shown on the main or renderer process
 * @param options
 */
export function showNotification(options: NotificationSettings) {
    if (isRenderer) return new Notification('Ignite', options);

    const c: electron.NotificationConstructorOptions = {
        title: 'Ignite',
        body: options?.body || '',
        icon: options?.icon,
    };

    return new electron.Notification(c).show();
}
