import { USER_COLLECTION_NAME } from '~/constants/db.constant'
import { getDatabaseConnection } from './database.util'

export const checkInit = async () => {
  const connection = await getDatabaseConnection()
  const db = connection.db!
  const isUserExist =
    (await db.collection(USER_COLLECTION_NAME).countDocuments()) > 0

  return isUserExist
}
