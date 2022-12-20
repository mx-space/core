export const resolveFullPath = (endpoint: string, path: string) => {
  if (!path.startsWith('/')) {
    path = `/${path}`
  }
  return `${endpoint}${path}`
}
