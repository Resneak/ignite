const path = require('path');
const config = require('./webpack.config');

const { merge } = require('webpack-merge');
const WebpackObfuscator = require('webpack-obfuscator');

module.exports = merge(config, {
    devtool: false,
    output: {
        path: path.resolve(__dirname, './bundled/'),
        filename: '[name].prod.js',
    },
    plugins: [
        new WebpackObfuscator({
            target: 'node',
            selfDefending: true,
            stringArrayThreshold: 0.4,
            identifierNamesGenerator: 'mangled-shuffled',
            ignoreRequireImports: true,
            splitStrings: true,
        }),
    ],
});
