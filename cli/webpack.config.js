const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
    mode: 'production',

    entry: { login: './src/login.ts' },

    target: 'node',

    resolve: {
        extensions: ['.ts', '.js', '.json'],
    },

    externals: [nodeExternals(), { 'autosolve-client': 'commonjs autosolve-client' }],

    module: {
        rules: [
            {
                test: /\.ts/,
                include: [path.resolve(__dirname, './src'), path.resolve(__dirname, '../lib'), path.resolve(__dirname, '../bot')],
                exclude: /node_modules/,
                loader: 'babel-loader',
                options: {
                    cacheDirectory: true,
                    babelrc: false,
                    presets: [['@babel/preset-env', { targets: 'maintained node versions' }], '@babel/preset-typescript'],
                    plugins: [['@babel/plugin-proposal-class-properties', { loose: true }], 'minify-dead-code-elimination'],
                },
            },
        ],
    },
};
