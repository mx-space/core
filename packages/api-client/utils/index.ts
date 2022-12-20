import { SortOrder } from '~/interfaces/options'

export const isPlainObject = (obj: any) =>
  isObject(obj) &&
  Object.prototype.toString.call(obj) === '[object Object]' &&
  Object.getPrototypeOf(obj) === Object.prototype

export const sortOrderToNumber = (order: SortOrder) => {
  return (
    {
      asc: 1,
      desc: -1,
    }[order] || 1
  )
}
const isObject = (obj: any) => obj && typeof obj === 'object'
export const destructureData = (payload: any) => {
  if (typeof payload !== 'object') {
    return payload
  }
  if (payload === null) {
    return payload
  }

  const data = payload.data

  const dataIsPlainObject = isPlainObject(data)

  if (dataIsPlainObject && Object.keys(payload).length === 1) {
    const d = Object.assign({}, data)
    // attach raw onto new data
    attachRawFromOneToAnthor(payload, d)
    return d
  }

  return payload
}

export const attachRawFromOneToAnthor = (from: any, to: any) => {
  if (!from || !isObject(to)) {
    return
  }
  from.$raw &&
    Object.defineProperty(to, '$raw', {
      value: { ...from.$raw },
      enumerable: false,
    })
  from.$request &&
    Object.defineProperty(to, '$request', {
      value: { ...from.$request },
      enumerable: false,
    })
}
