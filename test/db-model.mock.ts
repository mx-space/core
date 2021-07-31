import { Provider } from '@nestjs/common'
import { getModelToken } from 'nestjs-typegoose'

const getFakeModel = () => jest.fn()

export const getFakePostModel = (): Provider<any> => {
  const model = getFakeModel()
  return {
    useValue: model,
    provide: getModelToken('PostModel'),
  }
}

export const getFakeCategoryModel = (): Provider<any> => {
  const model = getFakeModel()
  return {
    useValue: model,
    provide: getModelToken('CategoryModel'),
  }
}
