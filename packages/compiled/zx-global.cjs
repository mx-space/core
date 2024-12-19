// import zx from './dist/index.cjs'
const zx = require('./dist/index.cjs').zx

Object.assign(global, zx)
