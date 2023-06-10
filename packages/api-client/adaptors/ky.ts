import ky from 'ky'
import type { IRequestAdapter } from '~/interfaces/adapter'
import type { Options, ResponsePromise } from 'ky'
import type { KyInstance } from 'ky/distribution/types/ky'

// eslint-disable-next-line spaced-comment
const $http: KyInstance = /*#__PURE__*/ ky.create({})
// TODO post data not only json,
const getDataFromKyResponse = async (response: ResponsePromise) => {
  const res = await response

  const isJsonType = res.headers
    .get('content-type')
    ?.includes('application/json')
  const json = isJsonType ? await res.clone().json() : null

  const result: Awaited<ResponsePromise> & {
    data: any
  } = {
    ...res,
    data: json ?? (await res.clone().text()),
  }
  return result
}

export const createKyAdaptor = (ky: KyInstance) => {
  const adaptor: IRequestAdapter<KyInstance, ResponsePromise> =
    Object.preventExtensions({
      get default() {
        return ky
      },

      responseWrapper: {} as any as ResponsePromise,
      get(url, options) {
        return getDataFromKyResponse(ky.get(url, options))
      },
      post(url, options) {
        const data = options.data
        delete options.data
        const kyOptions: Options = {
          ...options,
          json: data,
        }

        return getDataFromKyResponse(ky.post(url, kyOptions))
      },
      put(url, options) {
        const data = options.data
        delete options.data
        const kyOptions: Options = {
          ...options,
          json: data,
        }
        return getDataFromKyResponse(ky.put(url, kyOptions))
      },

      patch(url, options) {
        const data = options.data
        delete options.data
        const kyOptions: Options = {
          ...options,
          json: data,
        }
        return getDataFromKyResponse(ky.patch(url, kyOptions))
      },
      delete(url, options) {
        return getDataFromKyResponse(ky.delete(url, options))
      },
    })
  return adaptor
}

export const defaultKyAdaptor = createKyAdaptor($http)

// eslint-disable-next-line import/no-default-export
export default defaultKyAdaptor
