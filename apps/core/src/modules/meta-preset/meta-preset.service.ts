import type { OnModuleInit } from '@nestjs/common'
import { Injectable } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'

import { MetaFieldType, MetaPresetScope } from './meta-preset.enum'
import { MetaPresetRepository } from './meta-preset.repository'
import type {
  CreateMetaPresetDto,
  UpdateMetaPresetDto,
} from './meta-preset.schema'
import type { MetaPresetModel } from './meta-preset.types'

/**
 * Seed data for built-in preset fields.
 */
const BUILTIN_PRESETS: Partial<MetaPresetModel>[] = [
  {
    key: 'aiGen',
    label: 'AI Involvement Disclosure',
    type: MetaFieldType.Checkbox,
    scope: MetaPresetScope.Both,
    description: 'Declare how much AI was involved during creation',
    allowCustomOption: true,
    options: [
      { value: -1, label: 'No AI (handcrafted)', exclusive: true },
      { value: 0, label: 'Writing assistance' },
      { value: 1, label: 'Polishing' },
      { value: 2, label: 'Fully AI-generated', exclusive: true },
      { value: 3, label: 'Story organization' },
      { value: 4, label: 'Title generation' },
      { value: 5, label: 'Proofreading' },
      { value: 6, label: 'Inspiration source' },
      { value: 7, label: 'Rewriting' },
      { value: 8, label: 'AI-generated imagery' },
      { value: 9, label: 'Dictation' },
    ],
    isBuiltin: true,
    order: 0,
    enabled: true,
  },
  {
    key: 'cover',
    label: 'Cover image',
    type: MetaFieldType.Url,
    scope: MetaPresetScope.Both,
    placeholder: 'https://...',
    isBuiltin: true,
    order: 1,
    enabled: true,
  },
  {
    key: 'banner',
    label: 'Banner',
    type: MetaFieldType.Object,
    scope: MetaPresetScope.Both,
    description: 'Notice banner displayed at the top of an article',
    children: [
      {
        key: 'type',
        label: 'Type',
        type: MetaFieldType.Select,
        options: [
          { value: 'info', label: 'Info' },
          { value: 'warning', label: 'Warning' },
          { value: 'error', label: 'Error' },
          { value: 'success', label: 'Success' },
          { value: 'secondary', label: 'Secondary' },
        ],
      },
      {
        key: 'message',
        label: 'Message',
        type: MetaFieldType.Textarea,
      },
      {
        key: 'className',
        label: 'Custom class name',
        type: MetaFieldType.Text,
        placeholder: 'Optional CSS class name',
      },
    ],
    isBuiltin: true,
    order: 2,
    enabled: true,
  },
  {
    key: 'keywords',
    label: 'SEO keywords',
    type: MetaFieldType.Tags,
    scope: MetaPresetScope.Both,
    placeholder: 'Type a keyword and press Enter',
    isBuiltin: true,
    order: 3,
    enabled: true,
  },
  {
    key: 'style',
    label: 'Article style',
    type: MetaFieldType.Text,
    scope: MetaPresetScope.Both,
    placeholder: 'Enter a style name',
    isBuiltin: true,
    order: 4,
    enabled: true,
  },
]

@Injectable()
export class MetaPresetService implements OnModuleInit {
  constructor(private readonly metaPresetRepository: MetaPresetRepository) {}

  /**
   * Initialize built-in presets when the module starts up.
   */
  async onModuleInit() {
    await this.initBuiltinPresets()
  }

  /**
   * Initialize built-in preset fields.
   */
  private async initBuiltinPresets() {
    for (const preset of BUILTIN_PRESETS) {
      const exists = await this.metaPresetRepository.findByName(preset.key!)

      if (!exists) {
        await this.metaPresetRepository.create(preset)
      } else {
        // Keep options and children for built-in presets in sync with the source.
        await this.metaPresetRepository.update(exists.id, {
          options: preset.options,
          children: preset.children,
          label: preset.label,
          description: preset.description,
          placeholder: preset.placeholder,
          isBuiltin: true,
        })
      }
    }
  }

  /**
   * Get all preset fields.
   */
  async findAll(scope?: MetaPresetScope, enabledOnly = false) {
    const presets = await this.metaPresetRepository.findAll()
    return presets.filter((preset) => {
      if (enabledOnly && !preset.enabled) return false
      if (!scope || scope === MetaPresetScope.Both) return true
      return preset.scope === scope || preset.scope === MetaPresetScope.Both
    })
  }

  /**
   * Get a single preset field by ID.
   */
  async findById(id: string) {
    return this.metaPresetRepository.findById(id)
  }

  /**
   * Get a preset field by key.
   */
  async findByKey(key: string) {
    return this.metaPresetRepository.findByName(key)
  }

  /**
   * Create a custom preset field.
   */
  async create(dto: CreateMetaPresetDto) {
    const exists = await this.metaPresetRepository.findByName(dto.key)
    if (exists) {
      throw createAppException(AppErrorCode.META_PRESET_KEY_EXISTS, {
        key: dto.key,
      })
    }

    // Get the current maximum order value
    const maxOrder = await this.metaPresetRepository.findMaxOrder()

    const order = dto.order ?? maxOrder + 1

    return this.metaPresetRepository.create({
      ...dto,
      isBuiltin: false,
      order,
    })
  }

  /**
   * Update a preset field.
   */
  async update(id: string, dto: UpdateMetaPresetDto) {
    const preset = await this.metaPresetRepository.findById(id)
    if (!preset) {
      throw createAppException(AppErrorCode.META_PRESET_NOT_FOUND, { id })
    }

    // Built-in presets only allow `enabled` and `order` to be modified.
    if (preset.isBuiltin) {
      const updateData: Partial<UpdateMetaPresetDto> = {}
      if (dto.enabled !== undefined) updateData.enabled = dto.enabled
      if (dto.order !== undefined) updateData.order = dto.order
      return this.metaPresetRepository.update(id, updateData)
    }

    // Check whether the key already exists
    if (dto.key && dto.key !== preset.key) {
      const exists = await this.metaPresetRepository.findByName(dto.key)
      if (exists) {
        throw createAppException(AppErrorCode.META_PRESET_KEY_EXISTS, {
          key: dto.key,
        })
      }
    }

    return this.metaPresetRepository.update(id, dto)
  }

  /**
   * Delete a preset field.
   */
  async delete(id: string) {
    const preset = await this.metaPresetRepository.findById(id)
    if (!preset) {
      throw createAppException(AppErrorCode.META_PRESET_NOT_FOUND, { id })
    }

    if (preset.isBuiltin) {
      throw createAppException(AppErrorCode.BUILTIN_PRESET_CANNOT_DELETE)
    }

    return this.metaPresetRepository.deleteById(id)
  }

  /**
   * Batch-update the display order.
   */
  async updateOrder(ids: string[]) {
    await this.metaPresetRepository.updateOrder(ids)
    return this.findAll()
  }
}
