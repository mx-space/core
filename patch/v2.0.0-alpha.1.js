// patch for version lower than v2.0.0-alpha.1

const bootstrap = require('./bootstrap')

bootstrap(async (db) => {
  return await Promise.all([
    ['notes', 'posts'].map(async (collectionName) => {
      return db
        .collection(collectionName)
        .updateMany({}, { $unset: { options: 1 } })
    }),
    db.collection('categories').updateMany({}, { $unset: { count: '' } }),
  ])
})
