import { Global, Module } from '@nestjs/common'
import { TypegooseModule } from 'nestjs-typegoose'
import { MONGO_DB } from '~/app.config'
import { CategoryModel } from '../../modules/category/category.model'
import { PostModel } from '../../modules/post/post.model'
import { UserModel } from '../../modules/user/user.model'

const models = TypegooseModule.forFeature([UserModel, PostModel, CategoryModel])
@Module({
  imports: [
    TypegooseModule.forRootAsync({
      useFactory: () => ({
        uri: MONGO_DB.uri,
        useCreateIndex: true,
        useFindAndModify: false,
        useNewUrlParser: true,
        useUnifiedTopology: true,
        autoIndex: true,
      }),
    }),
    models,
  ],

  exports: [models],
})
@Global()
export class DbModule {}
