const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const webpack = require('webpack');
require('dotenv').config();

module.exports = {
  devtool: false,
  entry: {
    background: './src/background/service-worker.ts',
    content: './src/content/index.tsx',
    popup: './src/popup/popup.tsx',
    'dashboard-bridge': './src/content/dashboard-bridge.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'postcss-loader'],
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.GROQ_KEY_1': JSON.stringify(process.env.GROQ_KEY_1 || ''),
      'process.env.GROQ_KEY_2': JSON.stringify(process.env.GROQ_KEY_2 || ''),
      // Backend base URL for auth + comment generation. Override in extension/.env.
      'process.env.BACKEND_URL': JSON.stringify(process.env.BACKEND_URL || ''),
    }),
    new MiniCssExtractPlugin({
      filename: '[name].css',
    }),
    new CopyPlugin({
      patterns: [
        { from: 'public', to: '.' },
      ],
    }),
  ],
};
