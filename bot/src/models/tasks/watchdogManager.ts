import TaskUpdate, { TaskEvent } from '../../../../lib/models/taskUpdate';
import BotTask from './botTask';
import Watchdog from './watchdog';

export type TaskID = string;
export type PID = string;

/**
 * each pid has a corresponging watchdog instance
 *
 * watchdog manager handles adding tasks to each of their corresponding group
 * and forwarding updates to that class
 *
 * the set watchdog status method must be registered as a listener on task updates
 */
export default class WatchdogManager {
    private watchdogGroups: Map<PID, Watchdog>;

    /**
     * whether watchdog tasks should be used
     */
    private isEnabled: boolean = false;

    private getBotTask: (id: TaskID) => BotTask | undefined;

    constructor(getBotTask: (id: TaskID) => BotTask | undefined, enabled?: boolean) {
        this.watchdogGroups = new Map();
        this.isEnabled = enabled || false;
        this.getBotTask = getBotTask;
    }

    public addBotTask(pid: PID, id: TaskID) {
        if (!this.watchdogGroups.has(pid)) {
            this.watchdogGroups.set(pid, new Watchdog(pid, this.getBotTask));
        }
        this.watchdogGroups.get(pid)!.addBotTask(id);
    }

    public getIsWatchdogEnabled() {
        return this.isEnabled;
    }

    public setShouldWatchdogBeEnabled(shouldBeEnabled: boolean) {
        this.isEnabled = shouldBeEnabled;
    }

    /**
     * call this once tasks start to initialize timeouts
     */
    public start() {
        if (!this.isEnabled) return;
        for (const [, watchdog] of this.watchdogGroups) {
            watchdog.start();
        }
    }

    /**
     * forwards updates to the watchdog instance that handles the corresponding pid
     * @param update to handle
     */
    public setWatchdogStatus(update: TaskUpdate) {
        if (!this.isEnabled) return;

        const group = this.getBotTaskGroup(update.pid);
        switch (update.event) {
            case TaskEvent.Watch:
                group?.onWatchEvent(update);
                break;
            case TaskEvent.InStock:
                group?.onInStock();
                break;
            case TaskEvent.CheckoutSuccess:
            case TaskEvent.CheckoutDecline:
            case TaskEvent.Stopped:
                group?.onTaskStopped(update);
                break;
        }
    }

    private getBotTaskGroup(pid: PID): Watchdog | undefined {
        return this.watchdogGroups.get(pid);
    }
}
