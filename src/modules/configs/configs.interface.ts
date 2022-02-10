import { Type } from 'class-transformer'
import {
  AdminExtraDto,
  AlgoliaSearchOptionsDto,
  BackupOptionsDto,
  BaiduSearchOptionsDto,
  CommentOptionsDto,
  MailOptionsDto,
  SeoDto,
  TerminalOptionsDto,
  UrlDto,
} from './configs.dto'

export abstract class IConfig {
  @Type(() => SeoDto)
  seo: SeoDto
  @Type(() => UrlDto)
  url: UrlDto
  @Type(() => MailOptionsDto)
  mailOptions: MailOptionsDto
  @Type(() => CommentOptionsDto)
  commentOptions: CommentOptionsDto
  @Type(() => BackupOptionsDto)
  backupOptions: BackupOptionsDto
  @Type(() => BaiduSearchOptionsDto)
  baiduSearchOptions: BaiduSearchOptionsDto
  @Type(() => AlgoliaSearchOptionsDto)
  algoliaSearchOptions: AlgoliaSearchOptionsDto
  @Type(() => AdminExtraDto)
  adminExtra: AdminExtraDto
  @Type(() => TerminalOptionsDto)
  terminalOptions: TerminalOptionsDto
}

export type IConfigKeys = keyof IConfig
