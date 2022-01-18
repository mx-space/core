const { MongoClient, Db } = require('mongodb')
const path = require('path')
const ts = require('typescript')
const { readFileSync, writeFileSync } = require('fs')
const appConfigFile = path.join(__dirname, '../src/app.config.ts')

Object.assign(global, { isDev: false })

const result = ts.transpileModule(
  readFileSync(appConfigFile, { encoding: 'utf-8' }),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  },
)
const complied = result.outputText

writeFileSync(appConfigFile.replace(/\.ts$/, '.js'), complied)

const MONGO_DB = require('../src/app.config').MONGO_DB

/**
 *
 * @param {(db: Db) => Promise<any>} cb
 */
async function bootstrap(cb) {
  const client = new MongoClient(`mongodb://${MONGO_DB.host}:${MONGO_DB.port}`)
  await client.connect()
  const db = client.db(MONGO_DB.dbName)

  await cb(db)

  await client.close()
  process.exit(0)
}

module.exports = exports.bootstrap = bootstrap
