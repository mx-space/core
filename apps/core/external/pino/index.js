// why this: we dont need pino logger, and it can't be bundled into a single file reliably.
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
