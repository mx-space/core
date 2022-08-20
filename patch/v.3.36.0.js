// patch for version lower than v3.36.0

const bootstrap = require('./bootstrap')

bootstrap(async (db) => {
  await db.collection('snippets').updateMany(
    {
      type: 'function',
    },
    {
      $set: {
        method: 'GET',
        enable: true,
      },
    },
  )
})
