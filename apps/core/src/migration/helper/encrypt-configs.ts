import 'reflect-metadata'
import { ENCRYPT } from '~/app.config'
import { initializeApp } from '~/global/index.global'
import { generateDefaultConfig } from '~/modules/configs/configs.default'
import * as optionDtos from '~/modules/configs/configs.dto'
import { encryptObject } from '~/modules/configs/configs.encrypt.util'
import type { IConfigKeys } from '~/modules/configs/configs.interface'
import { IConfig } from '~/modules/configs/configs.interface'
import { getDatabaseConnection } from '~/utils/database.util'
import { plainToInstance } from 'class-transformer'

console.log(ENCRYPT)

const allOptionKeys: Set<IConfigKeys> = new Set()
Object.entries(optionDtos).reduce((obj, [key, value]) => {
  const optionKey = (key.charAt(0).toLowerCase() +
    key.slice(1).replace(/Dto$/, '')) as IConfigKeys
  allOptionKeys.add(optionKey)
  return {
    ...obj,
    [String(optionKey)]: value,
  }
}, {})

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

  const encrypted = encryptObject(plainToInstance(IConfig as any, mergedConfig))

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
