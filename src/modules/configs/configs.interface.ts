import {
  AlgoliaSearchOptions,
  BackupOptions,
  BaiduSearchOptions,
  CommentOptions,
  MailOptionsDto,
  SEODto,
  UrlDto,
} from './configs.dto'

export interface IConfig {
  seo: SEODto
  url: UrlDto
  mailOptions: MailOptionsDto
  commentOptions: CommentOptions
  backupOptions: BackupOptions
  baiduSearchOptions: BaiduSearchOptions
  algoliaSearchOptions: AlgoliaSearchOptions
}

export type IConfigKeys = keyof IConfig
