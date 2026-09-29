import { readFile, rename, writeFile } from 'node:fs/promises'

import type { AuthorFs } from './document'
import type { SessionFs } from './session'

export const nodeAuthorFs: AuthorFs = {
  writeFile: (path, data) => writeFile(path, data, 'utf8'),
  rename: (from, to) => rename(from, to),
}

export const nodeSessionFs: SessionFs = {
  ...nodeAuthorFs,
  readFile: (path) =>
    readFile(path).then(
      (data) => new Uint8Array(data),
      () => undefined,
    ),
  writeBinary: (path, data) => writeFile(path, data),
}
