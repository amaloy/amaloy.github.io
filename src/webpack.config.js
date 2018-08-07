const path = require('path');

module.exports = {
  entry: './js/index.jsx',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, '..')
  },
  module: {
    loaders: [{
      test: /\.jsx?$/,
      exclude: /node_modules/,
      loader: 'babel-loader',
      query: {
        presets: ['react']
      }
    }]
  }
};

