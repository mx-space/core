import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/cli'

import { Generic } from '../../domain/errors'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { FILE_TYPES, silentFlag, typeOption } from './_shared'

const path = Argument.String('path')

const nameOption = Flag.String('name').pipe(
  Flag.withDescription(
    'override the uploaded filename (defaults to the local basename)',
  ),
  Flag.optional,
)

export const upload = Command.make(
  'upload',
  { path, type: typeOption, name: nameOption, silent: silentFlag },
  ({ path, type, name, silent }) =>
    Effect.gen(function* () {
      const buffer = yield* Effect.tryPromise({
        try: () => readFile(path),
        catch: (err) =>
          new Generic({
            message: `cannot read file: ${path}`,
            cause: err,
          }),
      })

      const filename = name._tag === 'Some' ? name.value : basename(path)
      const form = new FormData()
      // The server picks the first multipart file field and derives the mime
      // type from the filename extension, so no explicit content-type needed.
      form.append('file', new File([new Uint8Array(buffer)], filename))

      const api = yield* Api
      const renderer = yield* Renderer
      const res = yield* api.request(`/objects/upload`, {
        method: 'POST',
        query: { type },
        body: form,
      })
      yield* renderer.emitSuccess(silent ? { ok: true } : res)
    }),
).pipe(
  Command.withDescription(
    `upload a local file (--type ${FILE_TYPES.join('|')}); returns { url, name }`,
  ),
)
