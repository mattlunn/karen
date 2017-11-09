const webpack = require('webpack');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

const extractLessPlugin = new ExtractTextPlugin({
  filename: 'app.[contenthash].css'
});

module.exports = {
  entry: path.join(__dirname, 'client.js'),
  output: {
    path: path.join(__dirname, 'static'),
    filename: 'app.[chunkhash].min.js'
  },
  module: {
    rules: [{
        test: /\.js$/,
        exclude: /node_modules/,
        use: [{
          loader: 'babel-loader',
          options: {
            plugins: ['transform-decorators-legacy'],
            presets: ['react', 'env', 'stage-2'],
          }
        }]
      }, {
      test: /\.less$/,
      use: extractLessPlugin.extract({
        use: [{
          loader: 'css-loader'
        }, {
          loader: 'less-loader'
        }]
      })
    }]
  },
  plugins: [
    new webpack.optimize.UglifyJsPlugin({
      compress: { warnings: false },
      mangle: true,
      sourceMap: true,
      beautify: false,
      dead_code: true
    }),
    extractLessPlugin,
    new HtmlWebpackPlugin({
      template: __dirname + '/views/layout.html'
    })
  ],

  cache: true,
  devtool: 'source-map'
};