import { createAiRuntimeTables } from '@mx-space/db-schema/schema'

export * from '@mx-space/db-schema/schema'
export const { aiTranslations, aiInsights } = createAiRuntimeTables()
