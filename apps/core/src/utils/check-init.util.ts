import { READER_COLLECTION_NAME } from '~/constants/db.constant'
import { getDatabaseConnection } from './database.util'

export const checkInit = async () => {
  const connection = await getDatabaseConnection()
  const db = connection.db!
  const isUserExist =
    (await db
      .collection(READER_COLLECTION_NAME)
      .countDocuments({ role: 'owner' })) > 0

  return isUserExist
}
