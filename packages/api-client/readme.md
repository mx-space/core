# MApi Client

这是一个适用于 MServer v3 的 JS SDK，封装了常用接口请求方法以及返回类型的声明，以快速开发前端应用。

## 版本兼容性

| api-client 版本 | 支持的 Server 版本 | 说明                          |
| --------------- | ------------------ | ----------------------------- |
| v2.x            | >= 10              | 基于 Better Auth 的新认证系统 |
| v1.x            | <= 9               | 旧版认证系统                  |

**注意**: v2 版本与 v1 版本存在 Breaking Changes，升级时请参考下方迁移指南。

## 迁移到 v2

### Breaking Changes

#### 1. 控制器重命名

`user` 控制器已重命名为 `owner`，`master` 别名已被移除：

```diff
- client.user.getMasterInfo()
+ client.owner.getOwnerInfo()

- client.master.getMasterInfo()
+ client.owner.getOwnerInfo()
```

#### 2. 登录接口变更

登录接口从 `POST /master/login` 变更为 `POST /auth/sign-in`：

```diff
- client.user.login(username, password)
+ client.owner.login(username, password, { rememberMe: boolean })
```

v2 版本的 `login` 方法返回的数据结构也发生了变化，现在返回 `{ token, user }` 格式。

#### 3. 新增 Better Auth 相关接口

v2 版本新增了 Better Auth 认证相关的接口：

```ts
// 获取当前会话
client.owner.getSession()

// 获取 Better Auth 原生会话
client.owner.getAuthSession()

// 登出
client.owner.logout()

// 获取支持的登录方式
client.owner.getAllowLoginMethods()

// 获取 OAuth 提供商列表
client.owner.getProviders()

// 列出所有会话
client.owner.listSessions()

// 撤销指定会话
client.owner.revokeSession(token)

// 撤销所有会话
client.owner.revokeSessions()

// 撤销其他会话
client.owner.revokeOtherSessions()
```

## 迁移到 v1

不再提供 camelcase-keys 的 re-export，此库不再依赖 camelcase-keys 库，如有需要可自行安装。

```diff
- import { camelcaseKeysDeep, camelcaseKeys } from '@mx-space/api-client'
+ import { simpleCamelcaseKeys as camelcaseKeysDeep } from '@mx-space/api-client'
```

## 如何使用

此 SDK 框架无关，不捆绑任何一个网络请求库，只需要提供适配器。你需要手动传入符合接口标准的适配器。

此项目提供 `axios` 和 `umi-request` 两个适配器。

以 `axios` 为例。

```ts
import {
  AggregateController,
  allControllers, // ...
  CategoryController,
  createClient,
  NoteController,
  PostController,
} from '@mx-space/api-client'
import { axiosAdaptor } from '@mx-space/api-client/adaptors/axios'

const endpoint = 'https://api.innei.dev/v2'
const client = createClient(axiosAdaptor)(endpoint)

// `default` is AxiosInstance
// you can do anything else on this
// interceptor or re-configure
const $axios = axiosAdaptor.default
// re-config (optional)
$axios.defaults.timeout = 10000
// set interceptors (optional)
$axios.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) {
      config.headers!.Authorization = `bearer ${getToken()}`
    }

    return config
  },
  (error) => {
    if (__DEV__) {
      console.log(error.message)
    }

    return Promise.reject(error)
  },
)

// inject controller first.
client.injectControllers([
  PostController,
  NoteController,
  AggregateController,
  CategoryController,
])

// or you can inject allControllers
client.injectControllers(allControllers)

// then you can request `post` `note` and `aggregate` controller

client.post.post.getList(page, 10, { year }).then((data) => {
  // do anything
})
```

**为什么要手动注入控制器**

按需加载，可以减少打包体积 (Tree Shake)

**为什么不依赖请求库**

可以防止项目中出现两个请求库，减少打包体积

**如果不使用 axios，应该如何编写适配器**

参考 `src/adaptors/axios.ts` 和 `src/adaptors/umi-request.ts`

**如何使用 proxy 来访问 sdk 内未包含的请求**

如请求 `GET /notes/something/other/123456/info`，可以使用

```ts
client.note.proxy.something.other('123456').info.get()
```

**从 proxy 获取请求地址但不发出**

```ts
client.note.proxy.something.other('123456').info.toString() // /notes/something/other/123456/info

client.note.proxy.something.other('123456').info.toString(true) // http://localhost:2333/notes/something/other/123456/info
```
