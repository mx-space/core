// why this, because we dont need pino logger, and this logger can not bundle whole package into only one file with ncc.
// only work with fastify v4+ with pino v8+

module.exports = {
  symbols: {
    // https://github.com/pinojs/pino/blob/master/lib/symbols.js
    serializersSym: Symbol.for('pino.serializers'),
  },
  stdSerializers: {
    error: function asErrValue(err) {
      const obj = {
        type: err.constructor.name,
        msg: err.message,
        stack: err.stack,
      }
      for (const key in err) {
        if (obj[key] === undefined) {
          obj[key] = err[key]
        }
      }
      return obj
    },
  },
}
