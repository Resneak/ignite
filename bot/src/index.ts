import Profile from '../../lib/models/profile';
import Task from '../../lib/models/task';
import TaskUpdate, { TaskEvent, TaskStatusColor } from '../../lib/models/taskUpdate';
import BotTask from './models/tasks/botTask';
import { getWebsiteByName } from './websites';
import AntiDebugger from './models/antiDebugger';
import UserAccount from '../../lib/models/user';
import { StopTaskType } from '../../lib/errors/errorCodes';
import CaptchaSolver, { CaptchaSolverProps, CaptchaSolverType, CaptchaTask } from './models/captchaSolvers/captchaSolver';
import createCaptchaSolver from './models/captchaSolvers';
import Env from './env';
import { StopTask } from '../../lib/errors';
import WatchdogManager from './models/tasks/watchdogManager';
import io, { Socket } from 'socket.io-client';
import { server, UserSocket } from './services/backend';

type TaskID = string;
type SingleCheckoutID = string;
/**
 * handles all things related to tasks
 * this should be the only class that a ui needs to interact with
 */
export default class TaskManager {
    private botTasks: Map<TaskID, BotTask>;

    /**
     * provides quick access to a group of profiles with the same oneCheckoutID
     * useful for canceling all tasks with the same checkoutID
     */
    private singleCheckoutGroups: Map<SingleCheckoutID, TaskID[]>;

    private socket: Socket;

    private activeBotTasks: Promise<void>[] = [];

    private antiDebugger: AntiDebugger;

    private user?: UserAccount;

    private captchaSolversProps: CaptchaSolverProps[];

    private captchaSolver?: CaptchaSolver;

    private captchaSolverType?: CaptchaSolverType;

    private watchdogManager: WatchdogManager;

    /**
     *
     * listener that gets all updates passed to it
     */
    private updateListeners: ((taskUpdate: TaskUpdate) => void)[] = [];

    /**
     * listener that gets only updates with events passed to it
     */
    private eventListeners: ((taskUpdate: TaskUpdate) => void)[] = [];

    private tasksCompleteListeners: (() => void)[] = [];

    private static instance: TaskManager;
    public static getInstance(captchaSolversProps: CaptchaSolverProps[], isDev?: boolean, user?: UserAccount) {
        if (this.instance === undefined) {
            this.instance = new this(captchaSolversProps, user);
            const env = Env.getInstance();
            if (isDev) env.setDev(isDev);
        }
        return this.instance;
    }

    private constructor(captchaSolversProps: CaptchaSolverProps[], user?: UserAccount) {
        this.captchaSolversProps = captchaSolversProps;
        this.user = user;
        this.botTasks = new Map();
        this.singleCheckoutGroups = new Map();
        this.antiDebugger = new AntiDebugger(this.user);
        this.antiDebugger.checkAll();
        this.watchdogManager = new WatchdogManager(this.getBotTask.bind(this));
        this.eventListeners.push(this.watchdogManager.setWatchdogStatus.bind(this.watchdogManager));
        this.socket = io(`${server()}${UserSocket.namespace}`, {
            auth: {
                name: user?.name,
                token: user?.key,
            },
        });

        this.registerUpdateListener(this.emitTaskUpdate.bind(this));
    }

    private emitTaskUpdate(update: TaskUpdate) {
        switch (update.event) {
            case TaskEvent.CheckoutSuccess:
            case TaskEvent.CheckoutDecline:
            case TaskEvent.Carted:
                const botTask = this.botTasks.get(update.id);
                const product = { ...botTask?.task.product, quantity: botTask?.task.atcQuantity };
                this.socket?.emit?.(UserSocket.events.clientSendTaskEvent, { ...update, product });
                break;
            default:
                break;
        }
    }

    /**
     * add a new bot task
     * @param tasks/profiles to create a botTask out of
     */
    public addTasks(items: { task: Task; profile: Profile; devices: Array<Object>; } | { task: Task; profile: Profile; devices: Array<Object>; }[]) {
        items = Array.isArray(items) ? items : [items];

        for (const item of items) {
            const website = getWebsiteByName(item.task.websiteName);
            if (!website) throw new Error(`Invalid Website ${item.task.websiteName}`);

            let solveCaptcha;
            if (this.captchaSolverType === CaptchaSolverType.None) {
                const update = {
                    id: item.task.id,
                    pid: item.task.product.id,
                    color: TaskStatusColor.Error,
                    message: `No Captcha Solver Loaded`,
                };
            } else {
                solveCaptcha = this.solveCaptcha.bind(this);
            }

            const botTask = website.createBotTask({
                profile: item.profile,
                task: item.task,
                solveCaptcha,
                devices: item.devices,
                setStatus: (taskUpdate: TaskUpdate) => this.updateTaskStatus(taskUpdate),
            });

            this.addBotTask(botTask);
        }
    }

    private addBotTask(botTask: BotTask) {
        this.botTasks.set(botTask.task.id, botTask);

        // add the botTask to the singleCheckoutGroup
        if (botTask.profile.singleCheckout) {
            const id = this.getSingleCheckoutID(botTask);
            if (!this.singleCheckoutGroups.has(id)) {
                this.singleCheckoutGroups.set(id, []);
            }
            const group = this.singleCheckoutGroups.get(id);
            group?.push(botTask.task.id as TaskID);
        }
        this.watchdogManager.addBotTask(botTask.task.product.id, botTask.task.id);
    }

    public getBotTask(taskID: TaskID) {
        return this.botTasks.get(taskID);
    }

    public setCaptchaSolver(captchaSolverType: CaptchaSolverType) {
        const props = this.captchaSolversProps.find((item) => item.type === captchaSolverType);
        // if (!props) throw new Error('Invalid Captcha Solver');
        if (props) {
            this.captchaSolver = createCaptchaSolver(props);
            this.captchaSolverType = props.type || CaptchaSolverType.None;
        }
    }

    public getCaptchaSolver() {
        return this.captchaSolverType;
    }

    public getCaptchaSolvers() {
        return this.captchaSolversProps.map((item) => item.type);
    }

    public getIsWatchdogEnabled() {
        return this.watchdogManager.getIsWatchdogEnabled();
    }

    public setShouldWatchdogBeEnabled(shouldBeEnabled: boolean) {
        this.watchdogManager.setShouldWatchdogBeEnabled(shouldBeEnabled);
    }

    private solveCaptcha(captchaTask: CaptchaTask) {
        if (this.captchaSolver!.getBlockedFor() > Date.now() + 300_000) {
            throw new StopTask(`Captcha solver (${this.captchaSolverType}) blocked, check previous logs to view reason.`);
        }
        return this.captchaSolver!.solve(captchaTask);
    }

    private getSingleCheckoutID(botTask: BotTask): SingleCheckoutID {
        return `${botTask.profile.id}${botTask.website.name}`;
    }

    /**
     *
     * @param taskID of the botTask to stop, if running, and remove
     */
    public removeTask(taskID: TaskID) {
        this.botTasks.get(taskID)?.stop(true);
        this.botTasks.delete(taskID);
    }

    /**
     *
     * @param taskID of the botTask to start
     */
    public startTask(taskID: TaskID) {
        const botTask = this.botTasks.get(taskID);
        if (botTask) this.startBotTask(botTask);
    }

    /**
     *
     * starts all botTasks
     */
    public async startAll() {
        for (const [, botTask] of this.botTasks) {
            this.startBotTask(botTask);
        }
        this.watchdogManager.start();
    }

    /**
     *
     * @param taskID of the task to stop
     */
    public stopTask(taskID: TaskID) {
        this.botTasks.get(taskID)?.stop();
    }

    /**
     *
     * @param taskID of the task to stop
     */
    public stopAll() {
        return new Promise<void>((resolve, reject) => {
            let promises: Promise<void>[] = [];
            for (const [, botTask] of this.botTasks) {
                const promise = botTask.stop(true);
                if (promise) promises.push(promise);
            }
            Promise.all(promises).then(() => {
                this.activeBotTasks = [];
                resolve();
            });
        });
    }

    /**
     *
     * returns the number of botTasks
     */
    public getSize() {
        return this.botTasks.size;
    }

    /**
     *
     * @param listener to call when a task updates
     */
    public registerUpdateListener(listener: (update: TaskUpdate) => void) {
        this.updateListeners.push(listener);
    }

    /**
     *
     * @param update to send to listeners
     */
    public notifyUpdate(update: TaskUpdate) {
        for (const listener of this.updateListeners) {
            listener(update);
        }
        if (update.event !== undefined) {
            for (const listener of this.eventListeners) {
                listener(update);
            }
        }
    }

    /**
     *
     * @param listener to be called once all tasks complete
     */
    public registerTasksCompleteListener(listener: () => void) {
        this.tasksCompleteListeners.push(listener);
    }

    /**
     *
     * handles starting a botTask and setting up a listener for when all tasks complete
     * @param botTask to start
     */
    private startBotTask(botTask: BotTask) {
        const isFirstTask = this.activeBotTasks.length === 0;
        this.activeBotTasks.push(botTask.start());

        if (isFirstTask) {
            Promise.all(this.activeBotTasks).then(() => {
                this.activeBotTasks = [];
                this.notifyTasksComplete();
            });
        }
    }

    /**
     *
     * @param update to send to listeners
     */
    private updateTaskStatus(update: TaskUpdate) {
        this.notifyUpdate(update);
        if (update.event === TaskEvent.CheckoutSuccess) {
            this.onSuccessfulCheckout(update.id);
        }
    }

    private onSuccessfulCheckout(taskID: TaskID) {
        this.handleSingleCheckout(taskID);
    }

    private handleSingleCheckout(taskID: TaskID) {
        const botTask = this.botTasks.get(taskID);
        if (!botTask) return;
        const singleCheckoutID = this.getSingleCheckoutID(botTask);
        const group = this.singleCheckoutGroups.get(singleCheckoutID);
        if (group) {
            for (const id of group!) {
                if (id !== taskID) {
                    this.botTasks?.get(id)?.stop(true, StopTaskType.SingleCheckout);
                }
            }
        }
    }

    /**
     *
     * notifies all listeners when a task complete
     */
    private notifyTasksComplete() {
        for (const listener of this.tasksCompleteListeners) {
            listener();
        }
    }
}
