import { BadRequestException, Injectable } from '@nestjs/common'
import { ReturnModelType } from '@typegoose/typegoose'
import { InjectModel } from 'nestjs-typegoose'
import { SnippetModel, SnippetType } from './snippet.model'

@Injectable()
export class SnippetService {
  constructor(
    @InjectModel(SnippetModel)
    private readonly snippetModel: ReturnModelType<typeof SnippetModel>,
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

    await this.model.updateOne(
      {
        _id: id,
      },
      model,
    )
  }

  async delete(id: string) {
    await this.model.deleteOne({ _id: id })
  }

  private async validateType(model: SnippetModel) {
    switch (model.type) {
      case SnippetType.JSON: {
        const isValidJSON = JSON.stringify(model.raw)
        if (!isValidJSON) {
          throw new BadRequestException('content is not valid json')
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

  async getSnippetByName(name: string) {
    const doc = await this.model.findOne({ name }).lean()
    return this.attachSnippet(doc)
  }

  async attachSnippet(model: SnippetModel) {
    switch (model.type) {
      case SnippetType.JSON: {
        Reflect.set(model, 'data', JSON.parse(model.raw))
        break
      }
      case SnippetType.Text: {
        break
      }
    }

    return model
  }

  // TODO serverless function
  // async runSnippet(model: SnippetModel) {}
}
