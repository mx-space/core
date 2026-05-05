import { existsSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import semver from 'semver'

import { cwd, isDev } from '~/global/env.global'
import { PKG } from '~/utils/pkg.util'

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

let localAdminVersionCache: { mtimeMs: number; version: string | null } | null =
  null

const readLocalAdminVersion = (): string | null => {
  const versionPath = join(LOCAL_ADMIN_ASSET_PATH, 'version')
  let mtimeMs: number
  try {
    mtimeMs = statSync(versionPath).mtimeMs
  } catch {
    localAdminVersionCache = null
    return null
  }
  if (localAdminVersionCache && localAdminVersionCache.mtimeMs === mtimeMs) {
    return localAdminVersionCache.version
  }
  let version: string | null = null
  try {
    const raw = readFileSync(versionPath, 'utf8').split('\n')[0]?.trim()
    if (raw && semver.valid(raw)) version = raw
  } catch {
    version = null
  }
  localAdminVersionCache = { mtimeMs, version }
  return version
}

export const resolveAdminAssetRoot = (relativePath = 'index.html') => {
  const localExists = existsSync(join(LOCAL_ADMIN_ASSET_PATH, relativePath))
  const bundledExists =
    LOCAL_ADMIN_ASSET_PATH !== BUNDLED_ADMIN_ASSET_PATH &&
    existsSync(join(BUNDLED_ADMIN_ASSET_PATH, relativePath))

  if (localExists && bundledExists) {
    const bundledVersion = PKG.dashboard?.version
    const localVersion = readLocalAdminVersion() ?? '0.0.0'
    if (
      bundledVersion &&
      semver.valid(bundledVersion) &&
      semver.lt(localVersion, bundledVersion)
    ) {
      return BUNDLED_ADMIN_ASSET_PATH
    }
    return LOCAL_ADMIN_ASSET_PATH
  }
  if (localExists) return LOCAL_ADMIN_ASSET_PATH
  if (bundledExists) return BUNDLED_ADMIN_ASSET_PATH

  return LOCAL_ADMIN_ASSET_PATH
}

export const NODE_REQUIRE_PATH = join(DATA_DIR, 'node_modules')
