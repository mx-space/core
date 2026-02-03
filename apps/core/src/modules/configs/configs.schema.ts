import { zAllowedUrl } from '~/common/zod'
import { AIProviderType } from '~/modules/ai/ai.types'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { field, section, withMeta } from './configs.zod-schema.util'

// ==================== SEO ====================
export const SeoSchema = section('SEO 优化', {
  title: field.plain(z.string().min(1).optional(), '网站标题'),
  description: field.plain(z.string().min(1).optional(), '网站描述'),
  keywords: field.array(z.array(z.string()).optional(), '关键字'),
})
export class SeoDto extends createZodDto(SeoSchema) {}
export type SeoConfig = z.infer<typeof SeoSchema>

// ==================== URL ====================
export const UrlSchema = section('网站设置', {
  webUrl: field.halfGrid(zAllowedUrl.optional(), '前端地址'),
  adminUrl: field.halfGrid(zAllowedUrl.optional(), '管理后台地址'),
  serverUrl: field.halfGrid(zAllowedUrl.optional(), 'API 地址'),
  wsUrl: field.halfGrid(zAllowedUrl.optional(), 'Gateway 地址'),
})
export class UrlDto extends createZodDto(UrlSchema) {}
export type UrlConfig = z.infer<typeof UrlSchema>

// ==================== Mail Options ====================
const SmtpOptionsSchema = z.object({
  port: field.number(
    z.preprocess(
      (val) => (val ? Number(val) : val),
      z.number().int().optional(),
    ),
    'SMTP 端口',
    { 'ui:options': { halfGrid: true } },
  ),
  host: field.halfGrid(
    z.url({ message: 'host must be a valid URL' }).optional().or(z.literal('')),
    'SMTP 主机',
  ),
  secure: field.toggle(z.boolean().optional(), '使用 SSL/TLS'),
})

const SmtpConfigSchema = withMeta(
  z
    .object({
      user: field.halfGrid(z.string().optional(), 'SMTP 用户名'),
      pass: field.passwordHalfGrid(z.string().min(1).optional(), 'SMTP 密码'),
      options: withMeta(SmtpOptionsSchema.optional(), {
        'ui:options': { connect: true },
      }),
    })
    .optional(),
  {
    title: 'SMTP 配置',
    'ui:options': { showWhen: { provider: 'smtp' } },
  },
)

const ResendConfigSchema = withMeta(
  z
    .object({
      apiKey: field.password(z.string().optional(), 'Resend API Key'),
    })
    .optional(),
  {
    title: 'Resend 配置',
    'ui:options': { showWhen: { provider: 'resend' } },
  },
)

export const MailOptionsSchema = section('邮件通知设置', {
  enable: field.toggle(z.boolean().optional(), '开启邮箱提醒'),
  provider: field.select(z.enum(['smtp', 'resend']).optional(), '邮件服务', [
    { label: 'SMTP', value: 'smtp' },
    { label: 'Resend', value: 'resend' },
  ]),
  from: field.halfGrid(z.email().optional().or(z.literal('')), '发件邮箱地址', {
    description: 'Resend 必填；SMTP 可选，不填则使用 SMTP 用户名',
  }),
  smtp: SmtpConfigSchema,
  resend: ResendConfigSchema,
})
export class MailOptionsDto extends createZodDto(MailOptionsSchema) {}
export type MailOptionsConfig = z.infer<typeof MailOptionsSchema>

// ==================== Comment Options ====================
export const CommentOptionsSchema = section('评论设置', {
  antiSpam: field.toggle(z.boolean().optional(), '反垃圾评论'),
  aiReview: field.toggle(z.boolean().optional(), '开启 AI 审核'),
  aiReviewType: field.select(
    z.enum(['binary', 'score']).optional(),
    'AI 审核方式',
    [
      { label: '是非', value: 'binary' },
      { label: '评分', value: 'score' },
    ],
    { description: '默认为是非，可以选择评分' },
  ),
  aiReviewThreshold: field.number(
    z.preprocess(
      (val) => (val ? Number(val) : val),
      z.number().int().min(1).max(10).optional(),
    ),
    'AI 审核阈值',
    { description: '分数大于多少时会被归类为垃圾评论，范围为 1-10, 默认为 5' },
  ),
  testAiReview: field.action('测试 AI 审核', 'test-ai-review', {
    description: '输入测试内容，验证 AI 审核功能是否正常工作',
    actionLabel: '测试',
    showWhen: { aiReview: 'true' },
  }),
  disableComment: field.toggle(z.boolean().optional(), '全站禁止评论', {
    description: '敏感时期专用',
  }),
  spamKeywords: field.array(z.array(z.string()).optional(), '自定义屏蔽关键词'),
  blockIps: field.array(
    z.array(z.union([z.ipv4(), z.ipv6()])).optional(),
    '自定义屏蔽 IP',
  ),
  disableNoChinese: field.toggle(z.boolean().optional(), '禁止非中文评论'),
  commentShouldAudit: field.toggle(z.boolean().optional(), '只展示已读评论'),
  recordIpLocation: field.toggle(z.boolean().optional(), '评论公开归属地'),
})
export class CommentOptionsDto extends createZodDto(CommentOptionsSchema) {}
export type CommentOptionsConfig = z.infer<typeof CommentOptionsSchema>

// ==================== Backup Options ====================
export const BackupOptionsSchema = section('备份', {
  enable: field.toggle(z.boolean().optional(), '开启自动备份', {
    description: '填写以下 S3 信息，将同时上传备份到 S3',
  }),
  endpoint: field.plain(z.string().optional(), 'S3 服务端点'),
  secretId: field.halfGrid(z.string().optional(), 'SecretId'),
  secretKey: field.passwordHalfGrid(z.string().optional(), 'SecretKey'),
  bucket: field.halfGrid(z.string().optional(), 'Bucket'),
  region: field.halfGrid(z.string().optional(), '地域 Region'),
})
export class BackupOptionsDto extends createZodDto(BackupOptionsSchema) {}
export type BackupOptionsConfig = z.infer<typeof BackupOptionsSchema>

// ==================== Image Storage Options ====================
export const ImageStorageOptionsSchema = section('图床设置', {
  enable: field.toggle(z.boolean().optional(), '开启 S3 图床'),
  syncOnPublish: field.toggle(z.boolean().optional(), '发布时自动同步', {
    description: '文章/日记发布时自动将本地图片迁移到 S3',
  }),
  deleteLocalAfterSync: field.toggle(
    z.boolean().optional(),
    '同步后删除本地文件',
    {
      description: '图片迁移到 S3 后删除服务器上的本地文件',
    },
  ),
  endpoint: field.plain(z.string().optional(), 'S3 服务端点'),
  secretId: field.halfGrid(z.string().optional(), 'Access Key ID'),
  secretKey: field.passwordHalfGrid(z.string().optional(), 'Secret Access Key'),
  bucket: field.halfGrid(z.string().optional(), 'Bucket'),
  region: field.halfGrid(z.string().optional(), 'Region').default('auto'),
  customDomain: field.plain(
    z.url().optional().or(z.literal('')),
    '自定义域名 (CDN)',
    {
      description: '用于替换默认的 S3 URL，例如 CDN 域名',
    },
  ),
  prefix: field.plain(z.string().optional(), '文件路径前缀', {
    description: '上传到 S3 的文件路径前缀，例如 images/',
  }),
})
export class ImageStorageOptionsDto extends createZodDto(
  ImageStorageOptionsSchema,
) {}
export type ImageStorageOptionsConfig = z.infer<
  typeof ImageStorageOptionsSchema
>

// ==================== Baidu Search Options ====================
export const BaiduSearchOptionsSchema = section('百度推送设定', {
  enable: field.toggle(z.boolean().optional(), '开启推送'),
  token: field.password(z.string().min(1).optional(), 'Token'),
})
export class BaiduSearchOptionsDto extends createZodDto(
  BaiduSearchOptionsSchema,
) {}
export type BaiduSearchOptionsConfig = z.infer<typeof BaiduSearchOptionsSchema>

// ==================== Bing Search Options ====================
export const BingSearchOptionsSchema = section('Bing 推送设定', {
  enable: field.toggle(z.boolean().optional(), '开启推送'),
  token: field.password(z.string().optional(), 'Bing API 密钥'),
})
export class BingSearchOptionsDto extends createZodDto(
  BingSearchOptionsSchema,
) {}
export type BingSearchOptionsConfig = z.infer<typeof BingSearchOptionsSchema>

// ==================== Algolia Search Options ====================
export const AlgoliaSearchOptionsSchema = section('Algolia Search', {
  enable: field.plain(z.boolean().optional(), '开启 Algolia Search'),
  apiKey: field.password(z.string().optional(), 'ApiKey'),
  appId: field.plain(z.string().optional(), 'AppId'),
  indexName: field.plain(z.string().optional(), 'IndexName'),
  maxTruncateSize: field.plain(
    z.preprocess(
      (val) => (val ? Number(val) : val),
      z.number().int().min(100).optional(),
    ),
    '最大文档大小',
    {
      description:
        'Algolia 文档大小限制，单位为字节，免费版本为 10K, 填写为 10000',
    },
  ),
})
export class AlgoliaSearchOptionsDto extends createZodDto(
  AlgoliaSearchOptionsSchema,
) {}
export type AlgoliaSearchOptionsConfig = z.infer<
  typeof AlgoliaSearchOptionsSchema
>

// ==================== Admin Extra ====================
export const AdminExtraSchema = section('后台附加设置', {
  enableAdminProxy: field.toggle(z.boolean().optional(), '开启后台管理反代', {
    description: '是否可以通过 API 访问后台',
  }),
  background: field.plain(z.string().optional(), '登录页面背景'),
  gaodemapKey: field.password(z.string().optional(), '高德查询 API Key', {
    description: '日记地点定位',
  }),
})
export class AdminExtraDto extends createZodDto(AdminExtraSchema) {}
export type AdminExtraConfig = z.infer<typeof AdminExtraSchema>

// ==================== Friend Link Options ====================
export const FriendLinkOptionsSchema = section('友链设定', {
  allowApply: field.toggle(z.boolean().optional(), '允许申请友链'),
  allowSubPath: field.toggle(z.boolean().optional(), '允许子路径友链', {
    description: '例如 /blog 子路径',
  }),
  enableAvatarInternalization: field.toggle(
    z.boolean().optional(),
    '友链头像转内链',
    {
      description:
        '通过审核后将会下载友链头像并改为内部链接，仅支持常见图片格式，其他格式将不会转换',
    },
  ),
})
export class FriendLinkOptionsDto extends createZodDto(
  FriendLinkOptionsSchema,
) {}
export type FriendLinkOptionsConfig = z.infer<typeof FriendLinkOptionsSchema>

// ==================== Text Options ====================
export const TextOptionsSchema = section('文本设定', {
  macros: field.toggle(z.boolean().optional(), '开启文本宏替换'),
})
export class TextOptionsDto extends createZodDto(TextOptionsSchema) {}
export type TextOptionsConfig = z.infer<typeof TextOptionsSchema>

// ==================== Bark Options ====================
export const BarkOptionsSchema = section('Bark 通知设定', {
  enable: field.toggle(z.boolean().optional(), '开启 Bark 通知'),
  key: field.password(z.string().optional(), '设备 Key'),
  serverUrl: field.plain(z.string().url().optional(), '服务器 URL', {
    description: '如果不填写，则使用默认的服务器，https://day.app',
  }),
  enableComment: field.toggle(z.boolean().optional(), '开启评论通知'),
  enableThrottleGuard: field.toggle(
    z.boolean().optional(),
    '开启请求被限流时通知',
    {
      description: '当请求被限流会通知，或许可以一定程度上预警被攻击',
    },
  ),
})
export class BarkOptionsDto extends createZodDto(BarkOptionsSchema) {}
export type BarkOptionsConfig = z.infer<typeof BarkOptionsSchema>

// ==================== Feature List ====================
export const FeatureListSchema = section('特征开关设定', {
  emailSubscribe: field.toggle(z.boolean().optional(), '开启邮件推送订阅'),
})
export class FeatureListDto extends createZodDto(FeatureListSchema) {}
export type FeatureListConfig = z.infer<typeof FeatureListSchema>

// ==================== Third Party Service Integration ====================
export const ThirdPartyServiceIntegrationSchema = section('第三方服务信息', {
  githubToken: field.password(z.string().optional(), 'GitHub Token', {
    description:
      '用于调用 GitHub API，获取仓库信息等；可选参数，如果没有遇到限流问题，可以不填写',
  }),
})
export class ThirdPartyServiceIntegrationDto extends createZodDto(
  ThirdPartyServiceIntegrationSchema,
) {}
export type ThirdPartyServiceIntegrationConfig = z.infer<
  typeof ThirdPartyServiceIntegrationSchema
>

// ==================== Auth Security ====================
export const AuthSecuritySchema = section(
  '认证安全设置',
  {
    disablePasswordLogin: field.toggle(z.boolean().optional(), '禁用密码登录', {
      description:
        '禁用密码登录，只能通过 PassKey or Oauth 登录，如果没有配置这些请不要开启',
    }),
  },
  { 'ui:options': { type: 'hidden' } },
)
export class AuthSecurityDto extends createZodDto(AuthSecuritySchema) {}
export type AuthSecurityConfig = z.infer<typeof AuthSecuritySchema>

// ==================== AI Provider Config ====================
const AIProviderConfigSchema = withMeta(
  z.object({
    id: field.plain(z.string().min(1), 'Provider ID', {
      description: '唯一标识符，如 "openai-main", "deepseek"',
    }),
    name: field.plain(z.string().min(1), '显示名称'),
    type: field.plain(z.enum(AIProviderType), 'Provider 类型', {
      description: 'openai | openai-compatible | anthropic | openrouter',
    }),
    apiKey: field.password(z.string().min(1), 'API Key'),
    endpoint: field.plain(z.string().optional(), '自定义 Endpoint', {
      description: 'OpenAI 兼容服务必填，如 https://api.deepseek.com',
    }),
    defaultModel: field.plain(z.string().min(1), '默认模型', {
      description: '如 gpt-4o, deepseek-chat, claude-sonnet-4-20250514',
    }),
    enabled: field.toggle(z.boolean(), '启用'),
  }),
  { title: 'AI Provider 配置', 'ui:options': { type: 'hidden' } },
)

const AIModelAssignmentSchema = withMeta(
  z.object({
    providerId: field.plain(z.string().optional(), 'Provider ID', {
      description: '指向 providers 中某个 provider 的 id',
    }),
    model: field.plain(z.string().optional(), '模型覆盖', {
      description: '覆盖 provider 的默认模型，留空使用 provider 默认值',
    }),
  }),
  { title: 'AI 模型分配', 'ui:options': { type: 'hidden' } },
)

export const AISchema = section('AI 设定', {
  providers: field.array(
    z.array(AIProviderConfigSchema).optional(),
    'AI Providers',
    { description: '配置多个 AI 服务提供商' },
  ),
  summaryModel: field.plain(AIModelAssignmentSchema.optional(), '摘要功能模型'),
  writerModel: field.plain(AIModelAssignmentSchema.optional(), '写作助手模型'),
  commentReviewModel: field.plain(
    AIModelAssignmentSchema.optional(),
    '评论审核模型',
  ),
  enableSummary: field.toggle(z.boolean().optional(), '可调用 AI 摘要', {
    description: '是否开启调用 AI 去生成摘要',
  }),
  enableAutoGenerateSummary: field.toggle(
    z.boolean().optional(),
    '开启 AI 摘要自动生成',
    {
      description:
        '此选项开启后，将会在文章发布后自动生成摘要，需要开启上面的选项，否则无效',
    },
  ),
  aiSummaryTargetLanguage: field.plain(
    z.string().optional(),
    'AI 摘要目标语言',
    {
      description:
        '生成的摘要目标语言，默认为 `auto`，根据用户的语言自动选择；如果需要固定语言，请填写 [ISO 639-1 语言代码](https://www.w3schools.com/tags/ref_language_codes.asp)',
    },
  ),
  translationModel: field.plain(
    AIModelAssignmentSchema.optional(),
    '翻译功能模型',
  ),
  enableTranslation: field.toggle(z.boolean().optional(), '可调用 AI 翻译', {
    description: '是否开启调用 AI 去生成翻译',
  }),
  enableAutoGenerateTranslation: field.toggle(
    z.boolean().optional(),
    '开启 AI 翻译自动生成',
    {
      description:
        '此选项开启后，将会在文章发布后自动生成翻译，需要开启上面的选项，否则无效',
    },
  ),
  translationTargetLanguages: field.array(
    z.array(z.string()).optional(),
    'AI 翻译目标语言列表',
    {
      description:
        '自动生成翻译的目标语言列表，使用 [ISO 639-1 语言代码](https://www.w3schools.com/tags/ref_language_codes.asp)，如 ["en", "ja", "ko"]',
    },
  ),
})
export class AIDto extends createZodDto(AISchema) {}
export type AIConfig = z.infer<typeof AISchema>

// ==================== OAuth ====================
const OAuthProviderSchema = z.object({
  type: z.string().min(1),
  enabled: z.boolean(),
})

export const OAuthSchema = section(
  'OAuth',
  {
    providers: z.array(OAuthProviderSchema).optional(),
    secrets: withMeta(
      z.record(z.string(), z.record(z.string(), z.string())).optional(),
      { encrypt: true },
    ),
    public: z.record(z.string(), z.record(z.string(), z.string())).optional(),
  },
  { 'ui:options': { type: 'hidden' } },
)
export class OAuthDto extends createZodDto(OAuthSchema) {}
export type OAuthConfig = z.infer<typeof OAuthSchema>

// ==================== Config Schema Mapping ====================
export const configSchemaMapping = {
  url: UrlSchema,
  seo: SeoSchema,
  adminExtra: AdminExtraSchema,
  textOptions: TextOptionsSchema,
  mailOptions: MailOptionsSchema,
  commentOptions: CommentOptionsSchema,
  barkOptions: BarkOptionsSchema,
  friendLinkOptions: FriendLinkOptionsSchema,
  backupOptions: BackupOptionsSchema,
  imageStorageOptions: ImageStorageOptionsSchema,
  baiduSearchOptions: BaiduSearchOptionsSchema,
  bingSearchOptions: BingSearchOptionsSchema,
  algoliaSearchOptions: AlgoliaSearchOptionsSchema,
  featureList: FeatureListSchema,
  thirdPartyServiceIntegration: ThirdPartyServiceIntegrationSchema,
  authSecurity: AuthSecuritySchema,
  ai: AISchema,
  oauth: OAuthSchema,
} as const

export type ConfigSchemaMapping = typeof configSchemaMapping
export type ConfigKeys = keyof ConfigSchemaMapping

// ==================== Full Config Schema ====================
export const FullConfigSchema = withMeta(
  z.object({
    url: UrlSchema,
    seo: SeoSchema,
    adminExtra: AdminExtraSchema,
    textOptions: TextOptionsSchema,
    mailOptions: MailOptionsSchema,
    commentOptions: CommentOptionsSchema,
    barkOptions: BarkOptionsSchema,
    friendLinkOptions: FriendLinkOptionsSchema,
    backupOptions: BackupOptionsSchema,
    imageStorageOptions: ImageStorageOptionsSchema,
    baiduSearchOptions: BaiduSearchOptionsSchema,
    bingSearchOptions: BingSearchOptionsSchema,
    algoliaSearchOptions: AlgoliaSearchOptionsSchema,
    featureList: FeatureListSchema,
    thirdPartyServiceIntegration: ThirdPartyServiceIntegrationSchema,
    authSecurity: AuthSecuritySchema,
    ai: AISchema,
    oauth: OAuthSchema,
  }),
  {
    title: '设置',
    description: '* 敏感字段不显示，后端默认不返回敏感字段，显示为空',
  },
)

export type FullConfig = z.infer<typeof FullConfigSchema>
