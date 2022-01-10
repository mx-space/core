import { BadRequestException, Injectable } from '@nestjs/common'
import { load } from 'js-yaml'
import { InjectModel } from 'nestjs-typegoose'
import { SnippetModel, SnippetType } from './snippet.model'
@Injectable()
export class SnippetService {
  constructor(
    @InjectModel(SnippetModel)
    private readonly snippetModel: MongooseModel<SnippetModel>,
  ) {}

  get model() {
    return this.snippetModel
  }

  async create(model: SnippetModel) {
    const isExist = await this.model.countDocuments({
      name: model.name,
      reference: model.reference || 'root',
    })

    if (isExist) {
      throw new BadRequestException('snippet is exist')
    }
    // 验证正确类型
    await this.validateType(model)
    return await this.model.create({ ...model, created: new Date() })
  }

  async update(id: string, model: SnippetModel) {
    await this.validateType(model)
    delete model.created

    await this.model.updateOne(
      {
        _id: id,
      },
      { ...model },
    )
  }

  async delete(id: string) {
    await this.model.deleteOne({ _id: id })
  }

  private async validateType(model: SnippetModel) {
    switch (model.type) {
      case SnippetType.JSON: {
        try {
          JSON.parse(model.raw)
        } catch {
          throw new BadRequestException('content is not valid json')
        }
        break
      }
      case SnippetType.YAML: {
        try {
          load(model.raw)
        } catch {
          throw new BadRequestException('content is not valid yaml')
        }
        break
      }
      case SnippetType.Function:
        // TODO
        throw new BadRequestException(
          'Serverless functions are not currently supported',
        )

      case SnippetType.Text:
      default: {
        break
      }
    }
  }

  async getSnippetById(id: string) {
    const doc = await this.model.findById(id).lean()
    return this.attachSnippet(doc)
  }

  /**
   *
   * @param name
   * @param reference 引用类型, 可以理解为 type
   * @returns
   */
  async getSnippetByName(name: string, reference: string) {
    const doc = await this.model.findOne({ name, reference }).lean()
    return this.attachSnippet(doc)
  }

  async attachSnippet(model: SnippetModel) {
    switch (model.type) {
      case SnippetType.JSON: {
        Reflect.set(model, 'data', JSON.parse(model.raw))
        break
      }
      case SnippetType.YAML: {
        Reflect.set(model, 'data', load(model.raw))
        break
      }
      case SnippetType.Text: {
        Reflect.set(model, 'data', model.raw)
        break
      }
    }

    return model as SnippetModel & { data: any }
  }

  // TODO serverless function
  // async runSnippet(model: SnippetModel) {}
}
