import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { zAllowedUrl } from '~/common/zod'
import { AIProviderType } from '~/modules/ai/ai.types'

import { field, section, withMeta } from './configs.zod-schema.util'

// ==================== SEO ====================
export const SeoSchema = section('SEO', {
  title: field.plain(z.string().min(1).optional(), 'Site title'),
  description: field.plain(z.string().min(1).optional(), 'Site description'),
  icon: field.halfGrid(z.string().optional(), 'Light icon URL'),
  iconDark: field.halfGrid(z.string().optional(), 'Dark icon URL'),
  keywords: field.array(z.array(z.string()).optional(), 'Keywords'),
  i18n: field.hidden(
    z
      .record(
        z.string().length(2),
        z.object({
          title: z.string().min(1).optional(),
          description: z.string().min(1).optional(),
          keywords: z.array(z.string()).optional(),
        }),
      )
      .optional(),
    'Per-locale SEO overrides',
  ),
})
export class SeoDto extends createZodDto(SeoSchema) {}
export type SeoConfig = z.infer<typeof SeoSchema>

// ==================== URL ====================
export const UrlSchema = section('Site URLs', {
  webUrl: field.halfGrid(zAllowedUrl.optional(), 'Frontend URL'),
  adminUrl: field.halfGrid(zAllowedUrl.optional(), 'Admin dashboard URL'),
  serverUrl: field.halfGrid(zAllowedUrl.optional(), 'API URL'),
  wsUrl: field.halfGrid(zAllowedUrl.optional(), 'Gateway URL'),
})
export class UrlDto extends createZodDto(UrlSchema) {}
export type UrlConfig = z.infer<typeof UrlSchema>

// ==================== Mail Options ====================
const SmtpConfigSchema = withMeta(
  z
    .object({
      user: field.halfGrid(z.string().optional(), 'SMTP username'),
      pass: field.passwordHalfGrid(
        z.string().min(1).optional(),
        'SMTP password',
      ),
      host: field.halfGrid(z.string().optional(), 'SMTP host'),
      port: field.number(
        z.preprocess(
          (val) => (val ? Number(val) : val),
          z.number().int().optional(),
        ),
        'SMTP port',
        { 'ui:options': { halfGrid: true } },
      ),
      secure: field.toggle(z.boolean().optional(), 'Use SSL/TLS'),
    })
    .optional(),
  {
    title: 'SMTP configuration',
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
    title: 'Resend configuration',
    'ui:options': { showWhen: { provider: 'resend' } },
  },
)

export const MailOptionsSchema = section('Email notifications', {
  enable: field.toggle(z.boolean().optional(), 'Enable email notifications'),
  provider: field.select(
    z.enum(['smtp', 'resend']).optional(),
    'Email provider',
    [
      { label: 'SMTP', value: 'smtp' },
      { label: 'Resend', value: 'resend' },
    ],
  ),
  from: field.halfGrid(
    z.email().optional().or(z.literal('')),
    'Sender email address',
    {
      description:
        'Required for Resend; optional for SMTP (defaults to the SMTP username if omitted)',
    },
  ),
  smtp: SmtpConfigSchema,
  resend: ResendConfigSchema,
  rateLimit: field.number(
    z.preprocess(
      (val) => (val ? Number(val) : val),
      z.number().int().min(1).max(1000).optional(),
    ),
    'Send rate limit',
    {
      description: 'Maximum sends per second; defaults to 10',
      'ui:options': { halfGrid: true },
    },
  ),
  retryCount: field.number(
    z.preprocess(
      (val) => (val ? Number(val) : val),
      z.number().int().min(0).max(10).optional(),
    ),
    'Send failure retry count',
    {
      description: 'Maximum retries after a send failure; defaults to 3',
      'ui:options': { halfGrid: true },
    },
  ),
})
export class MailOptionsDto extends createZodDto(MailOptionsSchema) {}
export type MailOptionsConfig = z.infer<typeof MailOptionsSchema>

// ==================== Comment Options ====================
export const CommentOptionsSchema = section('Comment settings', {
  antiSpam: field.toggle(z.boolean().optional(), 'Anti-spam'),
  aiReview: field.toggle(z.boolean().optional(), 'Enable AI review'),
  aiReviewType: field.select(
    z.enum(['binary', 'score']).optional(),
    'AI review mode',
    [
      { label: 'Binary', value: 'binary' },
      { label: 'Score', value: 'score' },
    ],
    { description: 'Defaults to binary; score mode is also available' },
  ),
  aiReviewThreshold: field.number(
    z.preprocess(
      (val) => (val ? Number(val) : val),
      z.number().int().min(1).max(10).optional(),
    ),
    'AI review threshold',
    {
      description:
        'Scores above this value are classified as spam. Range 1-10, default 5',
    },
  ),
  testAiReview: field.action('Test AI review', 'test-ai-review', {
    description:
      'Enter test content to verify whether AI review is working correctly',
    actionLabel: 'Test',
    showWhen: { aiReview: 'true' },
  }),
  disableComment: field.toggle(
    z.boolean().optional(),
    'Disable comments site-wide',
    {
      description: 'Reserved for sensitive periods',
    },
  ),
  allowGuestComment: field.toggle(
    z.boolean().optional(),
    'Allow comments without login',
    {
      description:
        'When disabled, only signed-in readers or the owner can comment and reply',
    },
  ),
  spamKeywords: field.array(
    z.array(z.string()).optional(),
    'Custom blocked keywords',
  ),
  blockIps: field.array(
    z.array(z.union([z.ipv4(), z.ipv6()])).optional(),
    'Custom blocked IPs',
  ),
  disableNoChinese: field.toggle(
    z.boolean().optional(),
    'Reject non-Chinese comments',
  ),
  commentShouldAudit: field.toggle(
    z.boolean().optional(),
    'Only show approved comments',
  ),
  recordIpLocation: field.toggle(
    z.boolean().optional(),
    'Publicly display comment location',
  ),
})
export class CommentOptionsDto extends createZodDto(CommentOptionsSchema) {}
export type CommentOptionsConfig = z.infer<typeof CommentOptionsSchema>

// ==================== S3 Storage Options ====================
const nullableStorageText = () =>
  z
    .string()
    .nullable()
    .optional()
    .transform((value) => (value === null ? '' : value))

// ==================== Backup Options ====================
export const BackupOptionsSchema = section('Backup', {
  enable: field.toggle(z.boolean().optional(), 'Enable automatic backup', {
    description:
      'Fill in the S3 information below to also upload backups to S3',
  }),
  endpoint: field.plain(nullableStorageText(), 'S3 endpoint'),
  secretId: field.halfGrid(nullableStorageText(), 'SecretId'),
  secretKey: field.passwordHalfGrid(nullableStorageText(), 'SecretKey'),
  bucket: field.halfGrid(nullableStorageText(), 'Bucket'),
  region: field
    .halfGrid(nullableStorageText(), 'Region')
    .transform((value) => value || 'auto'),
})
export class BackupOptionsDto extends createZodDto(BackupOptionsSchema) {}
export type BackupOptionsConfig = z.infer<typeof BackupOptionsSchema>

// ==================== Image Storage Options ====================

export const ImageStorageOptionsSchema = section('Image storage', {
  enable: field.toggle(z.boolean().optional(), 'Enable S3 image storage'),
  endpoint: field.plain(nullableStorageText(), 'S3 endpoint'),
  secretId: field.halfGrid(nullableStorageText(), 'Access Key ID'),
  secretKey: field.passwordHalfGrid(nullableStorageText(), 'Secret Access Key'),
  bucket: field.halfGrid(nullableStorageText(), 'Bucket'),
  region: field
    .halfGrid(nullableStorageText(), 'Region')
    .transform((value) => value || 'auto'),
  customDomain: field.plain(
    z.url().optional().or(z.literal('')),
    'Custom domain (CDN)',
    {
      description: 'Used to replace the default S3 URL, e.g. a CDN domain',
    },
  ),
  prefix: field.plain(z.string().optional(), 'File path prefix', {
    description:
      'Path prefix for files uploaded to S3. Supports placeholders: {Y} 4-digit year, {y} 2-digit year, {m} month, {d} day, {h} hour, {i} minute, {s} second, {md5} random MD5, {type} file type, etc. Example: blog/{Y}/{m}/{d} or images/',
  }),
  commentUploadPrefix: field.plain(
    z.string().optional(),
    'Comment image path prefix',
    {
      description:
        'Path prefix dedicated to reader comment uploads. Defaults to comments/{readerId}/{Y}/{m}/{md5}.{ext} when empty. Placeholders are the same as prefix, with additional support for {readerId}',
    },
  ),
})
export class ImageStorageOptionsDto extends createZodDto(
  ImageStorageOptionsSchema,
) {}
export type ImageStorageOptionsConfig = z.infer<
  typeof ImageStorageOptionsSchema
>

// ==================== Image Generation Options ====================
export const ImageGenerationOptionsSchema = section('AI image generation', {
  enable: field.toggle(z.boolean().optional(), 'Enable AI image generation'),
  provider: field.select(
    z.enum(['openrouter', 'custom']).optional().default('openrouter'),
    'Provider',
    [
      { label: 'OpenRouter', value: 'openrouter' },
      { label: 'Custom', value: 'custom' },
    ],
    {
      description:
        'Endpoint preset — determines where generation requests are sent. "custom" requires Endpoint to be set.',
    },
  ),
  apiKey: field.password(
    z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v === null ? '' : v)),
    'API Key',
  ),
  endpoint: field.plain(
    z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v === null ? '' : v)),
    'Endpoint',
    { 'ui:options': { showWhen: { provider: 'custom' } } },
  ),
  model: field.plain(
    z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v === null ? '' : v)),
    'Model',
    { description: 'Image generation model id' },
  ),
  defaultAspectRatio: field.halfGrid(
    z.string().optional().default('16:9'),
    'Default aspect ratio',
  ),
  defaultQuality: field.select(
    z.enum(['low', 'standard', 'high']).optional().default('standard'),
    'Default quality',
    [
      { label: 'Low', value: 'low' },
      { label: 'Standard', value: 'standard' },
      { label: 'High', value: 'high' },
    ],
    { 'ui:options': { halfGrid: true } },
  ),
  defaultFormat: field.select(
    z.enum(['png', 'jpeg', 'webp']).optional().default('png'),
    'Default format',
    [
      { label: 'PNG', value: 'png' },
      { label: 'JPEG', value: 'jpeg' },
      { label: 'WebP', value: 'webp' },
    ],
    { 'ui:options': { halfGrid: true } },
  ),
})
export class ImageGenerationOptionsDto extends createZodDto(
  ImageGenerationOptionsSchema,
) {}
export type ImageGenerationOptionsConfig = z.infer<
  typeof ImageGenerationOptionsSchema
>

// ==================== TTS Options ====================
export const TtsOptionsSchema = section('AI text to speech', {
  enable: field.toggle(z.boolean().optional(), 'Enable AI narration'),
  provider: field.select(
    z.enum(['openrouter', 'openai', 'custom']).optional().default('openrouter'),
    'Provider',
    [
      { label: 'OpenRouter', value: 'openrouter' },
      { label: 'OpenAI', value: 'openai' },
      { label: 'Custom', value: 'custom' },
    ],
    {
      description:
        'Endpoint preset. "custom" requires Endpoint to be set. The adapter appends /audio/speech.',
    },
  ),
  apiKey: field.password(nullableStorageText(), 'API Key'),
  endpoint: field.plain(nullableStorageText(), 'Endpoint', {
    'ui:options': { showWhen: { provider: 'custom' } },
  }),
  model: field.plain(nullableStorageText(), 'Model', {
    description: 'Speech model id, e.g. openai/gpt-4o-mini-tts-2025-12-15',
  }),
  voice: field.plain(nullableStorageText(), 'Voice', {
    description: 'Voice id. Availability depends on the model.',
  }),
  speed: field.number(
    z.coerce.number().min(0.25).max(4).optional().default(1),
    'Speed',
    { 'ui:options': { halfGrid: true } },
  ),
  maxCharsPerChunk: field.number(
    z.coerce.number().int().min(200).max(4000).optional().default(1800),
    'Max characters per request',
    { 'ui:options': { halfGrid: true } },
  ),
  concurrency: field.number(
    z.coerce.number().int().min(1).max(8).optional().default(3),
    'Concurrent requests per task',
    { 'ui:options': { halfGrid: true } },
  ),
  maxCharsPerRun: field.number(
    z.coerce.number().int().min(1000).max(1000000).optional().default(120000),
    'Max characters per run',
    { 'ui:options': { halfGrid: true } },
  ),
})
export class TtsOptionsDto extends createZodDto(TtsOptionsSchema) {}
export type TtsOptionsConfig = z.infer<typeof TtsOptionsSchema>

// ==================== Comment Upload Options ====================
export const CommentUploadOptionsSchema = section('Comment image uploads', {
  enable: field.toggle(
    z.boolean().optional(),
    'Enable reader comment image uploads',
    {
      description:
        'When disabled, the frontend hides the upload entry and the backend returns 503',
    },
  ),
  pendingTtlMinutes: field.number(
    z.preprocess(
      (val) => (val ? Number(val) : val),
      z.number().int().min(5).optional(),
    ),
    'Pending TTL (minutes)',
    {
      'ui:options': { halfGrid: true },
      description:
        'Retention time for uploaded images not yet referenced by a comment; expired ones are removed. Default 120',
    },
  ),
  detachedTtlMinutes: field.number(
    z.preprocess(
      (val) => (val ? Number(val) : val),
      z.number().int().min(1).optional(),
    ),
    'Detached TTL (minutes)',
    {
      'ui:options': { halfGrid: true },
      description:
        'Retention time for images removed by a comment edit. Default 30',
    },
  ),
  cronIntervalMinutes: field.number(
    z.preprocess(
      (val) => (val ? Number(val) : val),
      z.number().int().min(1).optional(),
    ),
    'Cleanup interval (minutes)',
    { 'ui:options': { halfGrid: true }, description: 'Default 15' },
  ),
  singleFileSizeMB: field.number(
    z.preprocess(
      (val) => (val ? Number(val) : val),
      z.number().int().min(1).max(50).optional(),
    ),
    'Max size per image (MB)',
    { 'ui:options': { halfGrid: true }, description: 'Default 5' },
  ),
  commentImageMaxCount: field.number(
    z.preprocess(
      (val) => (val ? Number(val) : val),
      z.number().int().min(1).max(20).optional(),
    ),
    'Max images per comment',
    { 'ui:options': { halfGrid: true }, description: 'Default 4' },
  ),
  readerHourlyUploadCount: field.number(
    z.preprocess(
      (val) => (val ? Number(val) : val),
      z.number().int().min(1).optional(),
    ),
    'Max uploads per reader per hour',
    { 'ui:options': { halfGrid: true }, description: 'Default 10' },
  ),
  readerTotalActiveBytesMB: field.number(
    z.preprocess(
      (val) => (val ? Number(val) : val),
      z.number().int().min(1).optional(),
    ),
    'Max total active image storage per reader (MB)',
    { 'ui:options': { halfGrid: true }, description: 'Default 50' },
  ),
  readerMinAccountAgeHours: field.number(
    z.preprocess(
      (val) => (val ? Number(val) : val),
      z.number().int().min(0).optional(),
    ),
    'Minimum reader account age (hours)',
    {
      'ui:options': { halfGrid: true },
      description: 'Eligibility threshold; 0 means no limit. Default 0',
    },
  ),
  readerMinCommentCount: field.number(
    z.preprocess(
      (val) => (val ? Number(val) : val),
      z.number().int().min(0).optional(),
    ),
    'Minimum comments posted by reader',
    {
      'ui:options': { halfGrid: true },
      description: 'Eligibility threshold; 0 means no limit. Default 0',
    },
  ),
  deleteFilesOnSpam: field.toggle(
    z.boolean().optional(),
    'Delete images when comment is marked as spam',
    {
      description:
        'Enabled by default. When disabled, only the comment is removed and images are kept for manual review',
    },
  ),
  mimeWhitelist: field.array(z.array(z.string()).optional(), 'MIME whitelist', {
    description:
      'Defaults to image/jpeg, image/png, image/webp, image/gif. Changes take effect immediately',
  }),
})
export class CommentUploadOptionsDto extends createZodDto(
  CommentUploadOptionsSchema,
) {}
export type CommentUploadOptionsConfig = z.infer<
  typeof CommentUploadOptionsSchema
>

// ==================== File Upload Options ====================
export const FileUploadOptionsSchema = section('File upload settings', {
  enableCustomNaming: field.toggle(
    z.boolean().optional(),
    'Enable custom file naming',
    {
      description: 'When enabled, the naming templates below are applied',
    },
  ),
  filenameTemplate: field.plain(z.string().optional(), 'Filename template', {
    description:
      'Supported placeholders: {Y} 4-digit year, {y} 2-digit year, {m} month, {d} day, {h} hour, {i} minute, {s} second, {ms} milliseconds, {timestamp} timestamp, {md5} random MD5, {md5-16} random MD5 (16 chars), {uuid} UUID, {str-<n>} random string of length n, {filename} original filename (with extension), {name} original filename (without extension), {ext} extension',
  }),
  pathTemplate: field.plain(z.string().optional(), 'File path template', {
    description:
      'Same placeholders as the filename template, plus {type} for file type and {localFolder:<n>} for the n-th original folder level',
  }),
  videoMaxSize: field.number(
    z.preprocess(
      (val) => (val ? Number(val) : val),
      z.number().int().min(1).optional(),
    ),
    'Max video upload size on local storage (MB)',
    {
      'ui:options': { halfGrid: true },
      description:
        'Default 100. Applies to local-disk storage only; S3 storage uploads are unlimited',
    },
  ),
})
export class FileUploadOptionsDto extends createZodDto(
  FileUploadOptionsSchema,
) {}
export type FileUploadOptionsConfig = z.infer<typeof FileUploadOptionsSchema>

// ==================== Baidu Search Options ====================
export const BaiduSearchOptionsSchema = section('Baidu push settings', {
  enable: field.toggle(z.boolean().optional(), 'Enable push'),
  token: field.password(z.string().min(1).optional(), 'Token'),
})
export class BaiduSearchOptionsDto extends createZodDto(
  BaiduSearchOptionsSchema,
) {}
export type BaiduSearchOptionsConfig = z.infer<typeof BaiduSearchOptionsSchema>

// ==================== Bing Search Options ====================
export const BingSearchOptionsSchema = section('Bing push settings', {
  enable: field.toggle(z.boolean().optional(), 'Enable push'),
  token: field.password(z.string().optional(), 'Bing API key'),
})
export class BingSearchOptionsDto extends createZodDto(
  BingSearchOptionsSchema,
) {}
export type BingSearchOptionsConfig = z.infer<typeof BingSearchOptionsSchema>

// ==================== Admin Extra ====================
export const AdminExtraSchema = section('Admin extras', {
  enableAdminProxy: field.toggle(
    z.boolean().optional(),
    'Enable admin reverse proxy',
    {
      description:
        'Whether the admin dashboard can be accessed through the API',
    },
  ),
  background: field.plain(z.string().optional(), 'Login page background'),
  gaodemapKey: field.password(z.string().optional(), 'Amap query API key', {
    description: 'Location lookup for diary entries',
  }),
})
export class AdminExtraDto extends createZodDto(AdminExtraSchema) {}
export type AdminExtraConfig = z.infer<typeof AdminExtraSchema>

// ==================== Friend Link Options ====================
export const FriendLinkOptionsSchema = section('Friend link settings', {
  allowApply: field.toggle(
    z.boolean().optional(),
    'Allow friend link applications',
  ),
  allowSubPath: field.toggle(
    z.boolean().optional(),
    'Allow sub-path friend links',
    {
      description: 'For example, a /blog sub-path',
    },
  ),
  enableAvatarInternalization: field.toggle(
    z.boolean().optional(),
    'Internalize friend link avatars',
    {
      description:
        'After approval, the friend link avatar is downloaded and converted to an internal link. Only common image formats are supported; other formats are not converted',
    },
  ),
})
export class FriendLinkOptionsDto extends createZodDto(
  FriendLinkOptionsSchema,
) {}
export type FriendLinkOptionsConfig = z.infer<typeof FriendLinkOptionsSchema>

// ==================== Bark Options ====================
export const BarkOptionsSchema = section('Bark notifications', {
  enable: field.toggle(z.boolean().optional(), 'Enable Bark notifications'),
  key: field.password(z.string().optional(), 'Device key'),
  serverUrl: field.plain(z.string().url().optional(), 'Server URL', {
    description: 'Defaults to the public server, https://day.app, when empty',
  }),
  enableComment: field.toggle(
    z.boolean().optional(),
    'Enable comment notifications',
  ),
  enableThrottleGuard: field.toggle(
    z.boolean().optional(),
    'Notify on rate-limited requests',
    {
      description:
        'Sends a notification when requests are rate-limited; can serve as an early warning for attacks',
    },
  ),
})
export class BarkOptionsDto extends createZodDto(BarkOptionsSchema) {}
export type BarkOptionsConfig = z.infer<typeof BarkOptionsSchema>

// ==================== Feature List ====================
export const FeatureListSchema = section('Feature toggles', {
  emailSubscribe: field.toggle(
    z.boolean().optional(),
    'Enable email subscription',
  ),
})
export class FeatureListDto extends createZodDto(FeatureListSchema) {}
export type FeatureListConfig = z.infer<typeof FeatureListSchema>

// ==================== Third Party Service Integration ====================

const GitHubIntegrationSchema = section('GitHub', {
  enabled: field.toggle(z.boolean().optional().default(true), 'Enabled'),
  token: field.password(z.string().optional(), 'Personal Access Token', {
    description:
      'Used when calling the GitHub API; fill in when you hit rate limits',
  }),
})

const TmdbIntegrationSchema = section('TMDB', {
  enabled: field.toggle(z.boolean().optional().default(false), 'Enabled'),
  apiKey: field.password(z.string().optional(), 'API Key'),
})

const BangumiIntegrationSchema = section('Bangumi', {
  enabled: field.toggle(z.boolean().optional().default(true), 'Enabled'),
  accessToken: field.password(z.string().optional(), 'Access Token'),
})

const NeoDBIntegrationSchema = section('NeoDB', {
  enabled: field.toggle(z.boolean().optional().default(true), 'Enabled'),
})

const ArxivIntegrationSchema = section('Arxiv', {
  enabled: field.toggle(z.boolean().optional().default(true), 'Enabled'),
})

const TwelveDataIntegrationSchema = section('Twelve Data', {
  enabled: field.toggle(z.boolean().optional().default(false), 'Enabled'),
  apiKey: field.password(z.string().optional(), 'API Key', {
    description: 'Stock quote data source, https://twelvedata.com',
  }),
})

const PolygonIntegrationSchema = section('Polygon.io', {
  enabled: field.toggle(z.boolean().optional().default(false), 'Enabled'),
  apiKey: field.password(z.string().optional(), 'API Key', {
    description: 'Stock bars data source, https://polygon.io',
  }),
})

const LeetcodeIntegrationSchema = section('Leetcode', {
  enabled: field.toggle(z.boolean().optional().default(true), 'Enabled'),
})

const NeteaseMusicIntegrationSchema = section('NetEase Cloud Music', {
  enabled: field.toggle(z.boolean().optional().default(true), 'Enabled'),
})

const QQMusicIntegrationSchema = section('QQ Music', {
  enabled: field.toggle(z.boolean().optional().default(true), 'Enabled'),
})

const OpenGraphIntegrationSchema = section('Open Graph / oEmbed fallback', {
  enabled: field.toggle(z.boolean().optional().default(true), 'Enabled', {
    description:
      'Fetches Open Graph / oEmbed metadata as a link card fallback for URLs not handled by a dedicated provider',
  }),
  fetchMode: field.select(
    z.enum(['fetch', 'browser']).optional().default('fetch'),
    'Fetch mode',
    [
      { label: 'HTTP fetch', value: 'fetch' },
      { label: 'Headless browser (agent-browser)', value: 'browser' },
    ],
    {
      description:
        'Defaults to HTTP fetch. For Cloudflare-protected or anti-bot sites, switch to browser mode to render via the chromium bundled in Docker. Browser mode is slower and more expensive.',
    },
  ),
  timeoutMs: field.number(
    z.preprocess(
      (val) =>
        val === '' || val === null || val === undefined ? val : Number(val),
      z.number().int().min(1000).max(60000).optional(),
    ),
    'Fetch timeout (milliseconds)',
    {
      description:
        'Defaults to 8000 in fetch mode and 25000 in browser mode. Range 1000-60000',
    },
  ),
  maxBodyBytes: field.number(
    z.preprocess(
      (val) =>
        val === '' || val === null || val === undefined ? val : Number(val),
      z.number().int().min(16384).max(4_194_304).optional(),
    ),
    'Max response size (bytes)',
    {
      description:
        'Defaults to 524288 (512KB); range 16KB-4MB; only the <head> is scanned',
    },
  ),
  screenshot: section('Screenshot', {
    enabled: field.toggle(
      z.boolean().optional().default(false),
      'Enable screenshots',
      {
        description:
          'Capture page screenshots when fetchMode is browser. Only effective in browser mode.',
      },
    ),
    maxItems: field.number(
      z.preprocess(
        (val) =>
          val === '' || val === null || val === undefined ? val : Number(val),
        z.number().int().min(10).max(10_000).optional().default(500),
      ),
      'Max cached items',
      { description: 'Default 500; range 10-10000' },
    ),
    maxTotalBytes: field.number(
      z.preprocess(
        (val) =>
          val === '' || val === null || val === undefined ? val : Number(val),
        z
          .number()
          .int()
          .min(1024 * 1024)
          .optional()
          .default(100 * 1024 * 1024),
      ),
      'Max total storage (bytes)',
      { description: 'Default 104857600 (100MB); minimum 1MB' },
    ),
    maxBytesPerImage: field.number(
      z.preprocess(
        (val) =>
          val === '' || val === null || val === undefined ? val : Number(val),
        z
          .number()
          .int()
          .min(1024)
          .optional()
          .default(512 * 1024),
      ),
      'Max size per image (bytes)',
      { description: 'Default 524288 (512KB); minimum 1KB' },
    ),
    webpQuality: field.number(
      z.preprocess(
        (val) =>
          val === '' || val === null || val === undefined ? val : Number(val),
        z.number().int().min(40).max(100).optional().default(75),
      ),
      'WebP quality',
      { description: 'Default 75; range 40-100' },
    ),
  }).optional(),
})

export const ThirdPartyServiceIntegrationSchema = section(
  'Third-party integrations',
  {
    github: GitHubIntegrationSchema.optional(),
    tmdb: TmdbIntegrationSchema.optional(),
    bangumi: BangumiIntegrationSchema.optional(),
    neodb: NeoDBIntegrationSchema.optional(),
    arxiv: ArxivIntegrationSchema.optional(),
    leetcode: LeetcodeIntegrationSchema.optional(),
    neteaseMusic: NeteaseMusicIntegrationSchema.optional(),
    qqMusic: QQMusicIntegrationSchema.optional(),
    openGraph: OpenGraphIntegrationSchema.optional(),
    twelveData: TwelveDataIntegrationSchema.optional(),
    polygon: PolygonIntegrationSchema.optional(),
  },
)
export class ThirdPartyServiceIntegrationDto extends createZodDto(
  ThirdPartyServiceIntegrationSchema,
) {}
export type ThirdPartyServiceIntegrationConfig = z.infer<
  typeof ThirdPartyServiceIntegrationSchema
>

// ==================== Auth Security ====================
export const AuthSecuritySchema = section(
  'Auth security',
  {
    disablePasswordLogin: field.toggle(
      z.boolean().optional(),
      'Disable password login',
      {
        description:
          'Disables password login, allowing sign-in only via Passkey or OAuth. Do not enable unless those methods are configured.',
      },
    ),
  },
  { 'ui:options': { type: 'hidden' } },
)
export class AuthSecurityDto extends createZodDto(AuthSecuritySchema) {}
export type AuthSecurityConfig = z.infer<typeof AuthSecuritySchema>

// ==================== AI Provider Config ====================
const AIProviderCapabilitiesSchema = z.object({
  text: z.boolean().optional().default(true),
  image: z.boolean().optional().default(false),
  speech: z.boolean().optional().default(false),
})

const AIProviderConfigSchema = withMeta(
  z.object({
    id: field.plain(z.string().min(1), 'Provider ID', {
      description: 'Unique identifier, e.g. "openai-main", "deepseek"',
    }),
    name: field.plain(z.string().min(1), 'Display name'),
    type: field.plain(z.enum(AIProviderType), 'Provider type', {
      description: 'openai | openai-compatible | anthropic | openrouter',
    }),
    apiKey: field.password(z.string().min(1), 'API Key'),
    endpoint: field.plain(z.string().optional(), 'Custom endpoint', {
      description:
        'Required for OpenAI-compatible services, e.g. https://api.deepseek.com',
    }),
    projectId: field.plain(z.string().optional(), 'Google Cloud project ID', {
      description: 'Required when the provider type is google-vertex',
    }),
    modelListUrl: field.plain(z.string().optional(), 'Model list URL', {
      description:
        'Full URL to fetch the model list from (OpenAI format); leave empty to use the built-in registry',
    }),
    voiceListUrl: field.plain(z.string().optional(), 'Voice list URL', {
      description:
        'Full URL to fetch speech voices from; accepts an array or an object with a data/voices array',
    }),
    appendV1: field.toggle(z.boolean().optional(), 'Append /v1 to base URL', {
      description:
        'Append /v1 to the endpoint when missing; defaults to enabled',
    }),
    defaultModel: field.plain(
      z.string().optional().default(''),
      'Default model',
      {
        description: 'E.g. gpt-4o, deepseek-chat, claude-sonnet-4-20250514',
      },
    ),
    enabled: field.toggle(z.boolean(), 'Enabled'),
    contextWindow: field.plain(
      z.number().int().positive().nullish(),
      'Context window (tokens)',
    ),
    maxTokens: field.plain(
      z.number().int().positive().nullish(),
      'Max output tokens',
    ),
    capabilities: field.plain(
      AIProviderCapabilitiesSchema.optional().default({
        text: true,
        image: false,
        speech: false,
      }),
      'Provider capabilities',
      {
        description:
          'Declares which runtime capabilities may reuse this provider connection',
      },
    ),
  }),
  { title: 'AI provider configuration', 'ui:options': { type: 'hidden' } },
)

const AIModelAssignmentSchema = withMeta(
  z.object({
    providerId: field.plain(z.string().optional(), 'Provider ID', {
      description: 'References the id of a provider in `providers`',
    }),
    model: field.plain(z.string().optional(), 'Model override', {
      description:
        "Overrides the provider's default model; leave empty to use the provider default",
    }),
    reasoningEffort: field.plain(
      z.enum(['none', 'low', 'medium', 'high']).optional(),
      'Thinking / reasoning effort',
      {
        description:
          'Controls extended thinking for models that support it; default none',
      },
    ),
  }),
  { title: 'AI model assignment', 'ui:options': { type: 'hidden' } },
)

const AIImageGenerationFeatureSchema = withMeta(
  z.object({
    enable: z.boolean().optional().default(false),
    model: AIModelAssignmentSchema.nullish(),
    defaultAspectRatio: z.string().optional().default('16:9'),
    defaultQuality: z
      .enum(['low', 'standard', 'high'])
      .optional()
      .default('standard'),
    defaultFormat: z.enum(['png', 'jpeg', 'webp']).optional().default('png'),
  }),
  { title: 'AI image generation feature', 'ui:options': { type: 'hidden' } },
)

const AITtsFeatureSchema = withMeta(
  z.object({
    enable: z.boolean().optional().default(false),
    model: AIModelAssignmentSchema.nullish(),
    voice: nullableStorageText(),
    speed: z.coerce.number().min(0.25).max(4).optional().default(1),
    maxCharsPerChunk: z.coerce
      .number()
      .int()
      .min(200)
      .max(4000)
      .optional()
      .default(1800),
    concurrency: z.coerce.number().int().min(1).max(8).optional().default(3),
    maxCharsPerRun: z.coerce
      .number()
      .int()
      .min(1000)
      .max(1000000)
      .optional()
      .default(120000),
  }),
  { title: 'AI text to speech feature', 'ui:options': { type: 'hidden' } },
)

export const AISchema = section('AI settings', {
  version: z.literal(2).optional().default(2),
  providers: field.array(
    z.array(AIProviderConfigSchema).optional(),
    'AI providers',
    { description: 'Configure multiple AI service providers' },
  ),
  summaryModel: field.plain(AIModelAssignmentSchema.nullish(), 'Summary model'),
  writerModel: field.plain(
    AIModelAssignmentSchema.nullish(),
    'Writing assistant model',
  ),
  commentReviewModel: field.plain(
    AIModelAssignmentSchema.nullish(),
    'Comment review model',
  ),
  enableSummary: field.toggle(z.boolean().optional(), 'Allow AI summary', {
    description: 'Whether to allow calling AI to generate summaries',
  }),
  enableAutoGenerateSummaryOnCreate: field.toggle(
    z.boolean().optional(),
    'Auto-generate summary on article creation',
    { description: 'Requires enableSummary to also be enabled' },
  ),
  enableAutoGenerateSummaryOnUpdate: field.toggle(
    z.boolean().optional(),
    'Regenerate summary on article update',
    {
      description:
        'Regenerates only for languages whose source-text hash has changed; requires enableSummary to also be enabled',
    },
  ),
  summaryTargetLanguages: field.array(
    z.array(z.string()).optional(),
    'AI summary target languages',
    {
      description:
        'Target languages for auto-generated summaries, using [ISO 639-1 language codes](https://www.w3schools.com/tags/ref_language_codes.asp), e.g. ["zh", "en", "ja"]',
    },
  ),
  summaryMinTextLength: field.number(
    z.preprocess(
      (val) =>
        val === '' || val === null || val === undefined ? val : Number(val),
      z.number().int().min(0).optional(),
    ),
    'Minimum text length for summary auto-generation',
    {
      description:
        'Skips automatic hooks (OnCreate/OnUpdate) when the body has fewer characters than this; only affects automatic triggers. 0 means no limit. Default 100',
    },
  ),
  translationModel: field.plain(
    AIModelAssignmentSchema.nullish(),
    'Translation model',
  ),
  enableTranslation: field.toggle(
    z.boolean().optional(),
    'Allow AI translation',
    {
      description: 'Whether to allow calling AI to generate translations',
    },
  ),
  translationStyleHints: field.plain(
    z.string().optional(),
    'Translation style hints',
    {
      description:
        'Freeform guidance injected into translation prompts, e.g. DOCUMENT_TYPE / AUDIENCE / REGISTER lines. Leave empty to disable.',
      'ui:options': { type: 'textarea' },
    },
  ),
  enableAutoGenerateTranslation: field.toggle(
    z.boolean().optional(),
    'Auto-generate AI translations',
    {
      description:
        'When enabled, translations are auto-generated after an article is published. Requires the option above to also be enabled, otherwise has no effect.',
    },
  ),
  translationTargetLanguages: field.array(
    z.array(z.string()).optional(),
    'AI translation target languages',
    {
      description:
        'Target languages for auto-generated translations, using [ISO 639-1 language codes](https://www.w3schools.com/tags/ref_language_codes.asp), e.g. ["en", "ja", "ko"]',
    },
  ),
  translationLangConcurrency: field.number(
    z.preprocess(
      (val) =>
        val === '' || val === null || val === undefined ? val : Number(val),
      z.number().int().min(1).max(10).optional(),
    ),
    'Per-task translation language concurrency',
    {
      description:
        'Parallel languages per Translation task. Default 3, range 1-10.',
    },
  ),
  enableTranslationReview: field.toggle(
    z.boolean().optional(),
    'Enable translation review',
    {
      description:
        'When enabled, translations go through an agent review loop: the model may request_review and apply issue-driven revisions.',
    },
  ),
  translationReviewModel: field.plain(
    AIModelAssignmentSchema.nullish(),
    'Translation reviewer model',
    {
      description:
        'AI model used by the translation reviewer (critique-only). Falls back to the translation model when empty.',
    },
  ),
  insightsModel: field.plain(
    AIModelAssignmentSchema.nullish(),
    'Insights model',
    {
      description: 'AI model used to generate Insights',
    },
  ),
  insightsTranslationModel: field.plain(
    AIModelAssignmentSchema.nullish(),
    'Insights translation model',
    {
      description:
        'AI model used to translate Insights; falls back to the translation model when empty',
    },
  ),
  enableInsights: field.toggle(z.boolean().optional(), 'Allow AI Insights', {
    description: 'Master switch',
  }),
  enableAutoGenerateInsightsOnCreate: field.toggle(
    z.boolean().optional(),
    'Auto-generate Insights on article creation',
    { description: 'Requires enableInsights to also be enabled' },
  ),
  enableAutoGenerateInsightsOnUpdate: field.toggle(
    z.boolean().optional(),
    'Regenerate Insights on article update',
    { description: 'Triggers only when the source-text hash changes' },
  ),
  enableAutoTranslateInsights: field.toggle(
    z.boolean().optional(),
    'Auto-translate Insights after generation',
    {
      description:
        'Dispatches translation tasks based on insightsTargetLanguages',
    },
  ),
  insightsTargetLanguages: field.array(
    z.array(z.string()).optional(),
    'Insights target languages',
    {
      description:
        'ISO 639-1 list; the source language is automatically excluded',
    },
  ),
  insightsMinTextLength: field.number(
    z.preprocess(
      (val) =>
        val === '' || val === null || val === undefined ? val : Number(val),
      z.number().int().min(0).optional(),
    ),
    'Minimum text length for Insights auto-generation',
    {
      description:
        'Skips automatic hooks (OnCreate/OnUpdate) when the body has fewer characters than this; only affects automatic triggers. 0 means no limit. Default 300',
    },
  ),
  imageGeneration: AIImageGenerationFeatureSchema.optional(),
  tts: AITtsFeatureSchema.optional(),
})
export class AIDto extends createZodDto(AISchema) {}
export type AIConfig = z.infer<typeof AISchema>

// ==================== Membership ====================
export const MembershipSchema = section('Membership', {
  enabled: field.toggle(z.boolean().optional(), 'Enable paid membership'),
  provider: field.select(
    z.enum(['dodo', 'creem', 'lemonsqueezy', 'stripe']).optional(),
    'Payment provider',
    [
      { label: 'Dodo Payments', value: 'dodo' },
      { label: 'Creem', value: 'creem' },
      { label: 'Lemon Squeezy', value: 'lemonsqueezy' },
      { label: 'Stripe', value: 'stripe' },
    ],
  ),
  monthlyProductId: field.halfGrid(
    z.string().optional(),
    'Monthly plan product ID',
  ),
  yearlyProductId: field.halfGrid(
    z.string().optional(),
    'Yearly plan product ID',
  ),
  apiKey: field.password(z.string().optional(), 'API key'),
  webhookSigningKey: field.password(
    z.string().optional(),
    'Webhook signing key',
  ),
  environment: field.select(
    z.enum(['test_mode', 'live_mode']).optional(),
    'Environment',
    [
      { label: 'Live mode', value: 'live_mode' },
      { label: 'Test mode', value: 'test_mode' },
    ],
  ),
  appleBundleId: field.halfGrid(z.string().optional(), 'Apple bundle ID'),
  appleKeyId: field.halfGrid(z.string().optional(), 'Apple key ID'),
  appleIssuerId: field.plain(z.string().optional(), 'Apple issuer ID'),
  applePrivateKey: field.password(
    z.string().optional(),
    'Apple .p8 private key',
  ),
  appleMonthlyProductId: field.halfGrid(
    z.string().optional(),
    'Apple monthly product ID',
  ),
  appleYearlyProductId: field.halfGrid(
    z.string().optional(),
    'Apple yearly product ID',
  ),
  appleAppAppleId: field.plain(z.string().optional(), 'Apple app Apple ID'),
})
export class MembershipDto extends createZodDto(MembershipSchema) {}
export type MembershipConfig = z.infer<typeof MembershipSchema>

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
  mailOptions: MailOptionsSchema,
  commentOptions: CommentOptionsSchema,
  barkOptions: BarkOptionsSchema,
  friendLinkOptions: FriendLinkOptionsSchema,
  backupOptions: BackupOptionsSchema,
  imageStorageOptions: ImageStorageOptionsSchema,
  imageGenerationOptions: ImageGenerationOptionsSchema,
  ttsOptions: TtsOptionsSchema,
  fileUploadOptions: FileUploadOptionsSchema,
  commentUploadOptions: CommentUploadOptionsSchema,
  baiduSearchOptions: BaiduSearchOptionsSchema,
  bingSearchOptions: BingSearchOptionsSchema,
  featureList: FeatureListSchema,
  thirdPartyServiceIntegration: ThirdPartyServiceIntegrationSchema,
  authSecurity: AuthSecuritySchema,
  ai: AISchema,
  oauth: OAuthSchema,
  membership: MembershipSchema,
} as const

export type ConfigSchemaMapping = typeof configSchemaMapping
export type ConfigKeys = keyof ConfigSchemaMapping

// ==================== Full Config Schema ====================
export const FullConfigSchema = withMeta(z.object(configSchemaMapping), {
  title: 'Settings',
  description:
    '* Sensitive fields are hidden; the backend does not return them by default, so they appear empty',
})

export type FullConfig = z.infer<typeof FullConfigSchema>
