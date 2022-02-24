import { homedir } from 'os'
import { join } from 'path'
import { isDev } from '~/global/env.global'

export const HOME = homedir()

export const TEMP_DIR = isDev ? join(process.cwd(), './tmp') : '/tmp/mx-space'

export const DATA_DIR = isDev
  ? join(process.cwd(), './tmp')
  : join(HOME, '.mx-space')

export const USER_ASSET_DIR = join(DATA_DIR, 'assets')
export const LOG_DIR = join(DATA_DIR, 'log')

export const BACKUP_DIR = !isDev
  ? join(DATA_DIR, 'backup')
  : join(TEMP_DIR, 'backup')

// 生产环境直接打包到 目录的 admin 下
export const LOCAL_ADMIN_ASSET_PATH = isDev
  ? join(DATA_DIR, 'admin')
  : join(__dirname, './admin')
