import type { Db } from 'mongodb'

import { defineMigration } from '../helper'

export default defineMigration(
  'v10.1.0-migrate-ai-summary-target-language',
  async (db: Db) => {
    const collection = db.collection('options')
    const aiConfig = await collection.findOne({ name: 'ai' })

    if (!aiConfig?.value) return

    const value = aiConfig.value as Record<string, any>

    // Already migrated
    if (Array.isArray(value.summaryTargetLanguages)) return

    const oldLang = value.aiSummaryTargetLanguage
    let summaryTargetLanguages: string[] = []

    if (oldLang && oldLang !== 'auto') {
      summaryTargetLanguages = [oldLang]
    }

    const newValue = { ...value }
    delete newValue.aiSummaryTargetLanguage
    newValue.summaryTargetLanguages = summaryTargetLanguages

    await collection.updateOne({ name: 'ai' }, { $set: { value: newValue } })
  },
)
