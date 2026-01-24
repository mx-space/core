import { Injectable } from '@nestjs/common'
import type { OnModuleInit } from '@nestjs/common'
import type { ReturnModelType } from '@typegoose/typegoose'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { InjectModel } from '~/transformers/model.transformer'
import {
  MetaFieldType,
  MetaPresetModel,
  MetaPresetScope,
} from './meta-preset.model'
import type {
  CreateMetaPresetDto,
  UpdateMetaPresetDto,
} from './meta-preset.schema'

/**
 * 内置预设字段种子数据
 */
const BUILTIN_PRESETS: Partial<MetaPresetModel>[] = [
  {
    key: 'aiGen',
    label: 'AI 参与声明',
    type: MetaFieldType.Checkbox,
    scope: MetaPresetScope.Both,
    description: '声明 AI 在创作过程中的参与程度',
    allowCustomOption: true,
    options: [
      { value: -1, label: '无 AI (手作)', exclusive: true },
      { value: 0, label: '辅助写作' },
      { value: 1, label: '润色' },
      { value: 2, label: '完全 AI 生成', exclusive: true },
      { value: 3, label: '故事整理' },
      { value: 4, label: '标题生成' },
      { value: 5, label: '校对' },
      { value: 6, label: '灵感提供' },
      { value: 7, label: '改写' },
      { value: 8, label: 'AI 作图' },
      { value: 9, label: '口述' },
    ],
    isBuiltin: true,
    order: 0,
    enabled: true,
  },
  {
    key: 'cover',
    label: '封面图',
    type: MetaFieldType.Url,
    scope: MetaPresetScope.Both,
    placeholder: 'https://...',
    isBuiltin: true,
    order: 1,
    enabled: true,
  },
  {
    key: 'banner',
    label: '横幅信息',
    type: MetaFieldType.Object,
    scope: MetaPresetScope.Both,
    description: '在文章顶部显示的提示横幅',
    children: [
      {
        key: 'type',
        label: '类型',
        type: MetaFieldType.Select,
        options: [
          { value: 'info', label: '信息' },
          { value: 'warning', label: '警告' },
          { value: 'error', label: '错误' },
          { value: 'success', label: '成功' },
          { value: 'secondary', label: '次要' },
        ],
      },
      {
        key: 'message',
        label: '消息内容',
        type: MetaFieldType.Textarea,
      },
      {
        key: 'className',
        label: '自定义类名',
        type: MetaFieldType.Text,
        placeholder: '可选的 CSS 类名',
      },
    ],
    isBuiltin: true,
    order: 2,
    enabled: true,
  },
  {
    key: 'keywords',
    label: 'SEO 关键词',
    type: MetaFieldType.Tags,
    scope: MetaPresetScope.Both,
    placeholder: '输入关键词后按回车',
    isBuiltin: true,
    order: 3,
    enabled: true,
  },
  {
    key: 'style',
    label: '文章样式',
    type: MetaFieldType.Text,
    scope: MetaPresetScope.Both,
    placeholder: '输入样式名称',
    isBuiltin: true,
    order: 4,
    enabled: true,
  },
]

@Injectable()
export class MetaPresetService implements OnModuleInit {
  constructor(
    @InjectModel(MetaPresetModel)
    private readonly metaPresetModel: ReturnModelType<typeof MetaPresetModel>,
  ) {}

  get model() {
    return this.metaPresetModel
  }

  /**
   * 模块初始化时初始化内置预设
   */
  async onModuleInit() {
    await this.initBuiltinPresets()
  }

  /**
   * 初始化内置预设字段
   */
  private async initBuiltinPresets() {
    for (const preset of BUILTIN_PRESETS) {
      const exists = await this.metaPresetModel.findOne({
        key: preset.key,
        isBuiltin: true,
      })

      if (!exists) {
        await this.metaPresetModel.create(preset)
      } else {
        // 更新内置预设的 options 和 children（保持最新）
        await this.metaPresetModel.updateOne(
          { key: preset.key, isBuiltin: true },
          {
            $set: {
              options: preset.options,
              children: preset.children,
              label: preset.label,
              description: preset.description,
              placeholder: preset.placeholder,
            },
          },
        )
      }
    }
  }

  /**
   * 获取所有预设字段
   */
  async findAll(scope?: MetaPresetScope, enabledOnly = false) {
    const query: Record<string, any> = {}

    if (scope && scope !== MetaPresetScope.Both) {
      query.$or = [{ scope }, { scope: MetaPresetScope.Both }]
    }

    if (enabledOnly) {
      query.enabled = true
    }

    return this.metaPresetModel.find(query).sort({ order: 1 }).lean()
  }

  /**
   * 根据 ID 获取单个预设字段
   */
  async findById(id: string) {
    return this.metaPresetModel.findById(id).lean()
  }

  /**
   * 根据 key 获取预设字段
   */
  async findByKey(key: string) {
    return this.metaPresetModel.findOne({ key }).lean()
  }

  /**
   * 创建自定义预设字段
   */
  async create(dto: CreateMetaPresetDto) {
    const exists = await this.metaPresetModel.findOne({ key: dto.key })
    if (exists) {
      throw new BizException(ErrorCodeEnum.PresetKeyExists, `key: "${dto.key}"`)
    }

    // 获取最大 order 值
    const maxOrder = await this.metaPresetModel
      .findOne()
      .sort({ order: -1 })
      .select('order')
      .lean()

    const order = dto.order ?? (maxOrder?.order ?? -1) + 1

    return this.metaPresetModel.create({
      ...dto,
      isBuiltin: false,
      order,
    })
  }

  /**
   * 更新预设字段
   */
  async update(id: string, dto: UpdateMetaPresetDto) {
    const preset = await this.metaPresetModel.findById(id)
    if (!preset) {
      throw new BizException(ErrorCodeEnum.PresetNotFound)
    }

    // 内置预设只能修改 enabled 和 order
    if (preset.isBuiltin) {
      const allowedFields = ['enabled', 'order']
      const updateData: Record<string, any> = {}

      for (const field of allowedFields) {
        if (dto[field as keyof UpdateMetaPresetDto] !== undefined) {
          updateData[field] = dto[field as keyof UpdateMetaPresetDto]
        }
      }

      return this.metaPresetModel
        .findByIdAndUpdate(id, { $set: updateData }, { new: true })
        .lean()
    }

    // 检查 key 是否重复
    if (dto.key && dto.key !== preset.key) {
      const exists = await this.metaPresetModel.findOne({ key: dto.key })
      if (exists) {
        throw new BizException(
          ErrorCodeEnum.PresetKeyExists,
          `key: "${dto.key}"`,
        )
      }
    }

    return this.metaPresetModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .lean()
  }

  /**
   * 删除预设字段
   */
  async delete(id: string) {
    const preset = await this.metaPresetModel.findById(id)
    if (!preset) {
      throw new BizException(ErrorCodeEnum.PresetNotFound)
    }

    if (preset.isBuiltin) {
      throw new BizException(ErrorCodeEnum.BuiltinPresetCannotDelete)
    }

    return this.metaPresetModel.findByIdAndDelete(id)
  }

  /**
   * 批量更新排序
   */
  async updateOrder(ids: string[]) {
    const bulkOps = ids.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { order: index } },
      },
    }))

    await this.metaPresetModel.bulkWrite(bulkOps)
    return this.findAll()
  }
}
