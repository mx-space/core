import { readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { API_VERSION } from '~/app.config'
import { buildOpenApiDocument } from '~/common/openapi/build-document'
import { routeManifest } from '~/common/openapi/route-manifest'

const here = dirname(fileURLToPath(import.meta.url))

const OUTPUTS = [
  resolve(here, '../openapi.json'),
  resolve(here, '../../ios/Packages/SpaceCore/Sources/SpaceCore/openapi.json'),
]

const label = (path: string) => relative(resolve(here, '../../..'), path)

const main = async () => {
  // `app.config` parses process.argv and rejects unknown flags, so check mode
  // is selected by env var rather than a CLI option.
  const checkOnly = process.env.OPENAPI_CHECK === '1'
  const { document, untypedOperations } = buildOpenApiDocument(
    routeManifest,
    API_VERSION,
  )
  const serialized = `${JSON.stringify(document, null, 2)}\n`

  if (checkOnly) {
    for (const output of OUTPUTS) {
      const current = await readFile(output, 'utf8').catch(() => null)
      if (current !== serialized) {
        console.error(
          `${label(output)} is ${current === null ? 'missing' : 'stale'} — run \`pnpm run openapi:export\` and commit the result`,
        )
        process.exit(1)
      }
    }
    console.info(
      `openapi.json is up to date in ${OUTPUTS.length} location(s) (${routeManifest.length} routes)`,
    )
    return
  }

  for (const output of OUTPUTS) {
    await writeFile(output, serialized)
    console.info(`wrote ${label(output)}`)
  }
  console.info(`${routeManifest.length} routes`)

  if (untypedOperations.length > 0) {
    console.warn(
      `${untypedOperations.length} operation(s) still resolve to an untyped object; the Swift client will see an opaque container:\n  ${untypedOperations.join('\n  ')}`,
    )
  }
}

await main()
