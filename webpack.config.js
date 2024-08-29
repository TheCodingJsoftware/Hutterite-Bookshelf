const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: {
        index: './src/index.ts',
        privacy_option: './src/privacy_policy.ts',
    },
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'dist'),
        publicPath: '/dist/',
    },
    module: {
        rules: [
        {
            test: /\.ts$/,
            use: 'ts-loader',
            exclude: /node_modules/,
        },
        {
            test: /\.css$/,
            use: [MiniCssExtractPlugin.loader, 'css-loader'],
        },
        ],
    },
    mode: 'production',
    optimization: {
        minimize: true,
        runtimeChunk: 'single',
        splitChunks: {
        chunks: 'all',
        },
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: '[name].[contenthash].css',
        }),
        new HtmlWebpackPlugin({
            template: './templates/index.html',
            filename: 'index.html',
            chunks: ['index', 'runtime', 'vendors'], // Include only the index.ts related chunks
        }),
        new HtmlWebpackPlugin({
            template: './templates/privacy_policy.html',
            filename: 'privacy_policy.html',
            chunks: ['privacy_option', 'runtime', 'vendors'], // Include only the privacy_policy.ts related chunks
        }),
    ],
};
