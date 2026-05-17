import { emitSuccess, type OutputOptions, renderTable } from '../../core/output'
import {
  getCurrentProfile,
  listProfiles,
  readProfileConfig,
} from '../../core/profile'
import type { GlobalFlags } from '../internal/shared'

export async function run(_flags: GlobalFlags, out: OutputOptions) {
  const [names, current] = await Promise.all([
    listProfiles(),
    getCurrentProfile(),
  ])

  const rows = await Promise.all(
    names.map(async (name) => {
      const cfg = await readProfileConfig(name)
      return {
        current: name === current ? '*' : '',
        name,
        api_url: cfg.api_url ?? '',
        production: cfg.production ? 'yes' : 'no',
      }
    }),
  )

  if (out.json || out.output === 'json') {
    emitSuccess(rows, out)
    return
  }

  if (rows.length === 0) {
    process.stdout.write('(no profiles)\n')
    return
  }

  process.stdout.write(
    `${renderTable(rows, ['current', 'name', 'api_url', 'production'])}\n`,
  )
}
