import fs, { appendFile, writeFile } from 'fs';
import stripAnsi from 'strip-ansi';
import path from 'path';
import { capitalizeFirstLetter, isDev, isProdDev } from './general';
import { AppData, Asset, Bundle, User } from '../data/files';
import { SiteAccountProps } from '../../../lib/models/siteAccount';
import Task from '../../../lib/models/task';
import Profile from '../../../lib/models/profile';

/**
 * class for everything related to file storage
 */
export default class Storage {
    /**
     * append specified content to the end of a file
     *
     * if the file doesn't exist yet, it will be created
     */
    static appendToFile(fileName: string, contents: string | Uint8Array): Promise<void | Error> {
        const filePath = Storage.getPath(fileName);
        return new Promise((resolve, reject) => {
            let content = typeof contents === 'string' ? stripAnsi(contents) : contents;
            appendFile(filePath, content, (err) => {
                if (err) reject(err);
                resolve();
            });
        });
    }

    static writeToFile(fileName: string, contents: string | Uint8Array): Promise<void | Error> {
        const filePath = Storage.getPath(fileName);
        return new Promise((resolve, reject) => {
            let content = typeof contents === 'string' ? stripAnsi(contents) : contents;
            writeFile(filePath, content, (err) => {
                if (err) reject(err);
                resolve();
            });
        });
    }

    static deleteFile(filename: string): Promise<void | Error> {
        const filePath = Storage.getPath(filename);
        return new Promise((resolve, reject) => {
            fs.unlink(filePath, (err) => {
                if (err) reject(err);
                resolve();
            });
        });
    }
    /**
     *
     * @param file
     * @returns a string containing the contents of the file
     */
    static readFileSync = (file: string) => {
        return fs.readFileSync(Storage.getPath(file), 'utf-8');
    };

    /**
     *
     * @param file
     * @returns a buffer
     */
    static readFile = (file: string): Promise<string> => {
        const filePath = Storage.getPath(file);
        return new Promise((resolve, reject) => {
            fs.readFile(filePath, 'utf-8', (err, data) => {
                if (err) reject(err);
                resolve(data);
            });
        });
    };

    /**
     * returns the path to an asset based on the environment
     */
    static getPath = (file: string) => {
        // app data files
        if (Object.values(AppData).includes(file)) {
            return path.join(Storage.getOSAppDataPath(), file);
        }
        // assets
        else if (Object.values(Asset).includes(file)) {
            if (isDev()) {
                return path.resolve('../lib/assets/', file);
            } else {
                return path.resolve(__dirname, '../../lib/assets/', file);
            }
        }
        // user files
        else if (Object.values(User).includes(file)) {
            if (isDev()) {
                return path.resolve(`./development/${file}`);
            } else if (isProdDev()) {
                return path.resolve(file);
            } else {
                return path.resolve(path.dirname(process.execPath), file);
            }
        }
        // bundles
        else if (Object.values(Bundle).includes(file)) {
            if (isDev()) {
                return path.join(__dirname, `${file}.dev.js`);
            } else {
                return path.join(__dirname, `./ignite.loader.js`); //TODO allow other files
            }
        } else {
            throw new Error('Invalid File');
        }
    };

    static async addAccount(account: SiteAccountProps) {
        const filePath = this.getPath(User.Accounts);
        if (!fs.existsSync(filePath)) {
            await this.writeToFile(User.Accounts, 'Site:Email Address:Password');
        }
        await this.appendToFile(User.Accounts, `\n${account.site}:${account.username}:${account.password}`);
    }

    static async logCheckout(task: Task, profile: Profile) {
        const filePath = this.getPath(User.Checkouts);
        if (!fs.existsSync(filePath)) {
            await this.writeToFile(User.Checkouts, 'Store, Product, SKU, Size, Quantity, Mode, Proxy, Profile, E-mail, Password');
        }

        await this.appendToFile(
            User.Checkouts,
            `\n${capitalizeFirstLetter(task.websiteName)}, ${task.product.name?.split(',').join('')}, ${task.product.id}, ${(
                task.product.size?.name ||
                task.product.size?.value ||
                'N/A'
            )
                .split(',')
                .join('')}, ${task.atcQuantity}, ${task.mode}, ${task.checkoutProxy}, ${profile.id.split(',').join('')}, ${task.username || '-'}, ${
                task.password || '-'
            }`
        );
    }

    static async printPkgFileSystem() {
        const base = path.resolve(__dirname, '../../');

        const search = async (path: string, fileSystem: any) => {
            return new Promise(async (res, rej) => {
                console.log(`Searching ${path}`);
                try {
                    const files = fs.readdirSync(path);
                    files.forEach(async (file) => {
                        console.log(file);
                        fileSystem[file] = file.match(/node_modules/) ? 'node_modules' : await search(`${path}/${file}`, {});
                    });
                    res(fileSystem);
                } catch (err) {
                    // file
                    console.log(`notdir ${path}`);
                    const file = (fileSystem[`${path?.split?.('/')?.pop()}`] = {});
                    console.log(file);

                    res(file);
                }
            });
        };

        const fileSystem = await search(base, {});
        fs.writeFileSync(path.resolve(path.dirname(process.execPath), './fileSystem.json'), JSON.stringify(fileSystem));
    }

    /**
     *
     * @returns the os specific application data path and create the directory if it doesn't exist
     * mac:  /Users/<Your user>/Library/Preferences/IgniteCLI/log.txt
     * windows: Users/<Your user>/AppData/Roaming/IgniteCLI/log.txt
     */
    private static getOSAppDataPath() {
        const appPath = path.join(
            process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + '/.local/share'),
            'IgniteCLI'
        );
        if (!fs.existsSync(appPath)) {
            fs.mkdirSync(appPath);
        }
        return appPath;
    }
}
