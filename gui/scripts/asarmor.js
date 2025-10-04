const { Asarmor, Bloat, Trashify } = require('asarmor');
const { join } = require('path');

exports.default = async ({ appOutDir, packager }) => {
    try {
        const asarPath = join(packager.getResourcesDir(appOutDir), 'app.asar');
        const asarmor = new Asarmor(asarPath);

        console.log('\nApplying asar protection ...');

        // Add non-existing junk files to the archive
        asarmor.applyProtection(new Trashify(['.git']));
        asarmor.applyProtection(
            new Trashify(['license', 'authentication', 'passwords', 'development', 'production', 'master'], Trashify.Randomizers.junkedJsExtension)
        );

        // Adds 150 GB of bloat files when 'asar extract' is ran
        asarmor.applyProtection(new Bloat(150));

        asarmor.write(asarPath);

        console.log(`Applied asar protection \n`);
    } catch (err) {
        console.error(err);
    }
};
