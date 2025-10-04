const gulp = require("gulp");
const zip = require('gulp-zip');
const version = require('./package.json').version;

function copyDarwin(cb) {
    const dest = "./bundled/darwin";

    return gulp.src('../http-client/src/darwin/client')
        .pipe(gulp.dest(dest));
}

function copyWindows(cb) {
    return gulp.src('../http-client/src/win32/client.exe')
        .pipe(gulp.dest("./bundled/win32"));
}

function copyProto(cb) {
    return gulp.src('../http-client/src/http.proto')
        .pipe(gulp.dest("./bundled"));
}


function copyChromium(cb) {
    return gulp.src('../bot/node_modules/puppeteer/.local-chromium/win64-884014/chrome-win/**/*')
        .pipe(gulp.dest('./production/chromium'));
}

function zipProd(cb) {
    
    return gulp.src('./production/**/*')
		.pipe(zip(`IgniteCLI-${version}.zip`))
		.pipe(gulp.dest('dist'))
}


exports.default = gulp.parallel(copyDarwin, copyWindows, copyProto);

exports.production = gulp.parallel(copyDarwin, copyWindows, copyProto, copyChromium);

exports.zip = gulp.parallel(zipProd);