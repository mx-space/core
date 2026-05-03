/**
 * Injection tokens used by repository providers. Each repository receives the
 * shared {@link AppDatabase} via {@link PG_DB_TOKEN}; these tokens identify
 * the repositories themselves so services can request them by symbol.
 */
export const POSTGRES_REPOSITORY_TOKENS = {
  category: Symbol('CategoryRepository'),
  topic: Symbol('TopicRepository'),
  post: Symbol('PostRepository'),
  note: Symbol('NoteRepository'),
  page: Symbol('PageRepository'),
  comment: Symbol('CommentRepository'),
  recently: Symbol('RecentlyRepository'),
  draft: Symbol('DraftRepository'),
  reader: Symbol('ReaderRepository'),
  ownerProfile: Symbol('OwnerProfileRepository'),
  apiKey: Symbol('ApiKeyRepository'),
  account: Symbol('AccountRepository'),
  session: Symbol('SessionRepository'),
  search: Symbol('SearchRepository'),
  aiSummary: Symbol('AiSummaryRepository'),
  aiInsights: Symbol('AiInsightsRepository'),
  aiTranslation: Symbol('AiTranslationRepository'),
  translationEntry: Symbol('TranslationEntryRepository'),
  aiAgentConversation: Symbol('AiAgentConversationRepository'),
  activity: Symbol('ActivityRepository'),
  analyze: Symbol('AnalyzeRepository'),
  fileReference: Symbol('FileReferenceRepository'),
  link: Symbol('LinkRepository'),
  project: Symbol('ProjectRepository'),
  say: Symbol('SayRepository'),
  snippet: Symbol('SnippetRepository'),
  subscribe: Symbol('SubscribeRepository'),
  pollVote: Symbol('PollVoteRepository'),
  slugTracker: Symbol('SlugTrackerRepository'),
  serverlessStorage: Symbol('ServerlessStorageRepository'),
  serverlessLog: Symbol('ServerlessLogRepository'),
  webhook: Symbol('WebhookRepository'),
  webhookEvent: Symbol('WebhookEventRepository'),
  options: Symbol('OptionsRepository'),
  metaPreset: Symbol('MetaPresetRepository'),
} as const

export type PostgresRepositoryToken =
  (typeof POSTGRES_REPOSITORY_TOKENS)[keyof typeof POSTGRES_REPOSITORY_TOKENS]
