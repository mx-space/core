import { isInDemoMode } from '~/app.config'

import { IConfig } from './configs.interface'

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
    },
  },
  commentOptions: {
    antiSpam: false,
    blockIps: [],
    disableNoChinese: false,
    fetchLocationTimeout: 3000,
    recordIpLocation: true,
    spamKeywords: [],
    commentShouldAudit: false,
  },
  barkOptions: {
    enable: false,
    key: '',
    serverUrl: 'https://api.day.app',
    enableComment: true,
  },
  friendLinkOptions: { allowApply: true },
  backupOptions: {
    enable: isInDemoMode ? false : true,
    region: null!,
    bucket: null!,
    secretId: null!,
    secretKey: null!,
  },
  baiduSearchOptions: { enable: false, token: null! },
  algoliaSearchOptions: { enable: false, apiKey: '', appId: '', indexName: '' },
  adminExtra: {
    enableAdminProxy: true,
    title: 'おかえり~',
    background: '',
    gaodemapKey: null!,
  },
  terminalOptions: {
    enable: false,
    password: null!,
    script: null!,
  },
  textOptions: {
    macros: true,
  },
})
