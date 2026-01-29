import { AUTH_JS_ACCOUNT_COLLECTION } from '~/modules/auth/auth.constant'
import type { Db } from 'mongodb'
import { defineMigration } from '../helper'

export default defineMigration(
  'v9.3.1-migrate-auth-accounts-fields',
  async (db: Db) => {
    const accounts = db.collection(AUTH_JS_ACCOUNT_COLLECTION)

    await accounts.updateMany(
      {
        $or: [
          { providerAccountId: { $exists: true } },
          { provider: { $exists: true } },
          { access_token: { $exists: true } },
          { token_type: { $exists: true } },
          { refresh_token: { $exists: true } },
          { id_token: { $exists: true } },
        ],
      },
      [
        {
          $set: {
            accountId: { $ifNull: ['$accountId', '$providerAccountId'] },
            providerId: { $ifNull: ['$providerId', '$provider'] },
            accessToken: { $ifNull: ['$accessToken', '$access_token'] },
            tokenType: { $ifNull: ['$tokenType', '$token_type'] },
            refreshToken: { $ifNull: ['$refreshToken', '$refresh_token'] },
            idToken: { $ifNull: ['$idToken', '$id_token'] },
          },
        },
        {
          $unset: [
            'providerAccountId',
            'provider',
            'access_token',
            'token_type',
            'refresh_token',
            'id_token',
          ],
        },
      ],
    )
  },
)
