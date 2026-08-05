import path from 'node:path'

import { STATIC_FILE_DIR } from '~/constants/path.constant'

export const FILE_STORAGE_ROOT = Symbol('FILE_STORAGE_ROOT')

export const resolveFileStorageRoot = () =>
  process.env.MX_FILE_STORAGE_ROOT
    ? path.resolve(process.env.MX_FILE_STORAGE_ROOT)
    : STATIC_FILE_DIR
