import { Context, Effect, Layer } from 'effect'

// v2 placeholder — backup/restore methods land alongside the `backup` command.
export interface BackupService {}

export class Backup extends Context.Tag('Backup')<Backup, BackupService>() {
  static Default: Layer.Layer<Backup> = Layer.effect(
    Backup,
    Effect.die('Backup service is a v2 placeholder'),
  )
}
