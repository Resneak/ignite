import { exec } from 'child_process';
import UserAccount from '../../../lib/models/user';
import Env from '../env';

export default class AntiDebugger {
    /**
     * application names (process names) that if detected should cause the ignite to close
     */
    bannedApplications = [
        'charles',
        'postman',
        'capsa',
        'tcpdump',
        'wireshark',
        'kismet',
        'fiddler',
        'etherape',
        'omnipeek',
        'netflow',
        'solarwinds',
        'pcap',
        'netminer',
        'airsnort',
        'bettercap',
        'burpsuite',
        'burp suite',
        'hexinject',
        'mitmproxy',
        'dnschef',
        'sslsplit',
        'sslstrip',
        'ghidra',
    ];

    private user?: UserAccount;

    constructor(user?: UserAccount) {
        this.user = user;
    }

    public checkAll() {
        this.checkForBannedApplications();
    }

    public checkForBannedApplications() {
        this.isRunning(this.bannedApplications)
            .then((runningProcesses: string[]) => {
                if (runningProcesses.length > 0) {
                    this.handleDebuggingDetected();
                }
            })
            .catch((err) => {
                this.handleDebuggingDetected();
            });
    }

    private handleDebuggingDetected() {
        if (!Env.isDev) {
            console.log(`Fatal Error Occured. Restart the application.`);
            process.exit();
        }
    }

    /**
     *
     * @param processNames to check for
     * @returns an array of the process names that were found to be running
     */
    private isRunning(processNames: string[]): Promise<string[]> {
        let platform = process.platform;
        let cmd = '';
        switch (platform) {
            case 'win32':
                cmd = `tasklist`;
                break;
            case 'linux':
                cmd = `ps -A`;
                break;
            case 'darwin':
                cmd = `ps -ax`;
                break;
            default:
                break;
        }
        return new Promise((resolve, reject) => {
            exec(cmd, (err: any, stdout: any, stderr: any) => {
                const runningProcesses: any[] = [];
                for (const processName of processNames) {
                    const processRunning = stdout.toLowerCase().indexOf(processName.toLowerCase()) > -1;
                    if (processRunning) runningProcesses.push(processName);
                }
                resolve(runningProcesses);
            });
        });
    }
}
