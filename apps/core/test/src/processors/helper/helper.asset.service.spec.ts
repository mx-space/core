import path from 'node:path'

import { resolveAssetPath } from '~/processors/helper/helper.asset.service'

describe('AssetService path validation', () => {
  const root = path.resolve('/tmp/mx-space-assets')

  it('resolves nested asset paths inside the root', () => {
    expect(resolveAssetPath(root, 'images/avatar.png')).toBe(
      path.join(root, 'images/avatar.png'),
    )
  })

  it('rejects paths that escape the root', () => {
    expect(() => resolveAssetPath(root, '../secret.txt')).toThrow(
      'Asset path escapes root',
    )
  })

  it('rejects absolute paths outside the root', () => {
    expect(() => resolveAssetPath(root, '/etc/passwd')).toThrow(
      'Asset path escapes root',
    )
  })
})
