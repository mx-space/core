import { axiosAdaptor } from '~/adaptors/axios'
import type { HTTPClient } from '~/core'
import { createClient } from '~/core'
import type { IController } from '~/interfaces/controller'

export const mockRequestInstance = (
  injectController: new (client: HTTPClient) => IController,
) => {
  const client = createClient(axiosAdaptor)('https://api.innei.ren/v2')
  client.injectControllers(injectController)
  return client
}
