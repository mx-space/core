// @ts-nocheck
import { registerGlobals } from 'zx'
import { isDev } from './utils/index.util'

// FIX: zx 4.1.1 import 'zx/globals' error
// ERROR: Package subpath './globals.mjs' is not defined by "exports" in /Users/xiaoxun/github/innei-repo/mx-space/server-next/node_modules/zx/package.json
// FIXME: registerGlobals manally
registerGlobals()

/// config for zx

$.verbose = isDev
