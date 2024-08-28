import { Types } from 'mongoose'
import type { DatabaseService } from '~/processors/database/database.service'

import { AUTH_JS_USER_COLLECTION } from '../auth/auth.constant'

export class ReaderService {
  constructor(private readonly databaseService: DatabaseService) {}

  find() {
    return this.databaseService.db
      .collection(AUTH_JS_USER_COLLECTION)
      .find()
      .toArray()
  }

  async updateAsOwner(id: string) {
    return this.databaseService.db
      .collection(AUTH_JS_USER_COLLECTION)
      .updateOne({ _id: new Types.ObjectId(id) }, { $set: { isOwner: true } })
  }

  async revokeOwner(id: string) {
    return this.databaseService.db
      .collection(AUTH_JS_USER_COLLECTION)
      .updateOne({ _id: new Types.ObjectId(id) }, { $set: { isOwner: false } })
  }
}
