import { Injectable } from '@nestjs/common'
import { ReturnModelType } from '@typegoose/typegoose'
import { InjectModel } from 'nestjs-typegoose'
import { UserModel } from './user.model'

@Injectable()
export class UserService {
  constructor(
    @InjectModel(UserModel)
    private userModel: ReturnModelType<typeof UserModel>,
  ) {}
}
