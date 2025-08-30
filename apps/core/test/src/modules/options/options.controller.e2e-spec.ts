import { BaseOptionController } from '~/modules/option/controllers/base.option.controller'
import { createE2EApp } from 'test/helper/create-e2e-app'
import { authPassHeader } from 'test/mock/guard/auth.guard'
import { configProvider } from 'test/mock/modules/config.mock'

describe('OptionController (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [BaseOptionController],
    providers: [configProvider],
  })
  test('GET /config/jsonschema', () => {
    return proxy.app
      .inject({
        method: 'GET',
        url: '/config/jsonschema',
        headers: {
          ...authPassHeader,
        },
      })
      .then((res) => {
        expect(res.statusCode).toBe(200)
        const json = res.json()

        expect(
          typeof json.properties === 'object' && json.properties,
        ).toBeTruthy()
        expect(typeof json.default === 'object' && json.default).toBeTruthy()
      })
  })
})
