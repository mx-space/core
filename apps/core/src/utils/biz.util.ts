import { DEMO_MODE } from '~/app.config'
import { BanInDemoExcpetion } from '~/common/exceptions/ban-in-demo.exception'

/**
 * 检查是否在 demo 模式下，禁用此功能
 */
export const banInDemo = () => {
  if (DEMO_MODE) {
    throw new BanInDemoExcpetion()
  }
}
