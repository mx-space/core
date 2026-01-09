import type { IConfig } from './configs.interface'

export const generateDefaultConfig: () => IConfig = () => ({
  seo: {
    title: '我的小世界呀',
    description: '哈喽~欢迎光临',
    keywords: [],
  },
  url: {
    wsUrl: 'http://localhost:2333', // todo
    adminUrl: 'http://localhost:2333/proxy/qaqdmin',
    serverUrl: 'http://localhost:2333',
    webUrl: 'http://localhost:2323',
  },
  mailOptions: {
    enable: false,

    user: '',
    pass: '',
    from: '',
    options: {
      host: '',
      port: 465,
      secure: true,
    },
  },
  commentOptions: {
    antiSpam: false,
    aiReview: false,
    aiReviewType: 'binary',
    aiReviewThreshold: 5,
    disableComment: false,
    blockIps: [],
    disableNoChinese: false,
    recordIpLocation: true,
    spamKeywords: [],
    commentShouldAudit: false,
  },
  barkOptions: {
    enable: false,
    key: '',
    serverUrl: 'https://api.day.app',
    enableComment: true,
    enableThrottleGuard: false,
  },
  friendLinkOptions: {
    allowApply: true,
    allowSubPath: false,
    enableAvatarInternalization: true,
  },
  s3Options: {
    endpoint: '',
    accessKeyId: '',
    secretAccessKey: '',
    bucket: '',
    region: '',
    customDomain: '',
    pathStyleAccess: false,
  },
  backupOptions: {
    enable: false,
    path: 'backups/{Y}/{m}/backup-{Y}{m}{d}-{h}{i}{s}.zip',
  },
  imageBedOptions: {
    enable: false,
    path: 'images/{Y}/{m}/{uuid}.{ext}',
    allowedFormats: 'jpg,jpeg,png,gif,webp',
    maxSizeMB: 10,
  },
  baiduSearchOptions: { enable: false, token: null! },
  bingSearchOptions: { enable: false, token: null! },
  algoliaSearchOptions: {
    enable: false,
    apiKey: '',
    appId: '',
    indexName: '',
    maxTruncateSize: 10000,
  },
  adminExtra: {
    enableAdminProxy: true,

    background: '',
    gaodemapKey: null!,
  },
  textOptions: {
    macros: true,
  },
  featureList: {
    emailSubscribe: false,
  },
  thirdPartyServiceIntegration: {
    xLogSiteId: '',
    githubToken: '',
  },

  authSecurity: {
    disablePasswordLogin: false,
  },
  ai: {
    enableAutoGenerateSummary: false,
    enableSummary: false,
    openAiEndpoint: '',
    openAiPreferredModel: 'gpt-5o-mini',
    openAiKey: '',
    aiSummaryTargetLanguage: 'auto',
    enableDeepReading: false,
  },
  oauth: {
    providers: [],
    secrets: {},
    public: {},
  },
})
