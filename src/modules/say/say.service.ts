import { Injectable } from '@nestjs/common'
import { SayModel } from './say.model'
import { InjectModel } from '~/transformers/model.transformer'

@Injectable()
export class SayService {
  constructor(
    @InjectModel(SayModel) private readonly sayModel: MongooseModel<SayModel>,
  ) {}

  public get model() {
    return this.sayModel
  }
}
