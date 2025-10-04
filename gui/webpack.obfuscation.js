const WebpackObfuscator = require('webpack-obfuscator');

const ObfuscationPlugin = new WebpackObfuscator({
    target: 'node',
    selfDefending: true,
    stringArrayThreshold: 0.4,
    identifierNamesGenerator: 'mangled-shuffled',
    disableConsoleOutput: true,
    ignoreRequireImports: true,
    splitStrings: true,
    numbersToExpressions: true,
});

module.exports = ObfuscationPlugin;
