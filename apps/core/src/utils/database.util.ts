/**
 * @see https://github.com/surmon-china/nodepress/blob/main/src/processors/database/database.provider.ts
 */
import mongoose from 'mongoose'
import type { CollectionRefTypes } from '~/constants/db.constant'

import { chalk } from '@mx-space/compiled'

import { MONGO_DB } from '~/app.config'
import {
  NOTE_COLLECTION_NAME,
  PAGE_COLLECTION_NAME,
  POST_COLLECTION_NAME,
  RECENTLY_COLLECTION_NAME,
} from '~/constants/db.constant'
import { logger } from '~/global/consola.global'

let databaseConnectionPromise: Promise<mongoose.Connection> | null = null

mongoose.set('strictQuery', true)

export const getDatabaseConnection = () => {
  if (databaseConnectionPromise) {
    return databaseConnectionPromise
  }
  let reconnectionTask: NodeJS.Timeout | null = null
  const RECONNECT_INTERVAL = 6000

  const connection = () => {
    return mongoose
      .createConnection(MONGO_DB.customConnectionString || MONGO_DB.uri, {})
      .asPromise()
  }
  const Badge = `[${chalk.yellow('MongoDB')}]`

  const color = (str: TemplateStringsArray) => {
    return str.map((s) => chalk.green(s)).join('')
  }
  mongoose.connection.on('connecting', () => {
    logger.info(Badge, color`connecting...`)
  })

  mongoose.connection.on('open', () => {
    logger.info(Badge, color`readied!`)
    if (reconnectionTask) {
      clearTimeout(reconnectionTask)
      reconnectionTask = null
    }
  })

  mongoose.connection.on('disconnected', () => {
    logger.error(
      Badge,
      chalk.red(`disconnected! retry when after ${RECONNECT_INTERVAL / 1000}s`),
    )
    reconnectionTask = setTimeout(connection, RECONNECT_INTERVAL)
  })

  mongoose.connection.on('error', (error) => {
    logger.error(Badge, 'error!', error)
    mongoose.disconnect()
  })

  databaseConnectionPromise = connection()

  return databaseConnectionPromise
}

export const normalizeRefType = (type: keyof typeof CollectionRefTypes) => {
  return (
    ({
      Post: POST_COLLECTION_NAME,
      Note: NOTE_COLLECTION_NAME,
      Page: PAGE_COLLECTION_NAME,
      Recently: RECENTLY_COLLECTION_NAME,
    }[type] as CollectionRefTypes) || (type as CollectionRefTypes)
  )
}
