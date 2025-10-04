import { StopTask } from '../../../lib/errors';

export function stopRequestHook(shouldCancel: boolean) {
    if (shouldCancel) throw new StopTask('Stopped');
}
