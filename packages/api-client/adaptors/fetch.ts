import type { IRequestAdapter } from '~/interfaces/adapter'
import type { RequestOptions } from '~/interfaces/instance'

const jsonDataAttachResponse = async (response: Response) => {
  const cloned = response.clone()
  let data: any = {}
  const contentType =
    cloned.headers.get('Content-Type')?.split(';')[0].trim() || ''

  switch (contentType) {
    case 'application/json': {
      data = await cloned.json()
      break
    }
    default: {
      // const clonedAgain = cloned.clone()
      // data = await cloned.json().catch(() => clonedAgain.text())
      data = await cloned.text()
      break
    }
  }

  const nextResponse = Object.assign({}, response, {
    data,
  })

  if (response.ok) {
    return nextResponse
  } else {
    return Promise.reject(nextResponse)
  }
}

/**
 * transform options to fetch options
 * @param options
 * @returns
 */
const parseOptions = (options: Partial<RequestOptions>): RequestInit => {
  const { headers = {}, data, ...rest } = options

  if (typeof data === 'object' && !(data instanceof FormData)) {
    const key = 'Content-Type'
    const value = 'application/json'
    if (Array.isArray(headers)) {
      headers.push([key, value])
    } else if (Object.prototype.toString.call(headers) === '[object Object]') {
      headers[key] = value
    } else if (headers instanceof Headers) {
      headers.append(key, value)
    }
  }

  return {
    headers,
    body: typeof data === 'object' ? JSON.stringify(data) : data,
    ...rest,
  }
}
// @ts-ignore
export const fetchAdaptor: IRequestAdapter<typeof fetch> =
  Object.preventExtensions({
    get default() {
      return fetch
    },
    async delete(url, options) {
      const data = await fetch(url, {
        ...options,
        method: 'DELETE',
      })
      return jsonDataAttachResponse(data)
    },
    async get(url, options) {
      const response = await fetch(url, {
        ...options,
        method: 'GET',
      })
      return jsonDataAttachResponse(response)
    },
    async patch(url, options) {
      const response = await fetch(url, {
        ...parseOptions(options),
        method: 'PATCH',
      })
      return jsonDataAttachResponse(response)
    },
    async post(url, options) {
      const response = await fetch(url, {
        ...parseOptions(options),
        method: 'POST',
      })
      return jsonDataAttachResponse(response)
    },
    async put(url, options) {
      const response = await fetch(url, {
        ...parseOptions(options),
        method: 'PUT',
      })
      return jsonDataAttachResponse(response)
    },
    responseWrapper: {} as any as Response,
  })
