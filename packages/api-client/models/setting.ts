export declare class SeoOptionModel {
  title: string
  description: string
  icon?: string
  keywords?: string[]
}
export declare class UrlOptionModel {
  webUrl: string
  adminUrl: string
  serverUrl: string
  wsUrl: string
}
declare class SmtpOptionsModel {
  port?: number
  host?: string
  secure?: boolean
}
declare class SmtpConfigModel {
  user?: string
  pass?: string
  options?: SmtpOptionsModel
}
declare class ResendConfigModel {
  apiKey?: string
}
export declare class MailOptionsModel {
  enable: boolean
  provider?: 'smtp' | 'resend'
  from?: string
  smtp?: SmtpConfigModel
  resend?: ResendConfigModel
}
export declare class CommentOptionsModel {
  antiSpam: boolean
  spamKeywords?: string[]
  blockIps?: string[]
  disableNoChinese?: boolean
}
export declare class BackupOptionsModel {
  enable: boolean
  secretId?: string
  secretKey?: string
  bucket?: string
  region: string
}
export declare class BaiduSearchOptionsModel {
  enable: boolean
  token?: string
}
export declare class BingSearchOptionsModel {
  enable: boolean
  token?: string
}

export declare class AlgoliaSearchOptionsModel {
  enable: boolean
  apiKey?: string
  appId?: string
  indexName?: string
}

export declare class AdminExtraModel {
  background?: string

  gaodemapKey?: string
  title?: string
  /**
   * 是否开启后台反代访问
   */
  enableAdminProxy?: boolean
}

export declare class ThirdPartyServiceIntegrationModel {
  githubToken?: string
}

export interface IConfig {
  seo: SeoOptionModel
  url: UrlOptionModel
  mailOptions: MailOptionsModel
  commentOptions: CommentOptionsModel
  backupOptions: BackupOptionsModel
  baiduSearchOptions: BaiduSearchOptionsModel
  algoliaSearchOptions: AlgoliaSearchOptionsModel
  adminExtra: AdminExtraModel
  thirdPartyServiceIntegration: ThirdPartyServiceIntegrationModel
}
export declare type IConfigKeys = keyof IConfig
