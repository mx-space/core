import type { IRequestAdapter } from '~/interfaces/adapter'
import axios from 'axios'
import type { AxiosInstance, AxiosResponse } from 'axios'

const $http = /*#__PURE__*/ axios.create({})

// ignore axios `method` declare not assignable to `Method`
export const axiosAdaptor: IRequestAdapter<
  AxiosInstance,
  AxiosResponse<unknown>
> = Object.preventExtensions({
  get default() {
    return $http
  },
  responseWrapper: {} as any as AxiosResponse<unknown>,
  get(url, options) {
    // @ts-ignore
    return $http.get(url, options)
  },
  post(url, options) {
    const { data, ...config } = options || {}
    // @ts-ignore
    return $http.post(url, data, config)
  },
  put(url, options) {
    const { data, ...config } = options || {}
    // @ts-ignore
    return $http.put(url, data, config)
  },
  delete(url, options) {
    const { ...config } = options || {}
    // @ts-ignore
    return $http.delete(url, config)
  },
  patch(url, options) {
    const { data, ...config } = options || {}
    // @ts-ignore
    return $http.patch(url, data, config)
  },
})

// eslint-disable-next-line import/no-default-export
export default axiosAdaptor
