# Mix Space Server

[![GitHub stars](https://img.shields.io/github/stars/mx-space/mx-server.svg?style=flat)](https://github.com/mx-space/mx-server/stargazers)
[![GitHub issues](https://img.shields.io/github/issues-raw/mx-space/mx-server.svg?style=flat)](https://github.com/mx-space/mx-server/issues)
[![Build Core](https://github.com/mx-space/core/actions/workflows/ci.yml/badge.svg)](https://github.com/mx-space/core/actions/workflows/ci.yml)
[![Release](https://github.com/mx-space/core/actions/workflows/release.yml/badge.svg)](https://github.com/mx-space/core/actions/workflows/release.yml)
[![GitHub license](https://img.shields.io/github/license/mx-space/mx-server.svg?style=flat)](https://github.com/mx-space/mx-server/blob/main/LICENSE)
[![wakatime](https://wakatime.com/badge/user/9213dc96-df0d-4e66-b0bb-50f9e04e988c/project/8afd37d1-7501-426f-824b-50aeeb96bb6f.svg)](https://wakatime.com/badge/user/9213dc96-df0d-4e66-b0bb-50f9e04e988c/project/8afd37d1-7501-426f-824b-50aeeb96bb6f)
[![Docker Image Size (latest by date)](https://img.shields.io/docker/image-size/innei/mx-server)](https://hub.docker.com/repository/docker/innei/mx-server)

> **Mix Space 核心服务；基于 [`nestjs`](https://github.com/nestjs/nest) (Node.js)，AI-powered headless CMS。需安装 [`PostgreSQL 16+`](https://www.postgresql.org/) 和 [`Redis`](https://redis.io/) 方可完整运行。**

此项目不带主站，可以使用以下项目（选一）进行部署。

- [Yohaku](https://github.com/Innei/Yohaku) (Next.js，推荐)
- [Shiro](https://github.com/innei/shiro) (纯净)
- [Kami](https://github.com/mx-space/kami) (老二次元的风格)

现有的比较有意思的一些小玩意的实现：

- [云函数](./src/modules/serverless/serverless.readme.md)

三方服务集成：

- Bark 推送
- 邮件订阅

## Docker 部署（建议）

```bash
git clone https://github.com/mx-space/core.git mx-core
cd mx-core
cp docker-compose.server.yml docker-compose.prod.yml
# 编辑 docker-compose.prod.yml，设置 JWT_SECRET、ALLOWED_ORIGINS 等
docker compose -f docker-compose.prod.yml up -d
```

或直接使用预构建镜像：

```bash
docker pull innei/mx-server:latest
```

镜像支持 `linux/amd64` 和 `linux/arm64`。

## 宿主部署

需要以下环境：

- Node.js 22+
- PostgreSQL 16+
- Redis 7.x

从 [releases](https://github.com/mx-space/core/releases/latest) 下载产物，解压后运行：

```
node index.js
```

所有依赖已打包进产物，无需 `node_modules`。

> [!NOTE]
> 编译之后的产物错误堆栈是被压缩过的，如果你遇到任何问题，请使用 `node index.debug.js` 启动，复现问题并提供完整堆栈，然后提交 issue。

## 开发环境

```bash
corepack enable  # 启用 pnpm
git clone https://github.com/mx-space/core mx-core
cd mx-core
pnpm i
docker compose up -d postgres redis  # 启动 PostgreSQL + Redis
pnpm dev
```

开发模式下 API 监听 `http://localhost:2333`，路由无 `/api/v2` 前缀。

## 项目结构

```
.
├── common/                        # 中间件、装饰器、守卫、拦截器、管道、过滤器
├── constants/                     # 常量（业务事件、缓存键、错误码）
├── database/                      # 数据库层
│   ├── schema/                    #   Drizzle 表定义
│   └── migrations/                #   Drizzle SQL 迁移文件
├── migration/                     # 历史数据迁移（MongoDB→PG）
├── modules/                       # 44 业务模块（ai, auth, post, note, comment …）
├── processors/                    # 基础设施服务
│   ├── database/                  #   PG 连接 + 仓库注册 + BaseRepository
│   ├── redis/                     #   缓存 / pub/sub / emitter
│   ├── gateway/                   #   WebSocket (admin, web, shared)
│   └── helper/                    #   Email, Image, JWT, Lexical …
├── shared/                        # 共享 DTO、接口、Zod schema
├── transformers/                  # 响应转换（snake_case、分页）
└── utils/                         # 34 工具模块
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

### 业务模块 (`modules/`)

Aggregate · Analyze · AI (summary / translation / insights / writer / moderation) · Auth (Better Auth) · Backup · Category · Comment · Configs · Draft · Feed · Health · Init · Link · Note · Option · Page · Post · Project · Recently · Say · Search · Serverless · Sitemap · Snippet · Subscribe · Topic · User · Webhook

### 基础设施 (`processors/`)

| 服务 | 职责 |
|------|------|
| database | PostgreSQL 连接 + Drizzle ORM + 仓库注册 |
| redis | 缓存 / pub/sub / emitter |
| gateway | Socket.IO（用户端、管理端、实时通知）|
| helper | Email · Image · JWT · Lexical · URL Builder · BarkPush · TqService |

## 开发

```bash
pnpm i
docker compose up -d postgres redis
pnpm dev
```

## 技术栈

| 组件 | 技术 |
|------|------|
| 运行时 | Node.js >= 22 + TypeScript 5.9 |
| 框架 | NestJS 11 + Fastify |
| 数据库 | PostgreSQL 16 (Drizzle ORM) |
| 缓存 | Redis (ioredis) |
| 校验 | Zod 4 (nestjs-zod) |
| WebSocket | Socket.IO + Redis Emitter |
| AI | OpenAI SDK, Anthropic SDK |
| 编辑器 | Lexical (`@haklex/rich-headless`) |
| 认证 | Better Auth (session, passkey, API key) |
| 测试 | Vitest + PostgreSQL testcontainers |
| ID | Snowflake bigint |

## 参考

项目参考了 [nodepress](https://github.com/surmon-china/nodepress)

---

Since 2021-08-31

Thanks
