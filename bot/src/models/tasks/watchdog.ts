import { PID, TaskID } from './watchDogManager';
import BotTask from './botTask';
import TaskUpdate from '../../../../lib/models/taskUpdate';
import { randomNumber } from '../../../../lib/helpers';

export default class Watchdog {
    private pid: PID;
    /**
     * duration of time with no stocks before tasks pause
     */
    // private pauseAfter = 1 * 30_000;
    private pauseAfter = 10 * 60_000;
    private retryFor = 3 * 60_000;

    /**
     * stores the current timeout that will pause tasks after no in stock events
     */
    private pauseTasksTimeout: any;

    private pauseFailedTimeout: any;
    private startFailedTimeout: any;

    private lastInStock = 0;

    private botTasks: Set<TaskID>;

    private watchdog?: TaskID;

    private isWatching = false;

    private getBotTask: (id: TaskID) => BotTask | undefined;

    constructor(pid: PID, getBotTask: (id: TaskID) => BotTask | undefined) {
        this.pid = pid;
        this.botTasks = new Set();
        this.getBotTask = getBotTask;
    }

    start() {
        this.setPauseTasksTimeout(Date.now());
    }

    /**
     *
     * @param botTask to add to the watchdog group
     */
    addBotTask(id: TaskID) {
        this.botTasks.add(id);
    }

    setPauseTasksTimeout(lastInStockAt: number) {
        this.lastInStock = lastInStockAt;
        const now = Date.now();
        const pauseAt = this.lastInStock + this.pauseAfter;
        const pauseIn = pauseAt > now ? pauseAt - now : 0;

        if (this.pauseTasksTimeout) clearTimeout(this.pauseTasksTimeout);
        this.pauseTasksTimeout = setTimeout(() => {
            this.pauseAll(true);
            this.startWatchdog();
            this.setRetryFailedTasksTimeout();
        }, pauseIn);
    }

    /**
     * after pauseAfter ms, force failed tasks to start
     * after pauseAfter ms, force them to stop again
     *
     */
    private setRetryFailedTasksTimeout() {
        if (this.startFailedTimeout) clearTimeout(this.startFailedTimeout);

        this.startFailedTimeout = setTimeout(() => {
            if (this.pauseFailedTimeout) clearTimeout(this.pauseFailedTimeout);
            this.unpauseFailedTasks();
            this.pauseFailedTimeout = setTimeout(() => {
                this.forceFailedTasksToPause();
            }, this.retryFor);
        }, this.pauseAfter);
    }

    private forceFailedTasksToPause() {
        for (const id of this.botTasks) {
            const botTask = this.getBotTask(id);
            if (!botTask?.readyToWaitForWatchdog) {
                botTask?.pause(true);
            }
        }
    }

    private unpauseFailedTasks() {
        for (const id of this.botTasks) {
            const botTask = this.getBotTask(id);
            if (!botTask?.readyToWaitForWatchdog) {
                botTask?.start();
            }
        }
    }

    /**
     * pauses all tasks that have reached their setWatchdog method
     */
    private pauseAll(force: boolean = false) {
        if (this.isWatching) return;
        for (const id of this.botTasks) {
            this.getBotTask(id)?.pause(force);
        }
    }

    private startWatchdog() {
        if (this.isWatching) return;
        if (!this.watchdog) this.rotateWatchdog();
        const watchdog = this.getBotTask(this.watchdog as TaskID);
        if (watchdog) {
            this.isWatching = true;
            watchdog?.startMonitor();
        }
    }

    /**
     * called when a task executes its setWatchdog method
     * @param taskUpdate
     */
    public onWatchEvent(taskUpdate: TaskUpdate) {
        const botTask = this.getBotTask(taskUpdate.id);
        botTask?.pause();
        this.startWatchdog();
    }

    public onInStock() {
        this.startAll();
        this.setPauseTasksTimeout(Date.now());
    }

    private startAll() {
        this.isWatching = false;
        for (const id of this.botTasks) {
            if (id !== this.watchdog) {
                this.getBotTask(id)?.start();
            }
        }
    }

    public onTaskStopped(taskUpdate: TaskUpdate) {
        if (taskUpdate.id === this.watchdog) {
            this.rotateWatchdog();
        }
        this.botTasks.delete(taskUpdate.id);
    }

    private rotateWatchdog() {
        let validWatchdog;
        let taskIndex = randomNumber(0, this.botTasks.size - 1);

        let currentIndex = 0;
        for (const id of this.botTasks) {
            const botTask = this.getBotTask(id);
            if (botTask?.readyToWaitForWatchdog) {
                validWatchdog = botTask.task.id;
                if (taskIndex === currentIndex) {
                    break;
                }
            }
            currentIndex += 1;
        }
        if (validWatchdog) this.setWatchdog(validWatchdog);
    }

    private setWatchdog(id: TaskID) {
        this.watchdog = id;
    }
}
