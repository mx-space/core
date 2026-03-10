import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { cwd, isDev } from '~/global/env.global'

export const HOME = homedir()

export const TEMP_DIR = isDev ? join(cwd, './tmp') : '/tmp/mx-space'

export const DATA_DIR = isDev ? join(cwd, './tmp') : join(HOME, '.mx-space')

export const THEME_DIR = isDev
  ? join(cwd, './tmp/theme')
  : join(DATA_DIR, 'theme')

export const USER_ASSET_DIR = join(DATA_DIR, 'assets')

export const STATIC_FILE_DIR = join(DATA_DIR, 'static')
export const STATIC_FILE_TRASH_DIR = join(TEMP_DIR, 'trash')

export const BACKUP_DIR = !isDev
  ? join(DATA_DIR, 'backup')
  : join(TEMP_DIR, 'backup')

// Swarm/容器环境下，更新后的 admin 资源需要落到持久化数据目录。
export const LOCAL_ADMIN_ASSET_PATH = join(DATA_DIR, 'admin')
export const BUNDLED_ADMIN_ASSET_PATH = isDev
  ? LOCAL_ADMIN_ASSET_PATH
  : join(cwd, './admin')

export const resolveAdminAssetRoot = (relativePath = 'index.html') => {
  for (const basePath of [LOCAL_ADMIN_ASSET_PATH, BUNDLED_ADMIN_ASSET_PATH]) {
    if (existsSync(join(basePath, relativePath))) {
      return basePath
    }
  }

  return LOCAL_ADMIN_ASSET_PATH
}

export const NODE_REQUIRE_PATH = join(DATA_DIR, 'node_modules')
