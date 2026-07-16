const adminTaskKeys = {
  taskDetail: (id: string) => ['tasks', 'detail', id] as const,
  tasks: (params: {
    page: number
    scope?: string
    size: number
    status?: string | string[]
    type?: string
  }) => ['tasks', params] as const,
  tasksByGroup: (groupId: string) => ['tasks', 'byGroup', groupId] as const,
  tasksRoot: ['tasks'] as const,
}

export const adminQueryKeys = {
  aggregate: {
    root: ['aggregate'] as const,
  },
  auth: {
    loggedStatus: () => ['auth', 'check-logged'] as const,
  },
  ai: {
    grouped: (params: { group: string; search: string }) =>
      ['ai', params.group, 'grouped', params.search] as const,
    groupedByRef: (params: { group: string; id: string }) =>
      ['ai', params.group, 'by-ref', params.id] as const,
    groupedRoot: (group: string) => ['ai', group] as const,
    groupedListRoot: (group: string) => ['ai', group, 'grouped'] as const,
    models: (context: string) => ['ai', 'models', context] as const,
    root: ['ai'] as const,
    translationEntriesRoot: ['ai', 'translation-entries'] as const,
    translationEntries: (params: {
      keyPath?: string
      lang?: string
      page: number
      size: number
    }) => ['ai', 'translation-entries', params] as const,
  },
  analyze: {
    activity: (params: { page: number; size: number; type: number }) =>
      ['analyze', 'activity', params] as const,
    aggregate: () => ['analyze', 'aggregate'] as const,
    deviceDistribution: (params: { end: number; start: number }) =>
      ['analyze', 'device-distribution', params] as const,
    readingRank: (params: { end: number; limit: number; start: number }) =>
      ['analyze', 'reading-rank', params] as const,
    records: (params: { page: number; size: number }) =>
      ['analyze', 'records', params] as const,
    root: ['analyze'] as const,
    trafficSource: (params: { end: number; start: number }) =>
      ['analyze', 'traffic-source', params] as const,
  },
  backups: {
    list: () => ['backups', 'list'] as const,
    root: ['backups'] as const,
  },
  categories: {
    detail: (id: string) => ['categories', 'detail', id] as const,
    list: () => ['categories', 'list'] as const,
    postFilter: () => ['categories', 'post-filter'] as const,
    root: ['categories'] as const,
    tags: () => ['categories', 'tags'] as const,
  },
  comments: {
    authorActivity: (params: { mail?: string; ip?: string }) =>
      ['comments', 'author-activity', params] as const,
    listRoot: ['comments', 'list'] as const,
    list: (params: {
      author?: string
      page: number
      refId?: string
      refType?: string
      search?: string
      size: number
      state: number | 'all'
      tab?: string
    }) => ['comments', 'list', params] as const,
    owner: () => ['comments', 'owner'] as const,
    root: ['comments'] as const,
    sourceCandidates: (params: { refType?: string; search?: string }) =>
      ['comments', 'source-candidates', params] as const,
    tabCountsRoot: ['comments', 'tab-counts'] as const,
    tabCounts: (filter: { refType?: string; refId?: string } = {}) =>
      ['comments', 'tab-counts', filter] as const,
    thread: (id: string) => ['comments', 'thread', id] as const,
  },
  companion: {
    capabilities: () => ['companion', 'capabilities'] as const,
    devices: () => ['companion', 'devices'] as const,
    publicPresence: () => ['companion', 'public-presence'] as const,
    root: ['companion'] as const,
  },
  cron: {
    definitionRoot: ['cron-task-definitions'] as const,
    definitions: () => ['cron-task-definitions'] as const,
    history: (params: { status?: string; type?: string }) =>
      ['cron-tasks', 'history', params] as const,
    recentRuns: (params: { limit: number; type: string }) =>
      ['cron-tasks', 'recent-runs', params] as const,
    taskRoot: ['cron-tasks'] as const,
  },
  dashboard: {
    aggregateStat: () => ['dashboard', 'aggregate-stat'] as const,
    appInfo: () => ['dashboard', 'app-info'] as const,
    categoryDistribution: () => ['dashboard', 'category-distribution'] as const,
    commentActivity: () => ['dashboard', 'comment-activity'] as const,
    githubUpdate: () => ['dashboard', 'github-update'] as const,
    owner: () => ['dashboard', 'owner'] as const,
    publicationTrend: () => ['dashboard', 'publication-trend'] as const,
    readLike: () => ['dashboard', 'read-like'] as const,
    releaseDetailRoot: ['dashboard', 'release-detail'] as const,
    releaseDetail: (params: { repo: string; version: string }) =>
      ['dashboard', 'release-detail', params.repo, params.version] as const,
    siteLike: () => ['dashboard', 'site-like'] as const,
    tagCloud: () => ['dashboard', 'tag-cloud'] as const,
    topArticles: () => ['dashboard', 'top-articles'] as const,
    trafficSource: () => ['dashboard', 'traffic-source'] as const,
    wordCount: () => ['dashboard', 'word-count'] as const,
  },
  dependencies: {
    graph: () => ['dependencies', 'graph'] as const,
    npmLatest: (name: string) => ['npm-latest', name] as const,
    root: ['dependencies'] as const,
  },
  enrichment: {
    cacheDetail: (id: string) => ['enrichment', 'cache', 'detail', id] as const,
    cacheList: (params: { filterMode: string; page: number; size: number }) =>
      ['enrichment', 'cache', params] as const,
    captureList: (params: {
      order: string
      page: number
      size: number
      sort: string
    }) => ['enrichment', 'captures', params] as const,
    captureQuota: () => ['enrichment', 'captures', 'quota'] as const,
    providers: () => ['enrichment', 'providers'] as const,
    root: ['enrichment'] as const,
  },
  files: {
    byType: (type: string) => ['files', 'by-type', type] as const,
    commentUploads: (params: { page: number; size: number; status: string }) =>
      ['files', 'comment-uploads', params] as const,
    orphans: (params: { page: number; size: number }) =>
      ['files', 'orphans', params] as const,
    root: ['files'] as const,
  },
  login: {
    allowLogin: () => ['login', 'allow-login'] as const,
    init: () => ['login', 'init'] as const,
    owner: () => ['login', 'owner'] as const,
  },
  links: {
    list: (params: { page: number; size: number; state: number }) =>
      ['links', 'list', params] as const,
    stateCount: () => ['links', 'state-count'] as const,
    root: ['links'] as const,
  },
  notes: {
    list: (params: {
      filter: string
      keyword: string
      page: number
      size: number
      sortKey: string
      sortOrder: string
    }) => ['notes', 'list', params] as const,
    topicPicker: (topicId: string) =>
      ['notes', 'topic-picker', topicId] as const,
    root: ['notes'] as const,
  },
  posts: {
    categoryDetail: (id: string) => ['posts', 'category-detail', id] as const,
    list: (params: {
      categoryId: string
      keyword: string
      page: number
      size: number
      sortKey: string
      sortOrder: string
    }) => ['posts', 'list', params] as const,
    relatedOptions: (context: string) =>
      ['posts', 'related-options', context] as const,
    tagDetail: (name: string) => ['posts', 'tag-detail', name] as const,
    root: ['posts'] as const,
  },
  projects: {
    detail: (id: string) => ['projects', 'detail', id] as const,
    list: (params: { page: number; size: number }) =>
      ['projects', 'list', params] as const,
    root: ['projects'] as const,
  },
  recently: {
    list: (params: { size: number }) => ['recently', 'list', params] as const,
    root: ['recently'] as const,
  },
  readers: {
    detail: (id: string) => ['readers', 'detail', id] as const,
    listRoot: ['readers', 'list'] as const,
    list: (params: {
      page: number
      role: string
      search: string
      size: number
    }) => ['readers', 'list', params] as const,
    root: ['readers'] as const,
    stats: () => ['readers', 'stats'] as const,
  },
  pages: {
    list: (params: { page: number; size: number }) =>
      ['pages', 'list', params] as const,
    root: ['pages'] as const,
  },
  drafts: {
    byRef: (params: { id: string; refType: string }) =>
      ['drafts', 'by-ref', params.refType, params.id] as const,
    detail: (id: string) => ['drafts', 'detail', id] as const,
    history: (id: string) => ['drafts', 'history', id] as const,
    historyVersion: (params: { id: string; version: number | null }) =>
      ['drafts', 'history-version', params.id, params.version] as const,
    listRoot: ['drafts', 'list'] as const,
    list: (filterType: string) => ['drafts', 'list', filterType] as const,
    newDraft: (refType: string) => ['drafts', 'new', refType] as const,
    recoveryHistory: (id: string) =>
      ['drafts', 'recovery-history', id] as const,
    recoveryVersion: (params: { id: string; version: number | null }) =>
      ['drafts', 'recovery-version', params.id, params.version] as const,
    root: ['drafts'] as const,
  },
  says: {
    list: (params: { page: number; size: number }) =>
      ['says', 'list', params] as const,
    root: ['says'] as const,
  },
  searchIndex: {
    documents: (params: {
      keyword?: string
      lang?: string
      page: number
      refType?: string
      size: number
    }) => ['search-index', 'documents', params] as const,
    root: ['search-index'] as const,
  },
  serverless: {
    compiled: (snippetId: string) =>
      ['serverless', 'compiled', snippetId] as const,
    logDetail: (id: string) => ['serverless', 'log-detail', id] as const,
    logs: (params: {
      page: number
      size: number
      snippetId: string
      status: string
    }) => ['serverless', 'logs', params] as const,
  },
  settings: {
    accountRoot: ['settings', 'account'] as const,
    aiModels: () => ['settings', 'ai-models'] as const,
    authSecurity: () => ['settings', 'account', 'auth-security'] as const,
    oauth: () => ['settings', 'account', 'oauth'] as const,
    options: () => ['settings', 'options'] as const,
    owner: () => ['settings', 'owner'] as const,
    passkeys: () => ['settings', 'account', 'passkeys'] as const,
    root: ['settings'] as const,
    schema: () => ['settings', 'schema'] as const,
    sessions: () => ['settings', 'account', 'sessions'] as const,
    tokens: () => ['settings', 'account', 'tokens'] as const,
  },
  metaPresets: {
    detail: (id: string) => ['meta-presets', id] as const,
    root: ['meta-presets'] as const,
  },
  subscribe: {
    list: (params: { page: number; size: number }) =>
      ['subscribe', 'list', params] as const,
    root: ['subscribe'] as const,
    status: () => ['subscribe', 'status'] as const,
  },
  shell: {
    owner: () => ['shell', 'owner'] as const,
  },
  snippets: {
    detail: (id: string) => ['snippets', 'detail', id] as const,
    githubPackage: (name: string) => ['github-snippet-package', name] as const,
    githubPackages: () => ['github-snippet-packages'] as const,
    groupRoot: ['snippets', 'group'] as const,
    group: (reference: string) => ['snippets', 'group', reference] as const,
    groups: () => ['snippets', 'groups'] as const,
    root: ['snippets'] as const,
    vfs: (prefix: string, recursive: boolean) =>
      ['snippets', 'vfs', prefix, recursive] as const,
  },
  tasks: {
    taskDetail: adminTaskKeys.taskDetail,
    tasks: adminTaskKeys.tasks,
    tasksByGroup: adminTaskKeys.tasksByGroup,
    tasksRoot: adminTaskKeys.tasksRoot,
  },
  templates: {
    email: (type: string) => ['templates', 'email', type] as const,
    root: ['templates', 'email'] as const,
  },
  topics: {
    detail: (id: string) => ['topics', 'detail', id] as const,
    listRoot: ['topics', 'list'] as const,
    list: (params: { page: number; size: number }) =>
      ['topics', 'list', params] as const,
    notesRoot: (topicId: string) => ['topics', 'notes', topicId] as const,
    notes: (params: { page: number; size: number; topicId: string }) =>
      [
        'topics',
        'notes',
        params.topicId,
        { page: params.page, size: params.size },
      ] as const,
    root: ['topics'] as const,
  },
  webhooks: {
    dispatchesRoot: (webhookId: string) =>
      ['webhooks', 'dispatches', webhookId] as const,
    dispatches: (params: { page: number; size: number; webhookId: string }) =>
      [
        'webhooks',
        'dispatches',
        params.webhookId,
        { page: params.page, size: params.size },
      ] as const,
    events: () => ['webhooks', 'events'] as const,
    list: () => ['webhooks', 'list'] as const,
    root: ['webhooks'] as const,
  },
  write: {
    contentRoot: (kind: 'note' | 'page' | 'post') =>
      [
        kind === 'note' ? 'notes' : kind === 'page' ? 'pages' : 'posts',
      ] as const,
    detail: (params: { id: string; kind: 'note' | 'page' | 'post' }) =>
      [
        params.kind === 'note'
          ? 'notes'
          : params.kind === 'page'
            ? 'pages'
            : 'posts',
        'write-detail',
        params.id,
      ] as const,
  },
} as const
