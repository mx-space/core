import { createE2EApp } from 'test/helper/create-e2e-app'
import { authPassHeader } from 'test/mock/guard/auth.guard'
import { configProvider } from 'test/mock/modules/config.mock'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { BaseOptionController } from '~/modules/option/controllers/base.option.controller'

describe('OptionController (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [BaseOptionController],
    providers: [configProvider],
  })
  test('GET /config/form-schema', () => {
    return proxy.app
      .inject({
        method: 'GET',
        url: `${apiRoutePrefix}/config/form-schema`,
        headers: {
          ...authPassHeader,
        },
      })
      .then((res) => {
        expect(res.statusCode).toBe(200)
        const json = res.json()

        expect(
          typeof json.data.groups === 'object' && json.data.groups,
        ).toBeTruthy()
        expect(
          typeof json.data.defaults === 'object' && json.data.defaults,
        ).toBeTruthy()
      })
  })
})
