import type { HTTPClient } from '.'

export function attachRequestMethod<T extends HTTPClient<any, any>>(target: T) {
  Object.defineProperty(target, '$$get', {
    value(url: string, options?: any) {
      // HINT: method get only accept search params;
      const { params = {}, ...rest } = options
      const qs = handleSearchParams(params)

      return target.instance.get(`${url}${qs ? String(`?${qs}`) : ''}`, rest)
    },
  })
  ;(['put', 'post', 'patch', 'delete'] as const).forEach((method) => {
    Object.defineProperty(target, `$$${method}`, {
      value(path: string, options?: any) {
        return target.instance[method](path, options)
      },
    })
  })
}
// FIXME: only support string value
function handleSearchParams(obj: URLSearchParams | Record<string, string>) {
  if (!obj && typeof obj !== 'object') {
    throw new TypeError('params must be object.')
  }

  if (obj instanceof URLSearchParams) {
    return obj.toString()
  }
  const search = new URLSearchParams()

  Object.entries<any>(obj).forEach(([k, v]) => {
    if (
      typeof v === 'undefined' ||
      Object.prototype.toString.call(v) === '[object Null]'
    ) {
      return
    }
    search.set(k, v)
  })

  return search.toString()
}
