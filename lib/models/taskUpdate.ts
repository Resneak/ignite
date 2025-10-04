export enum TaskStatusColor {
    Neutral = 'neutral',
    Info = 'info',
    Success = 'success',
    Warning = 'warning',
    Error = 'error',
    Cart = 'cart',
    Ping = 'ping',
}

export enum TaskEvent {
    /**
     * notifies watchdog that this task is ready to wait for the watchdog task
     * to pause it until the product is back in stock
     */
    Watch = 'watch',
    /**
     * triggers watchdog tasks to start up
     */
    InStock = 'in-stock',
    Carted = 'carted',
    CheckoutSuccess = 'checkout-success',
    CheckoutDecline = 'checkout-decline',
    Paused = 'paused',
    UnPaused = 'unpaused',
    Stopped = 'stopped',
    /**
     * notifies listeners that an account has been created
     * sends a message in the form of "email:password"
     */
    AccountCreated = 'account-created',
}

export default interface TaskUpdate {
    /**
     * task ID
     */
    id: string;

    pid: string;

    color: TaskStatusColor;

    message: string;

    event?: TaskEvent;
}
