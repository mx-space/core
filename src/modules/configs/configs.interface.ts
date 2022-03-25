import { JSONSchema } from 'class-validator-jsonschema'
import { Type } from 'class-transformer'
import { ValidateNested } from 'class-validator'
import {
  AdminExtraDto,
  AlgoliaSearchOptionsDto,
  BackupOptionsDto,
  BaiduSearchOptionsDto,
  CommentOptionsDto,
  FriendLinkOptionsDto,
  MailOptionsDto,
  SeoDto,
  TerminalOptionsDto,
  UrlDto,
} from './configs.dto'
@JSONSchema({
  title: '设置',
})
export abstract class IConfig {
  @Type(() => SeoDto)
  @ValidateNested()
  seo: SeoDto
  @Type(() => UrlDto)
  @ValidateNested()
  url: UrlDto
  @Type(() => MailOptionsDto)
  @ValidateNested()
  mailOptions: MailOptionsDto
  @Type(() => CommentOptionsDto)
  @ValidateNested()
  commentOptions: CommentOptionsDto
  @Type(() => FriendLinkOptionsDto)
  @ValidateNested()
  friendLinkOptions: FriendLinkOptionsDto
  @Type(() => BackupOptionsDto)
  @ValidateNested()
  backupOptions: BackupOptionsDto
  @Type(() => BaiduSearchOptionsDto)
  @ValidateNested()
  baiduSearchOptions: BaiduSearchOptionsDto
  @ValidateNested()
  @Type(() => AlgoliaSearchOptionsDto)
  algoliaSearchOptions: AlgoliaSearchOptionsDto
  @ValidateNested()
  @Type(() => AdminExtraDto)
  adminExtra: AdminExtraDto
  @Type(() => TerminalOptionsDto)
  @ValidateNested()
  terminalOptions: TerminalOptionsDto
}

export type IConfigKeys = keyof IConfig
