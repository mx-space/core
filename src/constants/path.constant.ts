import { homedir } from 'os'
import { join } from 'path'
import { isDev } from '~/utils/index.util'

export const HOME = homedir()

export const TEMP_DIR = isDev ? join(process.cwd(), './tmp') : '/tmp/mx-space'

export const DATA_DIR = isDev
  ? join(process.cwd(), './tmp')
  : join(HOME, '.mx-space')

export const USER_ASSET_DIR = join(DATA_DIR, 'assets')
export const LOGGER_DIR = join(DATA_DIR, 'log')

export const LOCAL_BOT_LIST_DATA_FILE_PATH = join(DATA_DIR, 'bot_list.json')

export const BACKUP_DIR = !isDev
  ? join(DATA_DIR, 'backup')
  : join(TEMP_DIR, 'backup')
