import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';

const getPuppeteer = (useStealth?: boolean) => {
    const isPkg = typeof process['pkg'] !== 'undefined';

    if(isPkg){
        process.env.PUPPETEER_EXECUTABLE_PATH = path.join(path.dirname(process.execPath), "./chromium/chrome.exe");
    }

    if(useStealth) {
        puppeteer.use(StealthPlugin());
    }
    return puppeteer;
}

export default getPuppeteer;