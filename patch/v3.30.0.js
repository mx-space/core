// patch for version lower than v2.0.0-alpha.1

const bootstrap = require('./bootstrap')

bootstrap(async (db) => {
  await db.collection('users').updateMany({}, { $unset: { authCode: 1 } })
})
