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
declare class MailOptionModel {
  port: number
  host: string
}
export declare class MailOptionsModel {
  enable: boolean
  user: string
  pass: string
  options?: MailOptionModel
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

export interface IConfig {
  seo: SeoOptionModel
  url: UrlOptionModel
  mailOptions: MailOptionsModel
  commentOptions: CommentOptionsModel
  backupOptions: BackupOptionsModel
  baiduSearchOptions: BaiduSearchOptionsModel
  algoliaSearchOptions: AlgoliaSearchOptionsModel
  adminExtra: AdminExtraModel
}
export declare type IConfigKeys = keyof IConfig
