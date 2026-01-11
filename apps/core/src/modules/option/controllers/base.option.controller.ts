import {
  BadRequestException,
  Body,
  Get,
  Param,
  Patch,
  UnprocessableEntityException,
} from '@nestjs/common'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { IConfig } from '~/modules/configs/configs.interface'
import { ConfigsService } from '~/modules/configs/configs.service'
import { classToJsonSchema } from '~/utils/jsonschema.util'
import { instanceToPlain } from 'class-transformer'
import { ConfigKeyDto } from '../dtoes/config.dto'
import { OptionController } from '../option.decorator'

@OptionController()
export class BaseOptionController {
  constructor(private readonly configsService: ConfigsService) {}

  @Get('/')
  getOption() {
    return instanceToPlain(this.configsService.getConfig())
  }

  @HTTPDecorators.Bypass
  @Get('/jsonschema')
  async getJsonSchema() {
    const schema = Object.assign(classToJsonSchema(IConfig), {
      default: this.configsService.defaultConfig,
    })

    const aiConfig = await this.configsService.get('ai')
    this.attachAiProviderOptions(schema, aiConfig)

    return schema
  }

  private attachAiProviderOptions(schema: Record<string, any>, aiConfig: any) {
    if (!schema || !aiConfig) {
      return
    }

    const providers = Array.isArray(aiConfig.providers)
      ? aiConfig.providers
      : []
    const assignments = [
      aiConfig.summaryModel?.providerId,
      aiConfig.writerModel?.providerId,
      aiConfig.commentReviewModel?.providerId,
    ].filter(Boolean) as string[]

    const oneOf: Array<{ const: string; title: string }> = []
    const seen = new Set<string>()

    const pushOption = (id?: string, title?: string) => {
      if (!id || seen.has(id)) {
        return
      }
      seen.add(id)
      oneOf.push({ const: id, title: title || id })
    }

    for (const provider of providers) {
      pushOption(provider?.id, this.formatProviderLabel(provider))
    }

    for (const providerId of assignments) {
      pushOption(providerId, providerId)
    }

    if (!oneOf.length) {
      return
    }

    const definitions = schema.definitions || {}
    const assignmentSchema =
      definitions.AIModelAssignmentDto ||
      Object.values(definitions).find(
        (def: any) => def?.properties?.providerId && def?.properties?.model,
      )

    const providerSchemas: Array<Record<string, any>> = []

    if (assignmentSchema?.properties?.providerId) {
      providerSchemas.push(assignmentSchema.properties.providerId)
    }

    const inlineSchemas = this.findProviderIdSchemas(schema)
    for (const inlineSchema of inlineSchemas) {
      providerSchemas.push(inlineSchema)
    }

    if (!providerSchemas.length) {
      return
    }

    const enumValues = oneOf.map((option) => option.const)
    const enumNames = oneOf.map((option) => option.title)

    for (const providerSchema of providerSchemas) {
      providerSchema.oneOf = oneOf
      providerSchema.enum = enumValues
      providerSchema.enumNames = enumNames
      providerSchema['x-enumNames'] = enumNames
      providerSchema['ui:options'] = {
        ...(providerSchema['ui:options'] || {}),
        type: 'select',
      }
    }
  }

  private formatProviderLabel(provider: any) {
    const name = typeof provider?.name === 'string' ? provider.name.trim() : ''
    const type = typeof provider?.type === 'string' ? provider.type : ''
    const id = typeof provider?.id === 'string' ? provider.id : ''

    const nameLooksLikeUuid =
      !!name &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        name,
      )

    const displayName = !nameLooksLikeUuid && name ? name : ''
    if (displayName && type) {
      return `${displayName} (${type})`
    }
    if (displayName) {
      return displayName
    }
    if (type) {
      return type
    }
    return id || 'Unknown'
  }

  private findProviderIdSchemas(schema: Record<string, any>) {
    const matches: Array<Record<string, any>> = []
    const visited = new Set<any>()

    const visit = (node: any) => {
      if (!node || typeof node !== 'object' || visited.has(node)) {
        return
      }
      visited.add(node)

      if (node.properties?.providerId) {
        const providerSchema = node.properties.providerId
        if (
          providerSchema &&
          providerSchema.title === 'Provider ID' &&
          providerSchema.type === 'string'
        ) {
          matches.push(providerSchema)
        }
      }

      for (const value of Object.values(node)) {
        visit(value)
      }
    }

    visit(schema)
    return matches
  }

  @Get('/:key')
  async getOptionKey(@Param('key') key: keyof IConfig) {
    if (typeof key !== 'string' && !key) {
      throw new UnprocessableEntityException(
        `key must be IConfigKeys, got ${key}`,
      )
    }
    const value = await this.configsService.get(key)
    if (!value) {
      throw new BadRequestException('key is not exists.')
    }
    return { data: instanceToPlain(value) }
  }

  @Patch('/:key')
  patch(@Param() params: ConfigKeyDto, @Body() body: Record<string, any>) {
    if (typeof body !== 'object') {
      throw new UnprocessableEntityException('body must be object')
    }
    return this.configsService.patchAndValid(params.key, body)
  }
}
