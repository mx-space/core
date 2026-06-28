# Serverless > Cloud Function

This is a dynamic route-handling module for implementing cloud functions. The entry point of a cloud function is `handler`:

```js
async function handler(context, require) {}
```

## Example

```js
async function handler() {
  const extra = await require('@mx-space/extra')

  const { BiliClient } = extra
  const bl = await context.getOwner().then((user) => user.socialIds.bilibili)
  const client = new BiliClient(Number.parseInt(bl || uid))
  const bangumi = await client.getFavoriteBangumi(Number.parseInt(len))
  return bangumi
}

const uid = 1
const len = 10
```

For more examples, see the `functions` directory in [mx-space/snippets](https://github.com/mx-space/snippets).

# API

## `require`

`require` has been reworked into an async function.

Usage:

```js
// require built-in module
const path = await require('node:path') // ok
// `os` `sys` module is banned, because is dangerous
const os = await require('node:os') // error

// require third module, you can require some trusted third party modules.
const axios = await require('axios') // ok, but you must install this module in data_dir/node_modules or other NODE_PATH
const core = await require('@nestjs/core') // error, because this module is banned

const apiExtra = await require('@mx-space/extra') // ok, @mx-space/ prefix is trusted, but you must install this module in data_dir/node_modules or other NODE_PATH

const functionA = await require('mx-plugin-a') // ok, file should exist in NODE_PATH

// require remote module, must be a single file, format in cjs
const remoteModule =
  await require('https://gist.githubusercontent.com/Innei/865b40849d61c2200f1c6ec99c48f716/raw/b4ceb3af6b5a52040a1f31594e5ee53154b8b6d5/case-1.js') // ok
```

Currently trusted third-party module prefixes: `@mx-space` `@innei` `mx-function-`

The full list of trusted third-party modules can be found in `snippet.service.ts`.

**Note**: This is a fully isolated execution context (escapes may exist — please report them). You cannot write some code that would run normally in the Node.js runtime.

For example: only the read-only `env` is exposed on `process`; all other methods are stripped. APIs such as `setTimeout` are also removed. However, you can still use these APIs from within standalone modules — be careful about memory leaks and security.

`require(id, useCache)` accepts a second argument that defaults to `true`, matching Node.js's default behavior. Setting it to `false` disables the `require` cache at the cost of additional performance overhead.

**Note**: You can still use the main thread's `require` from within standalone modules, so this is not a truly isolated environment. Be cautious when using third-party modules and pay attention to security. Do not load untrusted modules. Because code executes synchronously inside the process, do not use blocking synchronous code or infinite loops. Multi-process execution is built on Node Cluster, and you can customize the number of worker processes.

## `import`

You can use `import` syntax, but it is merely sugar for the `require` above — by default Node.js can transparently load CJS-format code without ESM support enabled.

Usage:

```ts
// this is ok, will transformer to `var axios = await require('axios')`
// ok, transform to var _ejs = await require("ejs"); _ejs.render

// bad, don't recommend
```

## Context

The first argument to `handler` is a global context object.

Through this context you can access the request's parameters, URL, query, and other properties.

`context.req` Request object

`context.res` FunctionContextResponse object

`context.throws` Throw a request error, e.g. `context.throws(400, 'bad request')`

`context.params`

`context.query`

~~`context.body`~~ planned

`context.headers`

`context.model` The current snippet's model

`context.getOwner()` `Promise<OwnerModel>` — fetches the owner's information

`context.getService(name: string)` `Promise<unknown>` — currently supports `config`. For HTTP calls, use the global `fetch` directly (it is SSRF-guarded).

`context.secret` Secret object

`context.name` same as model.name

`context.reference` same as model.reference

`context.writeAsset(path: string, data: any, options)` Writes a configuration file. For safety, the path is normalized — all parent-directory traversal markers are stripped, e.g. `./../a` → `./a`.

`context.readAsset(path: string, data: any, options)` Reads a configuration file.

## `Storage`

`context.storage` exposes a data-access layer.

- `context.storage.cache` is a Redis key/value store useful for ephemeral data.
- `context.storage.db` is a key/value store kept in PostgreSQL, isolated from other application data. It is backed by the `serverless_storages` table and partitioned by namespace.

## `process`

| Key                  | Type                               |
| -------------------- | ---------------------------------- |
| `process.env`        | `Readonly<Record<string, string>>` |
| `process.nextTick()` |                                    |

## Global API

- `fetch` - Fetch API
- `console` - Modified Console API
- `logger` - Equal `console`

And other global api is all banned.

# TODO

- [ ] HTTP Methods: POST, PUT, DELETE, PATCH
- [x] ResponseType: buffer, stream
- [ ] handle safeEval throw
- [x] set Content-Type
- [x] ESM AST Parser (ImportStatement)
- [x] Cron to clean require cache
- [ ] Logger
- [ ] Debugger
