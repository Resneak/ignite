# MAIN

## A few notes
* I have some code to clean up but wanted to push in case you wanted to work today
* Some of the code that was in `index.ts` has been moved to `models/task.ts` -- maybe not the best place, feel free to move or delete it if it is no longer needed -- (pids, 2captcha key, example task)
* Casing and naming of class properties has been converted to follow Ignite standards 


## `index.ts`
* Contains a main class that runs the application
    * Stores profiles, proxies, tasks
    * Initializes the UI 
    * Contains a function to start tasks
        * Ideally this would be done though the `TaskManager` class to create an abstraction of status updates. This way, we can show users status updates instead of logs

## `/src/utils/logger.ts`
* Should be used to allow development logging in the terminal, while saving logs to a log file in production

