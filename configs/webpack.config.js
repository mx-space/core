const webpack = require('webpack')

const { resolve } = require('node:path')
module.exports = function (options) {
  options.plugins = (options.plugins || []).concat(
    new webpack.DefinePlugin({
      isDev: false,
      isTest: false,
    }),
  )

  options.output = {
    filename: 'index.js',
    path: resolve(process.cwd(), 'webpack-dist'),
  }
  return {
    ...options,
  }
}
