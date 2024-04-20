// patch for version lower than v2.0.0-alpha.1
import type { Db } from 'mongodb'

export default (async function v0560lpha1(db: Db) {
  const backupOptions = await db.collection('options').findOne({
    name: 'backupOptions',
  })

  if (!backupOptions) {
    return
  }

  if (!backupOptions.value) {
    return
  }

  if (backupOptions.value.endpoint) {
    return
  }

  const region = backupOptions.value.region
  backupOptions.value.endpoint = `https://cos.${region}.myqcloud.com`
  backupOptions.value.region = 'auto'
  await db
    .collection('options')
    .updateOne(
      { name: 'backupOptions' },
      { $set: { value: backupOptions.value } },
    )
})
