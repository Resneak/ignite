const rcedit = require('rcedit');
const { join } = require('path');

let exe = join(__dirname, '../build/IgniteCLI.exe');
let icon = join(__dirname, './icon.ico');

(async () => {
    await rcedit(exe, { icon: icon }, (e) => {
        console.log(e);
    });
})();
