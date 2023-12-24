declare global {
  interface JSON {
    safeParse: typeof JSON.parse
  }
}
export {}
