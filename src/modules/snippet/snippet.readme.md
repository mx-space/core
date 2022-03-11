# Serverless Function

云函数的 private 只用于鉴权, 入口函数为 handler. 采用 safe-eval, 无法获取 global, require, process 等全局对象.

使用 mock 方式注入

```js
async function handler(context, require) {}
```

## 注入 Mock 全局对象

1. require (异步!!!)

- 网络模块 (cjs, 无外置依赖) (ps: 需要缓存, 通过 axios 可以请求) <https://gist.github.com/Innei/865b40849d61c2200f1c6ec99c48f716>
- 内建模块 (path, http, https, etc.) 或者只需要 remove 一些不安全的模块? (如 os, process, child_process, etc.),

  ```js
  const bannedBuiltinModules = ['fs', 'path', 'os', 'child_process']
  ```

- 第三方模块 (axios, fastify, etc.)

1. global, globalThis, self

- 作废, 或许可以传入 noop 或者不传

1. process

- 只传入 env, 只读
- 可传入 stdout, stderr 但是有无必要?

## Sample

1. 简单的 handler

```js
async function handler() {
  return 'foo-bar'
}
```

Get 公开接口

```json
{ "data": "foo-bar" }
```

2.

# Break

Get /:id 现需要鉴权, 不计算 data 属性

Get /:reference/:name 对外公开

<!-- 请求响应: JSON, 原始类型会被挂载到 `{data: }`. 会进行 JSON snakecase 处理 -->

请求响应: raw data, http bypass

---

# SF Readme

## `require`

`require` 进行了重新处理，是一个异步函数。

使用方法:

```js
// require built-in module
const path = await require('path') // ok
// `os` `sys` module is banned, because is dangerous
const os = await require('os') // error

// require third module, you can require some trusted third party modules.
const axios = await require('axios') // ok, but you must install this module in data_dir/node_modules or other NODE_PATH
const core = await require('@nestjs/core') // error, because this module is banned

const apiExtra = await require('@mx-space/extra') // ok, @mx-space/ prefix is trusted, but you must install this module in data_dir/node_modules or other NODE_PATH

const functionA = await require('mx-plugin-a') // ok, file should exist in NODE_PATH

// require remote module, must be a single file, format in cjs
const remoteModule =
  await require('https://gist.githubusercontent.com/Innei/865b40849d61c2200f1c6ec99c48f716/raw/b4ceb3af6b5a52040a1f31594e5ee53154b8b6d5/case-1.js') // ok
```

目前受信任的三方库前缀: `@mx-space` `@innei` `mx-function-`

受信任的三方库，可在 `snippet.service.ts` 中找到。

**注意**：这是一个完全的执行上下文，你不能编写某些在 NodeJS 运行时正常执行的代码。

比如: `process` 中只有只读的 env 可以获取，其他方法都被移除； `setTimeout` 等 API 被移除。但是你可以在独立模块中使用这些 API，需要注意，内存泄漏和安全性。

`require(id, useCache)` require 支持第二个参数，默认为 true，这是 NodeJS 的默认行为，可以设定为 `false` 以禁用 `require` 的缓存，但是会增加性能开销。

## `Context`

`handler` 函数的第一个参数接受一个全局上下文对象。

可以通过此上下文，获取请求的参数，URL，Query 等属性。

`context.req` Request 对象

~~`context.res`~~ 正在计划中

`context.throws` 请求抛错，e.g. `context.throws(400, 'bad request')`

`context.params`

`context.query`

~~`context.body`~~ 计划中

`context.headers`

`context.model` 当前 Snippet 的 Model

`context.document` MongooseDocument<SnippetModel>，可以进行对该记录的数据库操作。（不建议）

`context.name` same as model.name

`context.reference` same as model.reference

`context.writeAsset(path: string, data: any, options)` 该方法用于写入配置文件。考虑安全性，会对 path 进行简单转化，删除所有返回上级的符号, e.g. `./../a` => `./a`

`context.readAsset(path: string, data: any, options)` 该方法用于读取配置文件。

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
- [ ] ResponseType: buffer, stream
- [ ] handle safeEval throw
- [ ] MongoDb inject (can access db)
- [ ] set Content-Type
- [ ] ESM AST Parser