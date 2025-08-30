import type { URLSearchParams } from 'node:url'
import { inspect } from 'node:util'
import { axiosAdaptor } from '~/adaptors/axios'
import isEqual from 'lodash/isEqual'
import { vi } from 'vitest'

const { spyOn } = vi

export const buildResponseDataWrapper = (data: any) => ({ data })

export const mockResponse = <T>(
  path: string,
  data: T,
  method = 'get',
  requestBody?: any,
) => {
  const exceptUrlObject = new URL(
    path.startsWith('http')
      ? path
      : `https://example.com/${path.replace(/^\//, '')}`,
  )
  // @ts-ignore
  spyOn(axiosAdaptor, method).mockImplementation(
    // @ts-ignore
    async (requestUrl: string, options: any) => {
      const requestUrlObject = new URL(requestUrl)

      if (requestBody) {
        const { data } = options || {}
        if (!isEqual(requestBody, data)) {
          throw new Error(
            `body not equal, got: ${inspect(data)} except: ${inspect(
              requestBody,
            )}`,
          )
        }
      }

      if (
        requestUrlObject.pathname.endsWith(exceptUrlObject.pathname) &&
        (exceptUrlObject.search
          ? isSearchEqual(
              exceptUrlObject.searchParams,
              requestUrlObject.searchParams,
            )
          : true)
      ) {
        return buildResponseDataWrapper(data)
      } else {
        return buildResponseDataWrapper({
          error: 1,
          requestPath: requestUrlObject.pathname + requestUrlObject.search,
          expectPath: path,
        })
      }
    },
  )

  return data
}

const isSearchEqual = (a: URLSearchParams, b: URLSearchParams) => {
  const keys = Array.from(a.keys()).sort()
  if (keys.toString() !== Array.from(b.keys()).sort().toString()) {
    return false
  }
  return keys.every((key) => {
    const res = a.get(key) === b.get(key)
    if (!res) {
      console.log(
        `key ${key} not equal, receive ${a.get(key)} want ${b.get(key)}`,
      )
    }
    return res
  })
}
