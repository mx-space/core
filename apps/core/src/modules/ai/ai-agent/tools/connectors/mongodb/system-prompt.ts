import type { AIAgentToolSystemPrompt } from '../../connector.types'

export const mongoToolSystemPrompt: AIAgentToolSystemPrompt = {
  purpose:
    'Query and, when required, prepare write actions against Mix Space MongoDB collections for user confirmation.',
  whenToUse: [
    'Use this tool whenever the user asks to inspect records, count data, or aggregate documents.',
    'Use this tool for insert/update/delete requests instead of pretending the data was already changed.',
    'Prefer running a read operation first (find/findOne/countDocuments) to confirm scope before any write.',
  ],
  usageRules: [
    'Read operations (find, findOne, countDocuments, distinct, aggregate) execute directly — use them freely for investigation.',
    'Write operations (insertOne, insertMany, updateOne, updateMany, replaceOne, deleteOne, deleteMany, findOneAndUpdate, findOneAndReplace, findOneAndDelete, bulkWrite) return a pending confirmation actionId and are NOT executed yet.',
    'If a pending actionId is returned, tell the user what will happen and ask them to confirm or reject in the UI.',
    'Do not proceed past a pending write as if it succeeded; wait for the confirmation result.',
    'Key collections and their purpose: posts (blog posts), notes (journals), pages (static pages), drafts (unpublished content), says (short statuses), recentlies (recent items), snippets (code), projects (portfolio); categories, topics (taxonomy); comments, links, subscribes (community); activities, analyzes, readers (analytics); options, owner_profiles, users, accounts (config/admin); webhooks, serverless_storages, serverless_logs (automation).',
    'Internal/system collections (migrations, migration_locks, checksum, sessions, slug_trackers, ai_agent_*) should only be queried, never written to, unless the user explicitly understands the risk.',
  ],
}
