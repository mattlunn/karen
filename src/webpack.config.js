const webpack = require('webpack');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')

module.exports = {
  entry: path.join(__dirname, 'client.js'),
  output: {
    path: path.join(__dirname, 'static'),
    filename: 'app.[chunkhash].min.js'
  },
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  module: {
    rules: [{
      test: /\.js$/,
      exclude: /node_modules/,
      use: [{
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-react', ['@babel/preset-env', { targets: { browsers: ['last 2 Chrome versions'] }}]],
        }
      }]
    }, {
      test: /\.(css|less)$/i,
      use: [MiniCssExtractPlugin.loader, 'css-loader', 'less-loader'],
    }]
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'app.[contenthash].css'
    }),
    new webpack.ContextReplacementPlugin(/moment[\/\\]locale$/, /uk/),
    new HtmlWebpackPlugin({
      template: __dirname + '/views/layout.html'
    })
  ],

  cache: true,
  devtool: 'source-map'
};