import type { z } from 'zod'
import {
  configSchemaMapping,
  type AdminExtraSchema,
  type AISchema,
  type AlgoliaSearchOptionsSchema,
  type AuthSecuritySchema,
  type BackupOptionsSchema,
  type BaiduSearchOptionsSchema,
  type BarkOptionsSchema,
  type BingSearchOptionsSchema,
  type CommentOptionsSchema,
  type FeatureListSchema,
  type FriendLinkOptionsSchema,
  type ImageStorageOptionsSchema,
  type MailOptionsSchema,
  type OAuthSchema,
  type SeoSchema,
  type ThirdPartyServiceIntegrationSchema,
  type UrlSchema,
} from './configs.schema'

/**
 * Config schema mapping for validation and JSON schema generation
 */
export const configDtoMapping = configSchemaMapping

/**
 * Main configuration interface
 * Each property corresponds to a config section with its Zod schema type
 */
export abstract class IConfig {
  url: Required<z.infer<typeof UrlSchema>>
  seo: Required<z.infer<typeof SeoSchema>>
  adminExtra: Required<z.infer<typeof AdminExtraSchema>>
  mailOptions: Required<z.infer<typeof MailOptionsSchema>>
  commentOptions: Required<z.infer<typeof CommentOptionsSchema>>
  barkOptions: Required<z.infer<typeof BarkOptionsSchema>>
  friendLinkOptions: Required<z.infer<typeof FriendLinkOptionsSchema>>
  backupOptions: Required<z.infer<typeof BackupOptionsSchema>>
  imageStorageOptions: Required<z.infer<typeof ImageStorageOptionsSchema>>
  baiduSearchOptions: Required<z.infer<typeof BaiduSearchOptionsSchema>>
  bingSearchOptions: Required<z.infer<typeof BingSearchOptionsSchema>>
  algoliaSearchOptions: Required<z.infer<typeof AlgoliaSearchOptionsSchema>>
  featureList: Required<z.infer<typeof FeatureListSchema>>
  thirdPartyServiceIntegration: Required<
    z.infer<typeof ThirdPartyServiceIntegrationSchema>
  >
  authSecurity: z.infer<typeof AuthSecuritySchema>
  ai: z.infer<typeof AISchema>
  oauth: z.infer<typeof OAuthSchema>
}

export type IConfigKeys = keyof IConfig
