export declare class SeoOptionModel {
  title: string
  description: string
  icon?: string
  iconDark?: string
  keywords?: string[]
}
export declare class UrlOptionModel {
  webUrl: string
  adminUrl: string
  serverUrl: string
  wsUrl: string
}
declare class SmtpConfigModel {
  user?: string
  pass?: string
  host?: string
  port?: number
  secure?: boolean
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
  disableComment: boolean
  allowGuestComment: boolean
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
  github?: { enabled?: boolean; token?: string }
  tmdb?: { enabled?: boolean; apiKey?: string }
  bangumi?: { enabled?: boolean; accessToken?: string }
  neodb?: { enabled?: boolean }
  arxiv?: { enabled?: boolean }
  leetcode?: { enabled?: boolean }
  neteaseMusic?: { enabled?: boolean }
  qqMusic?: { enabled?: boolean }
  openGraph?: {
    enabled?: boolean
    fetchMode?: 'fetch' | 'browser'
    timeoutMs?: number
    maxBodyBytes?: number
    screenshot?: {
      enabled?: boolean
      maxItems?: number
      maxTotalBytes?: number
      maxBytesPerImage?: number
      webpQuality?: number
    }
  }
  twelveData?: { enabled?: boolean; apiKey?: string }
  polygon?: { enabled?: boolean; apiKey?: string }
}

export interface IConfig {
  seo: SeoOptionModel
  url: UrlOptionModel
  mailOptions: MailOptionsModel
  commentOptions: CommentOptionsModel
  backupOptions: BackupOptionsModel
  baiduSearchOptions: BaiduSearchOptionsModel
  adminExtra: AdminExtraModel
  thirdPartyServiceIntegration: ThirdPartyServiceIntegrationModel
}
export declare type IConfigKeys = keyof IConfig
