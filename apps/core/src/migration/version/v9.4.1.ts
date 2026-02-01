import { AI_TRANSLATION_COLLECTION_NAME } from '~/constants/db.constant'
import type { Db } from 'mongodb'
import { defineMigration } from '../helper'

export default defineMigration(
  'v9.4.1-rename-aiProviderType-to-aiProvider',
  async (db: Db) => {
    const translations = db.collection(AI_TRANSLATION_COLLECTION_NAME)

    // Rename aiProviderType to aiProvider
    await translations.updateMany(
      { aiProviderType: { $exists: true } },
      { $rename: { aiProviderType: 'aiProvider' } },
    )

    // Remove deprecated aiProviderId field
    await translations.updateMany(
      { aiProviderId: { $exists: true } },
      { $unset: { aiProviderId: '' } },
    )
  },
)
