import { Type } from 'class-transformer'
import { ValidateNested } from 'class-validator'
import { JSONSchema } from 'class-validator-jsonschema'
import type {
  ClassConstructor,
  TypeHelpOptions,
  TypeOptions,
} from 'class-transformer'

import {
  AdminExtraDto,
  AlgoliaSearchOptionsDto,
  BackupOptionsDto,
  BaiduSearchOptionsDto,
  BarkOptionsDto,
  ClerkOptionsDto,
  CommentOptionsDto,
  FeatureListDto,
  FriendLinkOptionsDto,
  MailOptionsDto,
  SeoDto,
  TextOptionsDto,
  ThirdPartyServiceIntegrationDto,
  UrlDto,
} from './configs.dto'

export const configDtoMapping = {} as Record<string, ClassConstructor<any>>
const ConfigField =
  (typeFunction: (type?: TypeHelpOptions) => Function, options?: TypeOptions) =>
  (target: any, propertyName: string): void => {
    configDtoMapping[propertyName] = typeFunction() as ClassConstructor<any>
    Type(typeFunction, options)(target, propertyName)
  }
@JSONSchema({
  title: '设置',
  ps: ['* 敏感字段不显示，后端默认不返回敏感字段，显示为空'],
})
export abstract class IConfig {
  @ConfigField(() => UrlDto)
  @ValidateNested()
  url: Required<UrlDto>

  @ConfigField(() => SeoDto)
  @ValidateNested()
  seo: Required<SeoDto>

  @ValidateNested()
  @ConfigField(() => AdminExtraDto)
  adminExtra: Required<AdminExtraDto>

  @ConfigField(() => TextOptionsDto)
  @ValidateNested()
  textOptions: Required<TextOptionsDto>

  @ConfigField(() => MailOptionsDto)
  @ValidateNested()
  mailOptions: Required<MailOptionsDto>

  @ConfigField(() => CommentOptionsDto)
  @ValidateNested()
  commentOptions: Required<CommentOptionsDto>

  @ConfigField(() => BarkOptionsDto)
  @ValidateNested()
  barkOptions: Required<BarkOptionsDto>

  @ConfigField(() => FriendLinkOptionsDto)
  @ValidateNested()
  friendLinkOptions: Required<FriendLinkOptionsDto>

  @ConfigField(() => BackupOptionsDto)
  @ValidateNested()
  backupOptions: Required<BackupOptionsDto>
  @ConfigField(() => BaiduSearchOptionsDto)
  @ValidateNested()
  baiduSearchOptions: Required<BaiduSearchOptionsDto>
  @ValidateNested()
  @ConfigField(() => AlgoliaSearchOptionsDto)
  algoliaSearchOptions: Required<AlgoliaSearchOptionsDto>

  @ValidateNested()
  @ConfigField(() => ClerkOptionsDto)
  clerkOptions: ClerkOptionsDto

  @ConfigField(() => FeatureListDto)
  @ValidateNested()
  featureList: Required<FeatureListDto>

  @ConfigField(() => ThirdPartyServiceIntegrationDto)
  @ValidateNested()
  thirdPartyServiceIntegration: Required<ThirdPartyServiceIntegrationDto>
}

export type IConfigKeys = keyof IConfig
