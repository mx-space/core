import { Type } from 'class-transformer'
import { ValidateNested } from 'class-validator'
import { JSONSchema } from 'class-validator-jsonschema'
import {
  AIDto,
  AdminExtraDto,
  AlgoliaSearchOptionsDto,
  AuthSecurityDto,
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
import type {
  ClassConstructor,
  TypeHelpOptions,
  TypeOptions,
} from 'class-transformer'

export const configDtoMapping = {} as Record<string, ClassConstructor<any>>
const ConfigField =
  (typeFunction: (type?: TypeHelpOptions) => Function, options?: TypeOptions) =>
  (target: any, propertyName: string): void => {
    configDtoMapping[propertyName] = typeFunction() as ClassConstructor<any>
    Type(typeFunction, options)(target, propertyName)
    ValidateNested()(target, propertyName)
  }
@JSONSchema({
  title: '设置',
  ps: ['* 敏感字段不显示，后端默认不返回敏感字段，显示为空'],
})
export abstract class IConfig {
  @ConfigField(() => UrlDto)
  url: Required<UrlDto>

  @ConfigField(() => SeoDto)
  seo: Required<SeoDto>

  @ConfigField(() => AdminExtraDto)
  adminExtra: Required<AdminExtraDto>

  @ConfigField(() => TextOptionsDto)
  textOptions: Required<TextOptionsDto>

  @ConfigField(() => MailOptionsDto)
  mailOptions: Required<MailOptionsDto>

  @ConfigField(() => CommentOptionsDto)
  commentOptions: Required<CommentOptionsDto>

  @ConfigField(() => BarkOptionsDto)
  barkOptions: Required<BarkOptionsDto>

  @ConfigField(() => FriendLinkOptionsDto)
  friendLinkOptions: Required<FriendLinkOptionsDto>

  @ConfigField(() => BackupOptionsDto)
  backupOptions: Required<BackupOptionsDto>
  @ConfigField(() => BaiduSearchOptionsDto)
  baiduSearchOptions: Required<BaiduSearchOptionsDto>
  @ConfigField(() => AlgoliaSearchOptionsDto)
  algoliaSearchOptions: Required<AlgoliaSearchOptionsDto>

  @ConfigField(() => ClerkOptionsDto)
  clerkOptions: ClerkOptionsDto

  @ConfigField(() => FeatureListDto)
  featureList: Required<FeatureListDto>

  @ConfigField(() => ThirdPartyServiceIntegrationDto)
  thirdPartyServiceIntegration: Required<ThirdPartyServiceIntegrationDto>

  @ConfigField(() => AuthSecurityDto)
  authSecurity: AuthSecurityDto

  @ConfigField(() => AIDto)
  ai: AIDto
}

export type IConfigKeys = keyof IConfig
