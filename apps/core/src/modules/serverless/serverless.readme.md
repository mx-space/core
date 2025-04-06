# Serverless > Cloud Function

这是一个动态的路由处理模块，用于实现云函数，云函数入口为 `handler`：

```js
async function handler(context, require) {}
```

## 实例

```js
async function handler() {
  const extra = await require('@mx-space/extra')

  const { BiliClient } = extra
  const bl = await context.getMaster().then((user) => user.socialIds.bilibili)
  const client = new BiliClient(Number.parseInt(bl || uid))
  const bangumi = await client.getFavoriteBangumi(Number.parseInt(len))
  return bangumi
}

const uid = 1
const len = 10
```

更多实例，可以在 [mx-space/snippets](https://github.com/mx-space/snippets) 中 functions 目录下找到。

# API

## `require`

`require` 进行了重新处理，是一个异步函数。

使用方法：

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

目前受信任的三方库前缀：`@mx-space` `@innei` `mx-function-`

受信任的三方库，可在 `snippet.service.ts` 中找到。

**注意**：这是一个完全隔离（可能存在逃逸，请及时指出）的执行上下文，你不能编写某些在 NodeJS 运行时正常执行的代码。

比如：`process` 中只有只读的 env 可以获取，其他方法都被移除； `setTimeout` 等 API 被移除。但是你可以在独立模块中使用这些 API，需要注意，内存泄漏和安全性。

`require(id, useCache)` require 支持第二个参数，默认为 true，这是 NodeJS 的默认行为，可以设定为 `false` 以禁用 `require` 的缓存，但是会增加性能开销。

**注意**：你仍然可以在独立模块中使用主线程的 `require` 方法，所以这并不是一个真正隔离的环境。在使用第三方模块和请注意安全。请不要使用不受信任的模块。由于在同步进程中执行，请不要使用同步的阻塞代码或死循环。多进程建立在 Node Cluster 之上，可以自定义服务运行的进程数。

## `import`

你可以使用 `import` 语法，但是这只是个上面的 `require` 语法糖，因为在 NodeJS 中如果不开启 ESM 的支持，默认智能识别 CJS 格式的语法。

用法如下：

```ts
// this is ok, will transformer to `var axios = await require('axios')`
// ok, transform to var _ejs = await require("ejs"); _ejs.render

// bad, don't recommend
```

## Context

`handler` 函数的第一个参数接受一个全局上下文对象。

可以通过此上下文，获取请求的参数，URL，Query 等属性。

`context.req` Request 对象

`context.res` FunctionContextResponse 对象

`context.throws` 请求抛错，e.g. `context.throws(400, 'bad request')`

`context.params`

`context.query`

~~`context.body`~~ 计划中

`context.headers`

`context.model` 当前 Snippet 的 Model

`context.getMaster()` Promise<UserModel>，可以获取到主人的信息

`context.getService(name: string)` Promise<unknown>，当前支持 `axios`, `config`

`context.secret` Secret 对象

`context.name` same as model.name

`context.reference` same as model.reference

`context.writeAsset(path: string, data: any, options)` 该方法用于写入配置文件。考虑安全性，会对 path 进行简单转化，删除所有返回上级的符号，e.g. `./../a` => `./a`

`context.readAsset(path: string, data: any, options)` 该方法用于读取配置文件。

## `Storage`

可以通过 `context.storage` 访问数据存取层。

- `context.storage.cache` 是一个 Redis Key-Value 存储结构，可保存临时数据。
- `context.storage.db` 是一个与其他数据隔离的保存在 MongoDB 中的 Key-Value 结构的数据。
- `context.storage.dangerousAccessDbInstance()` 获取此系统的 MongoConnection 实例，返回 `[Db, mongo]`。可用于真正操作数据库。如字面意思所见这是不安全的行为。

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
- [x] MongoDb inject (can access db)
- [x] set Content-Type
- [x] ESM AST Parser (ImportStatement)
- [x] Cron to clean require cache
- [ ] Logger
- [ ] Debugger
