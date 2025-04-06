import { extend } from 'umi-request'
import type { IRequestAdapter } from '~/interfaces/adapter'
import type { RequestMethod, RequestResponse } from 'umi-request'

const $http = /*#__PURE__*/ extend({
  getResponse: true,
  requestType: 'json',
  responseType: 'json',
})

export const umiAdaptor: IRequestAdapter<
  RequestMethod<true>,
  RequestResponse
> = Object.preventExtensions({
  get default() {
    return $http
  },
  responseWrapper: {} as any as RequestResponse,
  get(url, options) {
    return $http.get(url, options)
  },
  post(url, options) {
    return $http.post(url, options)
  },
  put(url, options) {
    return $http.put(url, options)
  },
  delete(url, options) {
    return $http.delete(url, options)
  },
  patch(url, options) {
    return $http.patch(url, options)
  },
})

// eslint-disable-next-line import/no-default-export
export default umiAdaptor
