import { DEMO_MODE } from '~/app.config'
import { BanInDemoExcpetion } from '~/common/exceptions/ban-in-demo.exception'
import { CollectionRefTypes } from '~/constants/db.constant'

/**
 * 检查是否在 demo 模式下，禁用此功能
 */
export const banInDemo = () => {
  if (DEMO_MODE) {
    throw new BanInDemoExcpetion()
  }
}

export const checkRefModelCollectionType = (ref: any) => {
  if (!ref && typeof ref !== 'object')
    throw new TypeError('ref must be an object')

  if ('nid' in ref) {
    return CollectionRefTypes.Note
  }
  if ('title' in ref && 'categoryId' in ref) {
    return CollectionRefTypes.Post
  }
  if ('title' in ref && 'subtitle' in ref) {
    return CollectionRefTypes.Page
  }

  if ('content' in ref) {
    return CollectionRefTypes.Recently
  }
  throw new ReferenceError('ref is not a valid model collection type')
}
