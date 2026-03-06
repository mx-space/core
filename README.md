# MX Space Core

一个为个人博客、创作者主页与内容网站打造的 **AI-powered CMS Core**。

`mx-space/core` 是 MX Space 的服务端内核。它不仅提供博客 CMS、内容分发与站点数据能力，也内置了面向内容工作流的 AI 模块，包括 AI 摘要、AI 翻译、AI 评论审核、AI 写作辅助，以及多 Provider LLM 接入能力。

## 为什么是 AI-powered

这个仓库已经具备完整的 AI 内容工作流基础设施，适合用来驱动个人博客和创作者网站：

- 支持多 AI Provider 接入：`OpenAI`、`OpenAI-compatible`、`Anthropic`、`OpenRouter`
- 支持 AI 摘要生成与自动摘要
- 支持 AI 多语言翻译与自动翻译任务
- 支持 AI 评论审核与垃圾评论判定
- 支持 AI 写作辅助，例如标题、slug 生成
- 支持流式 AI 响应、任务化处理与内容工作流集成

## 核心能力

- **博客 CMS Core**：文章、分类、标签、页面、草稿、片段、订阅、友链、评论等完整内容管理能力
- **AI Content Workflow**：围绕内容生成、翻译、审核、摘要的 AI 增强工作流
- **Headless API**：基于 NestJS 的 API 服务，可对接前台站点、管理后台和自定义客户端
- **Search & Distribution**：支持搜索、RSS/Feed、站点地图、聚合数据与内容分发
- **Self-hosted Friendly**：适合个人站长和独立开发者自托管部署

## Monorepo 结构

- [apps/core](./apps/core)：MX Space 服务端主程序
- [packages/api-client](./packages/api-client)：面向前端与第三方客户端的 API Client
- [packages/webhook](./packages/webhook)：Webhook SDK

## 适合谁

- 想搭建个人博客 CMS 的独立开发者
- 希望把 AI 摘要、翻译、审核能力接入内容站点的站长
- 需要一个可自托管、可二次开发的博客后端内核的开发者

## 技术栈

- `NestJS`
- `TypeScript`
- `MongoDB` / `Mongoose` / `TypeGoose`
- `Redis`
- `Zod`
- `Fastify`

## 快速开始

### 环境要求

- `Node.js >= 22`
- `pnpm`，推荐通过 `Corepack` 使用

```bash
corepack enable
pnpm i
```

### 常用命令

在仓库根目录执行：

- `pnpm dev`：启动 core 开发服务
- `pnpm build`：构建 core
- `pnpm bundle`：构建生产 bundle
- `pnpm test`：运行测试
- `pnpm lint`：运行 ESLint
- `pnpm typecheck`：运行 TypeScript 类型检查


## 升级指南

从 `v9` 升级到 `v10` 涉及鉴权体系重构，属于 breaking change。

详见 [Upgrading to v10](./docs/migrations/v10.md)。

## License

`apps/` 目录下的所有文件使用 `GNU Affero General Public License v3.0 (AGPLv3) with Additional Terms`。

仓库中其他部分使用 `MIT License`。

详见 [LICENSE](./LICENSE) 与 [ADDITIONAL_TERMS](./ADDITIONAL_TERMS.md)。
