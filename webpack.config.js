const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = {
  entry: {
    index:'./src/index.ts',
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist/js'),
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
        use: ['style-loader', 'css-loader'],
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
    new BundleAnalyzerPlugin(),
    new MiniCssExtractPlugin({
        filename: '[name].[contenthash].css',
    }),
  ],
};
