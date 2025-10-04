## Project overview
The project is structured in a specific way. There's 3 base directories:
```
- lib
- main
- renderer
```

### main

Contains all source code that operate on Electon's `main` process. 
This includes things like `BrowserWindow`s and `ipc` calls.

### renderer

This directory should contain all source code that operates on Electron's `renderer` process (contrary to 'main' above).
This directory mainly deals with UI. React components, redux actions, containers, reducers etc. are welcome here.

### Conventions
The linter that comes pre-installed should handle most code rules. When a rule is working on your nerves and you believe it's reasonable to disable it globally, feel free to edit `.eslintrc.json`. Think about whether you need to actually disable the rule (0) or set it to a warning (1), though. When in doubt, discuss with the team or mention it during code review.

When it comes to filenames try to stick to **camelCase** for all `.ts` & `.js` files and **PascalCase** for React components. 

Also please don't over use `index.ts` files. 

### Unit tests
Unit tests run against specific lines of code. 
So it makes sense to place them right next to that code.
For example, if you have a 'counter' component, it could have source files like `Counter.tsx`, `Counter.scss` & `Counter.test.ts`. 

Integration tests run against many lines of code in many files. There is no single place that would make sense, so it’s best to have them in a /tests directory.

Run `npm test` to run all tests.

## Commands
Start development with hot reloading:
```bash
npm run start-dev
```

Run production build without packaging:
```bash
npm start
```

Remove `dist` and `release` build folders:
```bash
npm run cleanup
```

## Packaging
We use [Electron builder](https://www.electron.build/) to build and package the application. By default you can run the following to package for your current platform:

```bash
npm run dist
```

This will create a installer for your platform in the `releases` folder.

You can make builds for specific platforms (or multiple platforms) by using the options found [here](https://www.electron.build/cli). E.g. building for all platforms (Windows, Mac, Linux):

```bash
npm run dist -- -mwl
```

## Components
**base**

[Electron](https://electronjs.org/)

[TypeScript](https://www.typescriptlang.org/)

[Webpack](https://webpack.js.org/)

[React](https://reactjs.org/)

[Redux](https://redux.js.org/)

**testing**

[Jest](https://facebook.github.io/jest/)

**code formatters**

[Prettier](https://prettier.io/)

**icons**
[react-icons](https://react-icons.github.io/)

**others**

[Husky (simplifies git hooks)](https://www.npmjs.com/package/husky)
