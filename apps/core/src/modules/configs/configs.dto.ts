import { IsAllowedUrl } from '~/decorators/dto/isAllowedUrl'
import { Exclude, Transform, Type } from 'class-transformer'
import {
  ArrayUnique,
  IsBoolean,
  IsEmail,
  IsInt,
  IsIP,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  ValidateNested,
} from 'class-validator'
import { JSONSchema } from 'class-validator-jsonschema'
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

const SecretField = (target: object, propertyKey: string | symbol) => {
  Encrypt(target, propertyKey)
  Exclude({ toPlainOnly: true })(target, propertyKey)
}

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
  @Transform(({ value: val }) => Number.parseInt(val))
  @IsOptional()
  @JSONSchemaNumberField('SMTP 端口', halfFieldOption)
  port: number
  @IsUrl({ require_protocol: false })
  @IsOptional()
  @JSONSchemaHalfGirdPlainField('SMTP 主机')
  host: string
  @IsBoolean()
  @IsOptional()
  @JSONSchemaToggleField('使用 SSL/TLS')
  secure: boolean
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
  from: string
  @IsString()
  @IsOptional()
  @JSONSchemaHalfGirdPlainField('SMTP 用户名')
  user: string
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @JSONSchemaPasswordField('SMTP 密码', halfFieldOption)
  @SecretField
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
  @JSONSchemaToggleField('开启 AI 审核')
  aiReview: boolean

  @IsString()
  @IsOptional()
  @JSONSchemaPlainField('AI 审核方式', {
    description: '默认为是非，可以选择评分',
    'ui:options': {
      type: 'select',
      values: [
        {
          label: '是非',
          value: 'binary',
        },
        {
          label: '评分',
          value: 'score',
        },
      ],
    },
  })
  aiReviewType: 'binary' | 'score'

  @IsInt()
  @Transform(({ value: val }) => Number.parseInt(val))
  @Min(1)
  @Max(10)
  @IsOptional()
  @JSONSchemaNumberField('AI 审核阈值', {
    description: '分数大于多少时会被归类为垃圾评论，范围为 1-10, 默认为 5',
  })
  aiReviewThreshold: number

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
    description: '填写以下 S3 信息，将同时上传备份到 S3',
  })
  enable: boolean

  @IsString()
  @IsOptional()
  @JSONSchemaPlainField('S3 服务端点')
  endpoint?: string

  @IsString()
  @IsOptional()
  @JSONSchemaHalfGirdPlainField('SecretId')
  secretId?: string

  @IsOptional()
  @IsString()
  @JSONSchemaPasswordField('SecretKey', halfFieldOption)
  @SecretField
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
  @JSONSchemaPasswordField('Token')
  @SecretField
  token?: string
}

@JSONSchema({ title: 'Bing 推送设定' })
export class BingSearchOptionsDto {
  @IsOptional()
  @IsBoolean()
  @JSONSchemaToggleField('开启推送')
  enable?: boolean

  @IsOptional()
  @IsString()
  @SecretField
  @JSONSchemaPasswordField('Bing API 密钥')
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
  @JSONSchemaPasswordField('ApiKey')
  @SecretField
  apiKey?: string

  @IsString()
  @IsOptional()
  @JSONSchemaPlainField('AppId')
  appId?: string

  @IsString()
  @IsOptional()
  @JSONSchemaPlainField('IndexName')
  indexName?: string

  @IsInt()
  @Min(100)
  @IsOptional()
  @JSONSchemaPlainField('最大文档大小', {
    description:
      'Algolia 文档大小限制，单位为字节，免费版本为 10K, 填写为 10000',
  })
  maxTruncateSize?: number
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
  @SecretField
  @JSONSchemaPasswordField('高德查询 API Key', { description: '日记地点定位' })
  gaodemapKey?: string
}

@JSONSchema({ title: '友链设定' })
export class FriendLinkOptionsDto {
  @IsBoolean()
  @IsOptional()
  @JSONSchemaToggleField('允许申请友链')
  allowApply: boolean

  @IsBoolean()
  @IsOptional()
  @JSONSchemaToggleField('允许子路径友链', { description: '例如 /blog 子路径' })
  allowSubPath: boolean
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
  @SecretField
  key: string

  @IsUrl()
  @IsOptional()
  @JSONSchemaPlainField('服务器 URL', {
    description: '如果不填写，则使用默认的服务器，https://day.app',
  })
  serverUrl: string

  @IsOptional()
  @IsBoolean()
  @JSONSchemaToggleField('开启评论通知')
  enableComment: boolean

  @IsOptional()
  @IsBoolean()
  @JSONSchemaToggleField('开启请求被限流时通知', {
    description: '当请求被限流会通知，或许可以一定程度上预警被攻击',
  })
  enableThrottleGuard: boolean
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
@JSONSchema({ title: '第三方服务信息' })
export class ThirdPartyServiceIntegrationDto {
  @JSONSchemaPlainField('xLog SiteId', {
    description: '文章发布同步到 [xLog](https://xlog.app)',
  })
  @IsOptional()
  @IsString()
  xLogSiteId?: string

  @JSONSchemaPasswordField('GitHub Token', {
    description:
      '用于调用 GitHub API，获取仓库信息等；可选参数，如果没有遇到限流问题，可以不填写',
  })
  @IsOptional()
  @IsString()
  @SecretField
  githubToken?: string
}

@JSONSchema({ title: '认证安全设置', 'ui:options': { type: 'hidden' } })
export class AuthSecurityDto {
  @JSONSchemaToggleField('禁用密码登录', {
    description:
      '禁用密码登录，只能通过 PassKey or Oauth 登录，如果没有配置这些请不要开启',
  })
  @IsBoolean()
  @IsOptional()
  disablePasswordLogin: boolean
}
@JSONSchema({ title: 'AI 设定' })
export class AIDto {
  @IsOptional()
  @JSONSchemaPasswordField('OpenAI Key')
  @IsString()
  @SecretField
  openAiKey: string

  @IsOptional()
  @IsString()
  @JSONSchemaPlainField('OpenAI Endpoint')
  openAiEndpoint: string

  @IsOptional()
  @IsString()
  @JSONSchemaPlainField('OpenAI 默认模型')
  openAiPreferredModel: string

  @IsBoolean()
  @IsOptional()
  @JSONSchemaToggleField('可调用 AI 摘要', {
    description: '是否开启调用 AI 去生成摘要',
  })
  enableSummary: boolean

  @IsBoolean()
  @IsOptional()
  @JSONSchemaToggleField('开启 AI 摘要自动生成', {
    description:
      '此选项开启后，将会在文章发布后自动生成摘要，需要开启上面的选项，否则无效',
  })
  enableAutoGenerateSummary: boolean

  @IsBoolean()
  @IsOptional()
  @JSONSchemaToggleField('开启 AI 深度阅读', {
    description: '是否开启调用 AI 去生成深度阅读',
  })
  enableDeepReading: boolean

  @IsString()
  @IsOptional()
  @JSONSchemaPlainField('AI 摘要目标语言', {
    description:
      '生成的摘要目标语言，默认为 `auto`，根据用户的语言自动选择；如果需要固定语言，请填写 [ISO 639-1 语言代码](https://www.w3schools.com/tags/ref_language_codes.asp)',
  })
  aiSummaryTargetLanguage: string
}

export class OAuthDto {
  @IsObject({ each: true })
  @Type(() => OAuthProviderDto)
  @IsOptional()
  providers: OAuthProviderDto[]

  @IsObject()
  @IsOptional()
  @SecretField
  secrets: Record<string, Record<string, string>>

  @IsObject()
  @IsOptional()
  public: Record<string, Record<string, string>>
}

class OAuthProviderDto {
  @IsString()
  @IsNotEmpty()
  type: string

  @IsBoolean()
  enabled: boolean
}
