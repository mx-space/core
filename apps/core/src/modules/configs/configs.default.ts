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
  backupOptions: {
    enable: true,
    endpoint: null!,
    region: null!,
    bucket: null!,
    secretId: null!,
    secretKey: null!,
  },
  imageStorageOptions: {
    enable: false,
    syncOnPublish: false,
    deleteLocalAfterSync: false,
    endpoint: null!,
    secretId: null!,
    secretKey: null!,
    bucket: null!,
    region: null!,
    customDomain: '',
    prefix: '',
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
    providers: [],
    summaryModel: undefined,
    writerModel: undefined,
    commentReviewModel: undefined,
    enableSummary: false,
    enableAutoGenerateSummary: false,
    aiSummaryTargetLanguage: 'auto',
  },
  oauth: {
    providers: [],
    secrets: {},
    public: {},
  },
})
