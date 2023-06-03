import { DB_CONNECTION_TOKEN } from '~/constants/system.constant'
import { getDatabaseConnection } from '~/utils/database.util'

export const databaseProvider = {
  provide: DB_CONNECTION_TOKEN,
  useFactory: getDatabaseConnection,
}
