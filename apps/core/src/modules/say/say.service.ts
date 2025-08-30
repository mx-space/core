import { Injectable } from '@nestjs/common'
import { InjectModel } from '~/transformers/model.transformer'
import { SayModel } from './say.model'

@Injectable()
export class SayService {
  constructor(
    @InjectModel(SayModel) private readonly sayModel: MongooseModel<SayModel>,
  ) {}

  public get model() {
    return this.sayModel
  }
}
