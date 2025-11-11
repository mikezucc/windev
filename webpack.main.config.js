const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: './src/main/main.ts',
  target: 'electron-main',
  devtool: process.env.NODE_ENV === 'production' ? 'source-map' : 'eval-source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist/main'),
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    }),
  ],
  externals: [
    // Don't bundle node_modules in main process
    ({ request }, callback) => {
      if (/^[a-z][a-z\-0-9+.]*$/i.test(request) && !request.includes('/')) {
        return callback(null, 'commonjs ' + request);
      }
      callback();
    },
  ],
};
