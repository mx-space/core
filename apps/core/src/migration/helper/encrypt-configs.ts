import 'reflect-metadata'
import { ENCRYPT } from '~/app.config'
import { initializeApp } from '~/global/index.global'
import { generateDefaultConfig } from '~/modules/configs/configs.default'
import { encryptObject } from '~/modules/configs/configs.encrypt.util'
import type { IConfig, IConfigKeys } from '~/modules/configs/configs.interface'
import { configSchemaMapping } from '~/modules/configs/configs.schema'
import { getDatabaseConnection } from '~/utils/database.util'

console.log(ENCRYPT)

const allOptionKeys: Set<IConfigKeys> = new Set(
  Object.keys(configSchemaMapping) as IConfigKeys[],
)

async function main() {
  await initializeApp()
  const connection = await getDatabaseConnection()
  const db = connection.db!
  const configs: any[] = []
  const ret = db.collection('options').find()

  for await (const current of ret) {
    configs.push(current)
  }

  const mergedConfig = generateDefaultConfig()
  configs.forEach((field) => {
    const name = field.name as keyof IConfig

    if (!allOptionKeys.has(name)) {
      return
    }

    const value = field.value
    mergedConfig[name] = { ...mergedConfig[name], ...value }
  })

  const encrypted = encryptObject(mergedConfig as IConfig)

  for await (const [key, value] of Object.entries(encrypted)) {
    configs[key] = value
    await db.collection('options').updateOne(
      {
        name: key,
      },
      {
        $set: {
          value,
        },
      },
    )
  }

  await connection.close()
  process.exit(0)
}

main()
