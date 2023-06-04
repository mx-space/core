import { getDatabaseConnection } from './database.util'

export const checkInit = async () => {
  const connection = await getDatabaseConnection()
  const db = connection.db
  const isUserExist = (await db.collection('users').countDocuments()) > 0

  return isUserExist
}
