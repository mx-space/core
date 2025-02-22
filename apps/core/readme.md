# Mix Space Server

[![GitHub stars](https://img.shields.io/github/stars/mx-space/mx-server.svg?style=flat)](https://github.com/mx-space/mx-server/stargazers)
[![GitHub issues](https://img.shields.io/github/issues-raw/mx-space/mx-server.svg?style=flat)](https://github.com/mx-space/mx-server/issues)
[![Build Core](https://github.com/mx-space/core/actions/workflows/ci.yml/badge.svg)](https://github.com/mx-space/core/actions/workflows/ci.yml)
[![Release](https://github.com/mx-space/core/actions/workflows/release.yml/badge.svg)](https://github.com/mx-space/core/actions/workflows/release.yml)
[![GitHub license](https://img.shields.io/github/license/mx-space/mx-server.svg?style=flat)](https://github.com/mx-space/mx-server/blob/main/LICENSE)
[![wakatime](https://wakatime.com/badge/user/9213dc96-df0d-4e66-b0bb-50f9e04e988c/project/8afd37d1-7501-426f-824b-50aeeb96bb6f.svg)](https://wakatime.com/badge/user/9213dc96-df0d-4e66-b0bb-50f9e04e988c/project/8afd37d1-7501-426f-824b-50aeeb96bb6f)
[![Docker Image Size (latest by date)](https://img.shields.io/docker/image-size/innei/mx-server)](https://hub.docker.com/repository/docker/innei/mx-server)

> **Mix Space 核心服务；基于 [`nestjs`](https://github.com/nestjs/nest) (nodejs)，需安装 [`mongoDB`](https://www.mongodb.com/) 和 [`Redis`](https://redis.io/) 方可完整运行。**

> v3 还是使用 [`nestjs`](https://github.com/nestjs/nest) 进行重构，之前的版本在 [此仓库](https://github.com/mx-space/server)。

此项目不带主站，可以使用以下项目（选一）进行部署。

- [Shiro](https://github.com/innei/shiro) (纯净)
- [Kami](https://github.com/mx-space/kami) (老二次元的风格)
- [Yun](https://github.com/mx-space/mx-web-yun) (简洁的风格)

现有的比较有意思的一些小玩意的实现：

- [云函数](./src/modules/serverless/serverless.readme.md)

三方服务集成：

- Bark 推送
- 邮件订阅

## Docker 部署（建议）

```bash
cd
mkdir -p mx/server
cd mx/server
wget https://fastly.jsdelivr.net/gh/mx-space/mx-server@master/docker-compose.yml
docker-compose up -d
```

## 宿主部署

需要以下环境：

- Node.js 20+
- MongoDB
- Redis

现有 macOS(x86)、Linux(x86) 的已构建产物。使用以下脚本可免手动构建直接运行。

```sh
curl https://cdn.jsdelivr.net/gh/mx-space/mx-server@master/scripts/download-latest-asset.js >> download.js
zx ./download.js
cd mx-server
node index.js
```

或者手动下载 [release](https://github.com/mx-space/mx-server/releases/latest)，之后解压然后

```
node index.js
```

所有的依赖都打包进了产物，无需黑洞一般的 node_modules

> [!NOTE]
> 编译之后的产物错误堆栈是被压缩过的，如果你遇到任何问题，请使用 `node index.debug.js` 启动，复现问题并提供完整堆栈，然后提交 issue。

## 开发环境

```
git clone https://github.com/mx-space/core mx-core
cd mx-core
pnpm i
pnpm dev
```

## 项目结构

```
.
├── app.config.ts                 # 主程序配置，数据库、程序、第三方，一切可配置项
├── app.controller.ts             # 主程序根控制器
├── app.module.ts                 # 主程序根模块，负责各业务模块的聚合
├── common                        # 存放中间件
│   ├── adapters                  # Fastify 适配器的配置
│   ├── decorator                 # 业务装饰器
│   ├── exceptions                # 自定义异常
│   ├── filters                   # 异常处理器
│   ├── guard                     # 守卫与鉴权
│   ├── interceptors              # 拦截器, 数据过滤与响应格式化处理
│   ├── middlewares               # 传统意义上的中间件
│   └── pipes                     # 管道
├── constants                     # 常量
├── main.ts                       # 引入配置，启动主程序，引入各种全局服务
├── modules                       # 业务逻辑模块
├── processors                      # 核心辅助模块
│   ├── cache                       # Redis 缓存相关
│   ├── database                    # Mongo 数据库相关
│   ├── gateway                     # WebSocket 相关
│   ├── helper                      # 辅助类
│   └── logger                      # 自定义 Logger
├── shared                          # 通用模型
│   ├── dto                         # 数据验证模型
│   ├── interface                   # 接口
│   └── model                       # 基本数据模型
├── utils                           # 工具类
└── zx.global.ts

```

## 应用结构

- 请求处理流程

  1. request：收到请求
  1. middleware：中间件过滤爬虫 PHP 肉鸡扫描路径，记录访问历史
  1. guard：守卫过滤（鉴权）和角色附加
  1. interceptor:before：只用于 DEBUG 请求计时
  1. pipe：校验请求数据，过滤未知数据，非法类型抛错 422
  1. controller & resolver：业务控制器
  1. service：业务服务
  1. interceptor:after：数据流拦截器（格式化数据）、请求缓存
  1. filter：捕获以上所有流程中出现的异常，如果任何一个环节抛出异常，则返回错误

- 拦截器流向

```
ResponseInterceptor -> ResponseFilterInterceptor -> JSONTransformInterceptor -> CountingInterceptor -> AnalyzeInterceptor -> HttpCacheInterceptor
```

- [业务逻辑模块](https://github.com/mx-space/mx-server/tree/master/src/modules)

  1. [Aggregate] 聚合
  1. [Analyze] 数据统计
  1. [Auth] 认证
  1. [Backup] 备份
  1. [Category] 分类
  1. [Commnet] 评论
  1. [Configs] 读取配置项
  1. [Feed] RSS
  1. [Health] 应用健康检查与日志相关
  1. [Init] 初始化相关
  1. [Link] 友链
  1. [Markdown] Markdown 解析导入导出解析相关
  1. [Note] 日记
  1. [Option] 设置
  1. [Page] 独立页面
  1. [PageProxy] 反代管理页
  1. [Post] 博文
  1. [Project] 项目
  1. [Recently] 最近
  1. [Say] 说说
  1. [Search] 搜索
  1. [Sitemap] 站点地图
  1. [User] 用户

- [核心辅助模块 processors](https://github.com/mx-space/mx-server/tree/master/src/processors)
  1. [cache] Redis 缓存相关
  1. [database] 数据库相关
  1. [gateway] Socket.IO 相关
     - 用户端
     - 管理端
     - 实时通知
  1. [helper] 辅助类
  1. [CountingService] 提供更新阅读计数
  1. [CronService] 维护管理计划任务
     - 自动备份
     - 推送百度搜索
     - 推送Bing搜索
     - 清除缓存
     - etc.
  1. [EmailService] 送信服务
  1. [HttpService] 请求模块
  1. [ImageService] 图片处理
  1. [TqService] 任务队列
  1. [UploadService] 上传服务
  1. [AssetService] 获取本地资源服务
  1. [TextMacroService] 文本宏替换服务
  1. [JWTService] JWT 服务
  1. [BarkPushService] Bark Push 服务

## 开发

```
pnpm i
pnpm start
```

## Reference

项目参考了 [nodepress](https://github.com/surmon-china/nodepress)

---

Since 2021-08-31

Thanks
