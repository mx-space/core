import type { Db } from 'mongodb'

import { defineMigration } from '../helper'

export default defineMigration(
  'v11.4.0-split-ai-summary-auto-generate',
  async (db: Db) => {
    const collection = db.collection('options')
    const aiConfig = await collection.findOne({ name: 'ai' })

    if (!aiConfig?.value) return

    const value = aiConfig.value as Record<string, any>

    // 幂等：若已拆分，则跳过
    const hasNew =
      'enableAutoGenerateSummaryOnCreate' in value ||
      'enableAutoGenerateSummaryOnUpdate' in value
    if (hasNew) return

    const legacy = value.enableAutoGenerateSummary === true
    const { enableAutoGenerateSummary: _legacy, ...rest } = value
    const next = {
      ...rest,
      enableAutoGenerateSummaryOnCreate: legacy,
      enableAutoGenerateSummaryOnUpdate: legacy,
    }

    await collection.updateOne({ name: 'ai' }, { $set: { value: next } })
  },
)
