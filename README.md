# Mix Space Core

本项目使用 Monorepo 进行管理。

- [core](./apps/core): Server Core 主程序
- [api-client](./packages/api-client)：适用于前端的 API client 
- [webhook](./packages/webhook): Webhook SDK

## 环境要求

- **Node.js**: >= 22（仓库根目录提供了 `.nvmrc`）
- **pnpm**: 使用 Corepack（推荐）  
  - 启用：`corepack enable`
  - 安装依赖：`pnpm i`

## 开发

在仓库根目录执行：

- `pnpm dev`：启动 core 开发服务
- `pnpm build`：构建 core
- `pnpm bundle`：打 bundle（用于发布/部署）
- `pnpm test`：运行测试
- `pnpm lint`：运行 ESLint

# 许可

此项目在 `apps/` 目录下的所有文件均使用 GNU Affero General Public License v3.0 (AGPLv3) with Additional Terms (ADDITIONAL_TERMS) 许可。

其他部分使用 MIT License 许可。

详情请查看 [LICENSE](./LICENSE) 和 [ADDITIONAL_TERMS](./ADDITIONAL_TERMS.md)。