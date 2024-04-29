import JSON5 from 'json5'

declare global {
  interface JSON {
    safeParse: typeof JSON.parse

    JSON5: typeof JSON5
  }
}

export const registerJSONGlobal = () => {
  JSON.safeParse = (...rest) => {
    try {
      return JSON5.parse(...rest)
    } catch {
      return null
    }
  }

  JSON.JSON5 = JSON5
}
