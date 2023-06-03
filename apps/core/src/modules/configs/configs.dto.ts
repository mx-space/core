import { Exclude, Transform, Type } from 'class-transformer'
import {
  ArrayUnique,
  IsBoolean,
  IsEmail,
  IsInt,
  IsIP,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator'
import { JSONSchema } from 'class-validator-jsonschema'

import { IsAllowedUrl } from '~/utils/validator/isAllowedUrl'

import { Encrypt } from './configs.encrypt.util'
import {
  halfFieldOption,
  JSONSchemaArrayField,
  JSONSchemaHalfGirdPlainField,
  JSONSchemaNumberField,
  JSONSchemaPasswordField,
  JSONSchemaPlainField,
  JSONSchemaToggleField,
} from './configs.jsonschema.decorator'

@JSONSchema({ title: 'SEO 优化' })
export class SeoDto {
  @IsString({ message: '标题必须是字符串' })
  @IsNotEmpty({ message: '不能为空!!' })
  @IsOptional()
  @JSONSchemaPlainField('网站标题')
  title: string

  @IsString({ message: '描述信息必须是字符串' })
  @IsNotEmpty({ message: '不能为空!!' })
  @IsOptional()
  @JSONSchemaPlainField('网站描述')
  description: string

  @IsString({ message: '关键字必须为一个数组', each: true })
  @IsOptional()
  @JSONSchemaArrayField('关键字')
  keywords?: string[]
}

@JSONSchema({ title: '网站设置' })
export class UrlDto {
  @IsAllowedUrl()
  @IsOptional()
  @JSONSchemaHalfGirdPlainField('前端地址')
  webUrl: string

  @IsAllowedUrl()
  @IsOptional()
  @JSONSchemaHalfGirdPlainField('管理后台地址')
  adminUrl: string

  @IsAllowedUrl()
  @IsOptional()
  @JSONSchemaHalfGirdPlainField('API 地址')
  serverUrl: string

  @IsAllowedUrl()
  @IsOptional()
  @JSONSchemaHalfGirdPlainField('Gateway 地址')
  wsUrl: string
}

class MailOption {
  @IsInt()
  @Transform(({ value: val }) => parseInt(val))
  @IsOptional()
  @JSONSchemaNumberField('发件邮箱端口', halfFieldOption)
  port: number
  @IsUrl({ require_protocol: false })
  @IsOptional()
  @JSONSchemaHalfGirdPlainField('发件邮箱 host')
  host: string
}
@JSONSchema({ title: '邮件通知设置' })
export class MailOptionsDto {
  @IsBoolean()
  @IsOptional()
  @JSONSchemaToggleField('开启邮箱提醒')
  enable: boolean
  @IsEmail()
  @IsOptional()
  @JSONSchemaHalfGirdPlainField('发件邮箱地址')
  user: string
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @Exclude({ toPlainOnly: true })
  @JSONSchemaPasswordField('发件邮箱密码', halfFieldOption)
  @Encrypt
  pass: string

  @ValidateNested()
  @Type(() => MailOption)
  @IsOptional()
  @JSONSchema({ 'ui:option': { connect: true } })
  options?: MailOption
}

@JSONSchema({ title: '评论设置' })
export class CommentOptionsDto {
  @IsBoolean()
  @IsOptional()
  @JSONSchemaToggleField('反垃圾评论')
  antiSpam: boolean

  @IsBoolean()
  @IsOptional()
  @JSONSchemaToggleField('全站禁止评论', { description: '敏感时期专用' })
  disableComment: boolean

  @IsString({ each: true })
  @IsOptional()
  @ArrayUnique()
  @JSONSchemaArrayField('自定义屏蔽关键词')
  spamKeywords?: string[]

  @IsIP(undefined, { each: true })
  @ArrayUnique()
  @IsOptional()
  @JSONSchemaArrayField('自定义屏蔽 IP')
  blockIps?: string[]

  @IsOptional()
  @IsBoolean()
  @JSONSchemaToggleField('禁止非中文评论')
  disableNoChinese?: boolean

  @IsOptional()
  @IsBoolean()
  @JSONSchemaToggleField('只展示已读评论')
  commentShouldAudit?: boolean

  @IsBoolean()
  @IsOptional()
  @JSONSchemaToggleField('评论公开归属地')
  recordIpLocation?: boolean
}

@JSONSchema({ title: '备份' })
export class BackupOptionsDto {
  @IsBoolean()
  @IsOptional()
  @JSONSchemaToggleField('开启自动备份', {
    description: '填写以下 COS 信息，将同时上传备份到 COS',
  })
  enable: boolean

  @IsString()
  @IsOptional()
  @JSONSchemaHalfGirdPlainField('SecretId')
  secretId?: string

  @IsOptional()
  @IsString()
  @Exclude({ toPlainOnly: true })
  @JSONSchemaPasswordField('SecretKey', halfFieldOption)
  @Encrypt
  secretKey?: string

  @IsOptional()
  @IsString()
  @JSONSchemaHalfGirdPlainField('Bucket')
  bucket?: string

  @IsString()
  @IsOptional()
  @JSONSchemaHalfGirdPlainField('地域 Region')
  region: string
}

@JSONSchema({ title: '百度推送设定' })
export class BaiduSearchOptionsDto {
  @IsOptional()
  @IsBoolean()
  @JSONSchemaToggleField('开启推送')
  enable: boolean

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Exclude({ toPlainOnly: true })
  @JSONSchemaPasswordField('Token')
  @Encrypt
  token?: string
}

@JSONSchema({ title: 'Algolia Search' })
export class AlgoliaSearchOptionsDto {
  @IsBoolean()
  @IsOptional()
  @JSONSchemaPlainField('开启 Algolia Search')
  enable: boolean

  @IsString()
  @IsOptional()
  @Exclude({ toPlainOnly: true })
  @JSONSchemaPasswordField('ApiKey')
  @Encrypt
  apiKey?: string

  @IsString()
  @IsOptional()
  @JSONSchemaPlainField('AppId')
  appId?: string

  @IsString()
  @IsOptional()
  @JSONSchemaPlainField('IndexName')
  indexName?: string
}

@JSONSchema({ title: '后台附加设置' })
export class AdminExtraDto {
  @IsBoolean()
  @IsOptional()
  @JSONSchemaToggleField('开启后台管理反代', {
    description: '是否可以通过 API 访问后台',
  })
  /**
   * 是否开启后台反代访问
   */
  enableAdminProxy?: boolean

  @IsString()
  @IsOptional()
  @JSONSchemaPlainField('登录页面背景')
  background?: string

  @IsString()
  @IsOptional()
  @JSONSchemaPlainField('中后台标题')
  title?: string

  @IsString()
  @IsOptional()
  @Exclude({ toPlainOnly: true })
  @Encrypt
  @JSONSchemaPasswordField('高德查询 API Key', { description: '日记地点定位' })
  gaodemapKey?: string
}

@JSONSchema({ title: '终端设定' })
export class TerminalOptionsDto {
  @IsOptional()
  @IsBoolean()
  @JSONSchemaToggleField('开启 WebShell')
  enable: boolean

  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value == 'string' && value.length == 0 ? null : value,
  )
  @Exclude({ toPlainOnly: true })
  @JSONSchemaPasswordField('设定密码', {
    description: '密码为空则不启用密码验证',
  })
  @Encrypt
  password?: string

  @IsOptional()
  @IsString()
  @JSONSchemaPlainField('前置脚本', {
    'ui:options': {
      type: 'textarea',
    },
  })
  script?: string
}

@JSONSchema({ title: '友链设定' })
export class FriendLinkOptionsDto {
  @IsBoolean()
  @IsOptional()
  @JSONSchemaToggleField('允许申请友链')
  allowApply: boolean
}

@JSONSchema({ title: '文本设定' })
export class TextOptionsDto {
  @IsBoolean()
  @IsOptional()
  @JSONSchemaToggleField('开启文本宏替换')
  macros: boolean
}

@JSONSchema({ title: 'Bark 通知设定' })
export class BarkOptionsDto {
  @IsBoolean()
  @IsOptional()
  @JSONSchemaToggleField('开启 Bark 通知')
  enable: boolean

  @IsString()
  @IsOptional()
  @JSONSchemaPlainField('设备 Key')
  @Exclude({ toPlainOnly: true })
  @Encrypt
  key: string

  @IsUrl()
  @IsOptional()
  @JSONSchemaPlainField('服务器 URL', {
    description: '如果不填写，则使用默认的服务器，https://day.app/',
  })
  serverUrl: string

  @IsOptional()
  @IsBoolean()
  @JSONSchemaToggleField('开启评论通知')
  enableComment: boolean
}

/**
 * 特征开关
 */
@JSONSchema({ title: '特征开关设定' })
export class FeatureListDto {
  @JSONSchemaToggleField('开启邮件推送订阅')
  @IsBoolean()
  @IsOptional()
  emailSubscribe: boolean
}

/**
 * 第三方服务集成
 */
@JSONSchema({ title: '第三方服务集成' })
export class ThirdPartyServiceIntegrationDto {
  @JSONSchemaPlainField('xLog SiteId', {
    description: '文章发布同步到 [xLog](https://xlog.app)',
  })
  @IsOptional()
  @IsString()
  xLogSiteId?: string
}
