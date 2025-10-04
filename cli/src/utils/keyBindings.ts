import Main from '../main';
import { clear, paste } from './terminal';

interface KeyBinding {
    key: string;
    description: string;
    fn?: (() => void) | (() => Promise<void>);
}

export default class KeyBindings {
    private static isRegistered = false;

    private static main: Main;

    private static keyBindings: KeyBinding[] = [
        // {
        //     key: 'v',
        //     description: 'Paste.',
        //     fn: paste,
        // },
        // {
        //     key: 'a',
        //     description: 'View all available keyboard shortcuts.',
        //     fn: KeyBindings.list,
        // },
        // {
        //     key: 's',
        //     description: 'Start all tasks.',
        //     fn: undefined,
        // },
    ];

    private static list() {
        clear();
        console.table([
            ...KeyBindings.keyBindings.map((binding) => {
                return {
                    key: `Ctrl+${binding.key}`,
                    description: binding.description,
                };
            }),
        ]);
    }

    public static register(main: Main) {
        KeyBindings.main = main;
        // KeyBindings.keyBindings.find((binding) => binding.key === 's')!.fn = main.startTasks.bind(main);

        if (KeyBindings.isRegistered) return;
        KeyBindings.isRegistered = true;

        process.stdin.on('keypress', (ch, key) => {
            if (key && key.ctrl) {
                // console.log(key.name);
                const binding = KeyBindings.keyBindings.find((binding) => {
                    return binding.key === key.name;
                });
                binding?.fn?.();
            }
        });
    }
}

// process.stdin.on('mousepress', function (info) {
//     console.log('got "mousepress" event at %d x %d', info.x, info.y);
// });

// process.on('exit', function () {
//     console.log('EXIT');
//     // disable mouse on exit, so that the state
//     // is back to normal for the terminal
//     keypress.disableMouse(process.stdout);
// });

// process.stdin.setRawMode(true);
// process.stdin.resume();
