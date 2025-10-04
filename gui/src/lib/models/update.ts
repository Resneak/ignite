export enum UpdateProgress {
    Checking,
    UpdateFound,
    UpdateDownloading,
    Done,
    Error,
    UpdateDone,
}

export interface UpdateStatus {
    /**
     * current updater status
     */
    progress: UpdateProgress;

    /**
     * description to let the user know what's currently going on
     */
    description?: string;
}
