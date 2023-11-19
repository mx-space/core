import type { Db } from 'mongodb'
import type { Connection } from 'mongoose'

export const defineMigration = (
  name: string,
  migrate: (db: Db, connection: Connection) => Promise<void>,
) => {
  return {
    name,
    run: migrate,
  }
}
