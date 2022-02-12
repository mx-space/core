# MX-Server

[![GitHub stars](https://img.shields.io/github/stars/mx-space/mx-server.svg?style=flat)](https://github.com/mx-space/mx-server/stargazers)
[![GitHub issues](https://img.shields.io/github/issues-raw/mx-space/mx-server.svg?style=flat)](https://github.com/mx-space/mx-server/issues)
[![GitHub Workflow Status](https://img.shields.io/github/workflow/status/mx-space/mx-server/Deploy?label=deploy&style=flat)](https://github.com/mx-space/mx-server/actions?query=workflow:%22Deploy%22)
[![GitHub license](https://img.shields.io/github/license/mx-space/mx-server.svg?style=flat)](https://github.com/mx-space/mx-server/blob/main/LICENSE)
[![wakatime](https://wakatime.com/badge/user/9213dc96-df0d-4e66-b0bb-50f9e04e988c/project/3e6fb54a-082c-4110-bccc-b641bad13882.svg)](https://wakatime.com/badge/user/9213dc96-df0d-4e66-b0bb-50f9e04e988c/project/3e6fb54a-082c-4110-bccc-b641bad13882)
[![Docker Image Size (latest by date)](https://img.shields.io/docker/image-size/innei/mx-server)](https://hub.docker.com/repository/docker/innei/mx-server)

> **RESTful API service for Mix Space, powered by [`nestjs`](https://github.com/nestjs/nest), required [`mongoDB`](https://www.mongodb.com/) & [`Redis`](https://redis.io/).**

> **适用于 Mix Space 的 RESTful API 服务端应用；基于 [`nestjs`](https://github.com/nestjs/nest) (nodejs)，需安装 [`mongoDB`](https://www.mongodb.com/) 和 [`Redis`](https://redis.io/) 方可完整运行。**

> v3 还是使用 [`nestjs`](https://github.com/nestjs/nest) 进行重构，之前的版本在 [此仓库](https://github.com/mx-space/server)。

配合相关项目一起使用:

- **SSR Blog**:
  - [Kami](https://github.com/mx-space/kami) powered by NextJS (一个走可爱风路线的个人空间)
  - 未来会变多吗
- **Admin**: [Admin](https://github.com/mx-space/admin-next)
- 未来可期

接口文档通过开发环境 Swagger 查阅，接口大概有 120+ 个

## 快速开始

需要以下环境:

- Node.js 16.10+
- MongoDB
- Redis

使用构建好的版本你的系统必须是 Linux (test on Ubuntu 18, Ubuntu 20, CentOS 8)

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

所有的依赖都打包进了文件无需 node_modules

## Docker 部署


```bash
cd
mkdir -p mx/server
cd mx/server
wget https://cdn.jsdelivr.net/gh/mx-space/mx-server@master/docker-compose.yml
docker-compose up -d
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
│   ├── article.constant.ts
│   ├── cache.constant.ts
│   ├── meta.constant.ts
│   ├── path.constant.ts
│   └── system.constant.ts
├── main.ts                       # 引入配置，启动主程序，引入各种全局服务
├── modules                       # 业务逻辑模块
│   ├── aggregate
│   ├── analyze
│   ├── auth
│   ├── backup
│   ├── category
│   ├── comment
│   ├── configs
│   ├── feed
│   ├── health
│   ├── init
│   ├── link
│   ├── markdown
│   ├── note
│   ├── option
│   ├── page
│   ├── pageproxy
│   ├── post
│   ├── project
│   ├── pty
│   ├── recently
│   ├── say
│   ├── search
|   ├── snippet
│   ├── sitemap
│   ├── tool
│   └── user
├── processors                      # 核心辅助模块
│   ├── cache                       # Redis 缓存相关
│   ├── database                    # Mongo 数据库相关
│   ├── gateway                     # Socket.IO 相关
│   ├── helper                      # 辅助类
│   └── logger                      # 自定义 Logger
├── shared                          # 通用模型
│   ├── dto                         # 数据验证模型
│   ├── interface                   # 接口
│   └── model                       # 基本数据模型
├── utils                           # 工具类
│   ├── crud.util.ts
│   ├── dayjs.util.ts
│   ├── global.util.ts
│   ├── index.util.ts
│   ├── ip.util.ts
│   ├── nest.util.ts
│   ├── pic.util.ts
│   ├── query.util.ts
│   ├── redis.util.ts
│   ├── system.util.ts
│   ├── time.util.ts
│   ├── transfrom.util.ts
│   └── validator
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
ResponseInterceptor -> JSONSerializeInterceptor -> CountingInterceptor -> AnalyzeInterceptor -> HttpCacheInterceptor
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
  1. [Tool] 工具接口
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
      - 清除缓存
      - etc.
  1. [EmailService] 送信服务
  1. [HttpService] 请求模块
  1. [ImageService] 图片处理
  1. [TqService] 任务队列
  1. [UploadService] 上传服务
  1. [AssetService] 获取本地资源服务

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

# 许可

This project is GPLv3 licensed. 2021 Innei
