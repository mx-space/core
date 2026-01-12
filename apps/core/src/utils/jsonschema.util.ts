import {
  configSchemaMapping,
  FullConfigSchema,
} from '~/modules/configs/configs.schema'
import { zodToJsonSchemaWithMeta } from '~/modules/configs/configs.zod-schema.util'

/**
 * Map config key to Dto class name (matching original class-validator structure)
 */
const configKeyToDtoName: Record<string, string> = {
  url: 'UrlDto',
  seo: 'SeoDto',
  adminExtra: 'AdminExtraDto',
  textOptions: 'TextOptionsDto',
  mailOptions: 'MailOptionsDto',
  commentOptions: 'CommentOptionsDto',
  barkOptions: 'BarkOptionsDto',
  friendLinkOptions: 'FriendLinkOptionsDto',
  backupOptions: 'BackupOptionsDto',
  baiduSearchOptions: 'BaiduSearchOptionsDto',
  bingSearchOptions: 'BingSearchOptionsDto',
  algoliaSearchOptions: 'AlgoliaSearchOptionsDto',
  featureList: 'FeatureListDto',
  thirdPartyServiceIntegration: 'ThirdPartyServiceIntegrationDto',
  authSecurity: 'AuthSecurityDto',
  ai: 'AIDto',
  oauth: 'OAuthDto',
}

/**
 * Build json-schema from Zod schema with UI metadata for IConfig.
 *
 * This function generates JSON schema from Zod schemas defined in configs.schema.ts,
 * including custom UI metadata for form rendering.
 *
 * The output structure uses $ref references to definitions, matching the original
 * class-validator/class-transformer format:
 * {
 *   properties: { url: { "$ref": "#/definitions/UrlDto" } },
 *   definitions: { UrlDto: { ... } }
 * }
 */
export function classToJsonSchema(_clz: any) {
  const definitions: Record<string, any> = {}

  // Generate schema for each config section with Dto-suffixed names
  for (const [key, schema] of Object.entries(configSchemaMapping)) {
    const dtoName = configKeyToDtoName[key] || `${key}Dto`
    definitions[dtoName] = zodToJsonSchemaWithMeta(schema)
  }

  // Generate the full schema first to get title/description
  const fullSchema = zodToJsonSchemaWithMeta(FullConfigSchema)

  // Build properties using $ref references instead of inline schemas
  const properties: Record<string, any> = {}
  for (const key of Object.keys(configSchemaMapping)) {
    const dtoName = configKeyToDtoName[key] || `${key}Dto`
    properties[key] = { $ref: `#/definitions/${dtoName}` }
  }

  return {
    type: 'object',
    title: fullSchema.title,
    description: fullSchema.description,
    properties,
    definitions,
  }
}
