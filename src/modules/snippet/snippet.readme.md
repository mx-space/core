# 数据区块 (Snippet)

拟定于存储一些动态扩展配置. 一期实现存储 JSON 和 plain text 的区块

拟定:

JSON:

```
input: json `{"foo":"bar"}`


output:

{
  metatype: null,
  type: 'json',
  data: {
    foo: 'bar'
  },
  raw: '{"foo":"bar"}',
  id: xx
}
```

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


TODO: 捕获 safeEval 报错

## 全局上下文

1. req, res


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

