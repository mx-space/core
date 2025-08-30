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
export const LOG_DIR = join(DATA_DIR, 'log')

export const STATIC_FILE_DIR = join(DATA_DIR, 'static')
export const STATIC_FILE_TRASH_DIR = join(TEMP_DIR, 'trash')

export const BACKUP_DIR = !isDev
  ? join(DATA_DIR, 'backup')
  : join(TEMP_DIR, 'backup')

// 生产环境直接打包到 目录的 admin 下
export const LOCAL_ADMIN_ASSET_PATH = isDev
  ? join(DATA_DIR, 'admin')
  : join(cwd, './admin')

export const NODE_REQUIRE_PATH = join(DATA_DIR, 'node_modules')
