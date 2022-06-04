import { Type } from 'class-transformer'
import { ValidateNested } from 'class-validator'
import { JSONSchema } from 'class-validator-jsonschema'

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
  TextOptionsDto,
  UrlDto,
} from './configs.dto'

@JSONSchema({
  title: '设置',
  ps: ['* 敏感字段不显示，后端默认不返回敏感字段，显示为空'],
})
export abstract class IConfig {
  @Type(() => UrlDto)
  @ValidateNested()
  url: Required<UrlDto>

  @Type(() => SeoDto)
  @ValidateNested()
  seo: Required<SeoDto>

  @ValidateNested()
  @Type(() => AdminExtraDto)
  adminExtra: Required<AdminExtraDto>

  @Type(() => TextOptionsDto)
  @ValidateNested()
  textOptions: Required<TextOptionsDto>

  @Type(() => MailOptionsDto)
  @ValidateNested()
  mailOptions: Required<MailOptionsDto>

  @Type(() => CommentOptionsDto)
  @ValidateNested()
  commentOptions: Required<CommentOptionsDto>

  @Type(() => FriendLinkOptionsDto)
  @ValidateNested()
  friendLinkOptions: Required<FriendLinkOptionsDto>

  @Type(() => BackupOptionsDto)
  @ValidateNested()
  backupOptions: Required<BackupOptionsDto>
  @Type(() => BaiduSearchOptionsDto)
  @ValidateNested()
  baiduSearchOptions: Required<BaiduSearchOptionsDto>
  @ValidateNested()
  @Type(() => AlgoliaSearchOptionsDto)
  algoliaSearchOptions: Required<AlgoliaSearchOptionsDto>

  @Type(() => TerminalOptionsDto)
  @ValidateNested()
  terminalOptions: Required<TerminalOptionsDto>
}

export type IConfigKeys = keyof IConfig
