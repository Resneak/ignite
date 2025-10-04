const merge = require('webpack-merge');
const ObfuscationPlugin = require('./webpack.obfuscation');
const baseConfig = require('./webpack.main.config');

module.exports = merge.smart(baseConfig, {
    mode: 'production',
    plugins: [ObfuscationPlugin],
});
