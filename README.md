# Ignite
The repository is structured as a monorepo where each subdirectory (except lib) is it's own package. The monorepo itself is also an npm package. 
```
- bot
- cli
- gui
- lib
```

### bot
Contains the code used to create, start, and stop bot tasks. Front-ends should interact with the bot module code through the task manager class.
* See the `bot/README.md` for details on developing bot scripts and the bot module

### cli
Contains the code connecting the bot module to the command line interface
* See the `cli/README.md` for details on developing the cli

### gui
Contains the code connecting the bot module to the Electron App
* See the `gui/README.md` for details on developing the electron app

### lib
The only directory that is not an package. Contains the code and configurations shared among all packages. This includes any code that should be reused between the bot, cli and/or gui

## Adding packages
1. Development dependencies belong in the base package (i.e. if you are running `npm i --save-dev <package name>` do it in the base `/ignite` directory)
2. Bot/CLI/GUI specific pacakges belong in their pacakges

## Version Control 
The main branch contains current production code.
All other branches should follow the convention of `<package>-<feature>`, for example, creating a new branch to work on footsites could look like: `bot-footsites`. For multi-word features, separate words with a hyphen and keep all words lowercase (e.g. `bot-proxy-groups`)


## Scripts
* `npm run setup` installs all dependencies
* `npm run gui` runs the gui in development mode (shortcut for `npm run start-dev` in the gui package)
* `npm run gui-persist` runs the gui in a persistant development mode (shortcut for `npm run start-dev-persist` in the gui package)
* `npm run cli` runs the cli in a development mode (shortcut for `npm run start-dev` in the cli package)
* `npm run cli-exe` builds the cli (shortcut for `npm run exe` in the cli package) _see cli/README.md` for information on building the cli_