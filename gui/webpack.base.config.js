const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const nodeExternals = require('webpack-node-externals')

const plugins = [];

if (process.env.NODE_ENV !== 'production') {
    plugins.push(
        new CopyPlugin({
            patterns: [{ from: './dev-app-update.yml', to: 'dev-app-update.yml' }],
        })
    );
}

module.exports = {
    mode: 'development',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
    },
    node: {
        // returns the actual dir where the transpiled js file is in, not the source ts file
        __dirname: false,
        __filename: false,
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js', '.json', '.svg', '.png'],
    },
    devtool: process.env.NODE_ENV === 'production' ? undefined : 'source-map',
    externals: [nodeExternals()],
    plugins,
    module: {
        rules: [
            {
                test: /\.(gif|png|jpe?g|svg)$/,
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            name() {
                                return process.env.NODE_ENV === 'production'
                                    ? '[contenthash].[ext]'
                                    : 'assets/[name].[ext]';
                            },
                        },
                    },
                    {
                        loader: 'image-webpack-loader',
                        options: {
                            disable: true,
                        },
                    },
                ],
            },
        ],
    },
};
