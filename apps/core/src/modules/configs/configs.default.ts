import type { IConfig } from './configs.interface'

import { DEMO_MODE } from '~/app.config'

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
    options: {
      host: '',
      port: 465,
      secure: true,
    },
  },
  commentOptions: {
    antiSpam: false,
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
  friendLinkOptions: { allowApply: true, allowSubPath: false },
  backupOptions: {
    enable: DEMO_MODE ? false : true,
    endpoint: null!,
    region: null!,
    bucket: null!,
    secretId: null!,
    secretKey: null!,
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
    openAiPreferredModel: 'gpt-3.5-turbo',
    openAiKey: '',
    aiSummaryTargetLanguage: 'auto',
  },
  oauth: {
    providers: [],
    secrets: {},
    public: {},
  },
})
