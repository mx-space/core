// Migration for AI multi-provider support
// Converts old OpenAI-only config to new multi-provider structure
import type { Db } from 'mongodb'

export default async function v0850(db: Db) {
  const aiConfig = await db.collection('options').findOne({
    name: 'ai',
  })

  if (!aiConfig?.value) {
    return
  }

  // Already migrated
  if (aiConfig.value.providers) {
    return
  }

  const {
    openAiKey,
    openAiEndpoint,
    openAiPreferredModel,
    enableDeepReading: _enableDeepReading, // removed field
    ...rest
  } = aiConfig.value

  // Build new config structure
  const newValue = {
    ...rest,
    providers: openAiKey
      ? [
          {
            id: 'default',
            name: 'OpenAI',
            type: 'openai',
            apiKey: openAiKey,
            endpoint: openAiEndpoint || undefined,
            defaultModel: openAiPreferredModel || 'gpt-4o-mini',
            enabled: true,
          },
        ]
      : [],
    // All features use the first provider by default
    summaryModel: openAiKey ? { providerId: 'default' } : undefined,
    writerModel: openAiKey ? { providerId: 'default' } : undefined,
    commentReviewModel: openAiKey ? { providerId: 'default' } : undefined,
  }

  await db.collection('options').updateOne(
    { name: 'ai' },
    {
      $set: { value: newValue },
    },
  )
}
