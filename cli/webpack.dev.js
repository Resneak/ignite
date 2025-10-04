const path = require('path');
const config = require('./webpack.config');
const { merge } = require('webpack-merge');

module.exports = merge(config, {
    mode: 'development',
    devtool: 'source-map',
    output: {
        path: path.resolve(__dirname, './bundled/'),
        filename: '[name].dev.js',
    },
});
