declare global {
  interface JSON {
    safeParse: typeof JSON.parse
  }
}

export const registerJSONGlobal = () => {
  JSON.safeParse = (...rest) => {
    try {
      return JSON.parse(...rest)
    } catch (error) {
      return null
    }
  }
}
