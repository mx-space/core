import { getModelForClass, mongoose } from '@typegoose/typegoose'
import { config } from 'dotenv'
import { ConnectionBase } from 'mongoose'
import * as APP from '../src/app.config'
import { CategoryModel } from '../src/modules/category/category.model'
import { NoteModel } from '../src/modules/note/note.model'
import { PostModel } from '../src/modules/post/post.model'
const env = config().parsed || {}
const url = APP.MONGO_DB.uri

const opt = {
  useCreateIndex: true,
  useFindAndModify: false,
  useNewUrlParser: true,
  useUnifiedTopology: true,
  autoIndex: true,
}
mongoose.connect(url, opt)
const post = getModelForClass(PostModel)
const note = getModelForClass(NoteModel)
const category = getModelForClass(CategoryModel)

const Config = {
  env,
  db: (mongoose.connection as any).client.db('mx-space-next') as ConnectionBase,
  models: {
    post,
    note,
    category,
  },
}
async function bootstrap(cb: (config: typeof Config) => any) {
  await cb.call(this, Config)

  mongoose.disconnect()
  process.exit()
}

export { bootstrap as patch }
