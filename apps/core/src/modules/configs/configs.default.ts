import { DEMO_MODE } from '~/app.config'
import type { IConfig } from './configs.interface'

export const generateDefaultConfig: () => IConfig = () => ({
  seo: {
    title: '我的小世界呀',
    description: '哈喽~欢迎光临',
    keywords: [],
  },
  url: {
    wsUrl: 'http://127.0.0.1:2333', // todo
    adminUrl: 'http://127.0.0.1:2333/proxy/qaqdmin',
    serverUrl: 'http://127.0.0.1:2333',
    webUrl: 'http://127.0.0.1:2323',
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
  friendLinkOptions: { allowApply: true },
  backupOptions: {
    enable: DEMO_MODE ? false : true,
    endpoint: null!,
    region: null!,
    bucket: null!,
    secretId: null!,
    secretKey: null!,
  },
  baiduSearchOptions: { enable: false, token: null! },
  algoliaSearchOptions: { enable: false, apiKey: '', appId: '', indexName: '' },
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
  clerkOptions: {
    enable: false,
    adminUserId: '',
    pemKey: '',
    secretKey: '',
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
  },
})
