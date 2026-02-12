import PKG_JSON from '../../package.json' with { type: 'json' }

export const PKG = PKG_JSON as {
  name: string
  author?: string
  version: string
  homepage?: string
  issues?: string
  dashboard?: {
    repo: string
    version: string
  }
}
