import type { FileSystem, HttpClient, Path } from '@effect/platform'
import { Layer } from 'effect'

import { Auth } from '../services/Auth'
import { Config } from '../services/Config'
import { Editor } from '../services/Editor'
import { Lexical } from '../services/Lexical'
import { Migration } from '../services/Migration'
import { Profile } from '../services/Profile'
import { Renderer } from '../services/Renderer'
import { UpdateNotifier } from '../services/UpdateNotifier'

/**
 * Application-wide service layer — everything EXCEPT `Api` and `Resolver`,
 * which depend on per-invocation global flags (`--api-url`, `--token`,
 * `--api-key`, `--profile`, `--dry-run`, `--lang`) and must be constructed
 * inside `bin/mxs.ts` after `parseGlobalFlags`.
 *
 * Internal dependencies are wired here so callers only need to provide the
 * platform-level services: `FileSystem`, `Path`, `HttpClient`.
 *
 *   Config       ← FileSystem, Path
 *   Profile      ← Config
 *   Migration    ← Config, FileSystem
 *   Auth         ← Config, HttpClient
 *   Editor       ← FileSystem
 *   Renderer     — pure
 *   Lexical      — pure
 *   UpdateNotifier — pure
 */
export const AppLayer: Layer.Layer<
  | Auth
  | Config
  | Editor
  | Lexical
  | Migration
  | Profile
  | Renderer
  | UpdateNotifier,
  never,
  FileSystem.FileSystem | HttpClient.HttpClient | Path.Path
> = (() => {
  const configLayer = Config.Default
  const profileLayer = Profile.Default.pipe(Layer.provide(configLayer))
  const migrationLayer = Migration.Default.pipe(Layer.provide(configLayer))
  const authLayer = Auth.Default.pipe(Layer.provide(configLayer))
  const editorLayer = Editor.Default
  return Layer.mergeAll(
    configLayer,
    profileLayer,
    migrationLayer,
    authLayer,
    editorLayer,
    Renderer.Default,
    Lexical.Default,
    UpdateNotifier.Default,
  )
})()
