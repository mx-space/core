import axios, { AxiosInstance, AxiosResponse } from 'axios'

import { IRequestAdapter } from '~/interfaces/adapter'

// eslint-disable-next-line spaced-comment
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
