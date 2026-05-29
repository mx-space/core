export namespace MxServerOptions {
  export interface SeoOption {
    title: string
    description: string
    keywords: string[]
  }

  export interface UrlOption {
    webUrl: string
    adminUrl: string
    serverUrl: string
    wsUrl: string
  }

  export interface MailOption {
    port: number
    host: string
    secure: boolean
  }

  export interface MailOptionsOption {
    enable: boolean
    user: string
    pass: string
    options: MailOption
  }

  export interface CommentOptionsOption {
    antiSpam: boolean
    disableComment: boolean
    spamKeywords: string[]
    blockIps: string[]
    disableNoChinese: boolean
    commentShouldAudit: boolean
    recordIpLocation: boolean
  }

  export interface BackupOptionsOption {
    enable: boolean
    endpoint: string
    secretId: string
    secretKey: string
    bucket: string
    region: string
  }

  export interface BaiduSearchOptionsOption {
    enable: boolean
    token: string
  }

  export interface AlgoliaSearchOptionsOption {
    enable: boolean
    apiKey: string
    appId: string
    indexName: string
  }

  export interface AdminExtraOption {
    enableAdminProxy: boolean
    background: string
    gaodemapKey: string
  }

  export interface FriendLinkOptionsOption {
    allowApply: boolean
  }

  export interface TextOptionsOption {
    macros: boolean
  }

  export interface BarkOptionsOption {
    enable: boolean
    key: string
    serverUrl: string
    enableComment: boolean
  }

  export interface FeatureListOption {
    emailSubscribe: boolean
  }

  export interface GitHubIntegrationOption {
    enabled?: boolean
    token?: string
  }

  export interface TmdbIntegrationOption {
    enabled?: boolean
    apiKey?: string
  }

  export interface BangumiIntegrationOption {
    enabled?: boolean
    accessToken?: string
  }

  export interface NeoDBIntegrationOption {
    enabled?: boolean
  }

  export interface ArxivIntegrationOption {
    enabled?: boolean
  }

  export interface LeetcodeIntegrationOption {
    enabled?: boolean
  }

  export interface NeteaseMusicIntegrationOption {
    enabled?: boolean
  }

  export interface QQMusicIntegrationOption {
    enabled?: boolean
  }

  export interface ThirdPartyServiceIntegrationOption {
    github?: GitHubIntegrationOption
    tmdb?: TmdbIntegrationOption
    bangumi?: BangumiIntegrationOption
    neodb?: NeoDBIntegrationOption
    arxiv?: ArxivIntegrationOption
    leetcode?: LeetcodeIntegrationOption
    neteaseMusic?: NeteaseMusicIntegrationOption
    qqMusic?: QQMusicIntegrationOption
  }

  export interface AuthSecurityOption {
    disablePasswordLogin: boolean
  }

  export enum AIProviderType {
    OpenAI = 'openai',
    OpenAICompatible = 'openai-compatible',
    Anthropic = 'anthropic',
  }

  export interface AIProviderConfig {
    id: string
    name: string
    type: AIProviderType
    apiKey: string
    endpoint?: string
    defaultModel: string
    enabled: boolean
  }

  export interface AIModelAssignment {
    providerId?: string
    model?: string
  }

  export interface AIOption {
    providers: AIProviderConfig[]
    summaryModel?: AIModelAssignment
    writerModel?: AIModelAssignment
    commentReviewModel?: AIModelAssignment
    enableSummary: boolean
    enableAutoGenerateSummaryOnCreate: boolean
    enableAutoGenerateSummaryOnUpdate: boolean
    summaryTargetLanguages: string[]
    summaryMinTextLength?: number
    insightsModel?: AIModelAssignment
    insightsTranslationModel?: AIModelAssignment
    enableInsights?: boolean
    enableAutoGenerateInsightsOnCreate?: boolean
    enableAutoGenerateInsightsOnUpdate?: boolean
    enableAutoTranslateInsights?: boolean
    insightsTargetLanguages?: string[]
    insightsMinTextLength?: number
  }

  export interface ModelInfo {
    id: string
    name: string
    created?: number
  }

  export interface ProviderModelsResponse {
    providerId: string
    providerName: string
    providerType: AIProviderType
    models: ModelInfo[]
    error?: string
  }
}
