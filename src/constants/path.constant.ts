/*
 * @Author: Innei
 * @Date: 2020-08-01 19:49:31
 * @LastEditTime: 2021-03-21 19:36:20
 * @LastEditors: Innei
 * @FilePath: /server/shared/constants/index.ts
 * @Coding with Love
 */
import { homedir } from 'os'
import { join } from 'path'
import { isDev } from '~/utils'

export const HOME = homedir()

export const TEMP_DIR = isDev ? join(__dirname, '../tmp') : '/tmp/mx-space'

export const DATA_DIR = isDev
  ? join(__dirname, '../tmp')
  : join(HOME, '.mx-space')

export const LOGGER_DIR = join(DATA_DIR, 'log')
