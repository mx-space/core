# Class-Validator 迁移到 Zod v4 需求文档

## 一、项目背景

### 1.1 当前状态
- 使用 `class-validator@0.13.2` 和 `class-transformer@0.5.1` 进行 API 请求验证
- Model 文件同时承担数据库 schema 定义（TypeGoose `@prop()`）和 API 验证（class-validator 装饰器）
- 使用 `class-validator-jsonschema` 为配置页面生成 UI schema

### 1.2 迁移目标
- 完全移除 `class-validator` 和 `class-transformer` 依赖
- 使用 Zod v4 作为唯一的验证库
- 分离 Model（数据库）和 Schema（验证）的职责
- 保持所有现有 API 行为不变

### 1.3 统计数据
| 指标 | 数量 |
|------|------|
| 包含验证器的文件 | 67 个 |
| DTO 文件 | 28 个 |
| Model 文件使用验证器 | 15 个 |
| 自定义验证器 | 5 个 |
| class-transformer 使用文件 | 32 个 |
| 总验证装饰器使用 | 513+ 处 |

---

## 二、架构设计

### 2.1 目录结构变更

```
apps/core/src/
├── common/
│   ├── zod/                          # [新增] Zod 基础设施
│   │   ├── index.ts                  # 导出入口
│   │   ├── primitives.ts             # 基础类型 schema
│   │   ├── custom.ts                 # 自定义验证器
│   │   └── validation.pipe.ts        # Zod 验证管道
│   └── pipes/
│       └── validation.pipe.ts        # [修改] 切换到 Zod
├── shared/
│   ├── dto/                          # [修改] 迁移到 Zod
│   │   ├── id.dto.ts
│   │   ├── pager.dto.ts
│   │   └── file.dto.ts
│   ├── schema/                       # [新增] 共享 Zod schema
│   │   ├── base.schema.ts
│   │   ├── write-base.schema.ts
│   │   └── image.schema.ts
│   └── model/                        # [修改] 移除 class-validator
│       ├── base.model.ts
│       ├── write-base.model.ts
│       └── image.model.ts
└── modules/
    └── [module]/
        ├── [module].model.ts         # [修改] 仅保留 @prop()
        ├── [module].schema.ts        # [新增] Zod schema + DTO
        └── [module].controller.ts    # [修改] 使用新 DTO
```

### 2.2 文件职责划分

| 文件类型 | 职责 | 装饰器/方法 |
|----------|------|-------------|
| `*.model.ts` | 数据库 schema 定义 | `@prop()`, `@index()`, `@plugin()` |
| `*.schema.ts` | API 验证 + DTO 生成 | `z.object()`, `createZodDto()` |
| `*.dto.ts` | 查询参数等简单 DTO | `z.object()`, `createZodDto()` |

---

## 三、迁移清单

### 3.1 基础设施搭建

- [ ] **T1.1** 安装依赖：`zod`, `nestjs-zod`, `zod-to-json-schema`
- [ ] **T1.2** 创建 `common/zod/primitives.ts` - 基础类型 schema
- [ ] **T1.3** 创建 `common/zod/custom.ts` - 自定义验证器迁移
- [ ] **T1.4** 创建 `common/zod/validation.pipe.ts` - Zod 验证管道
- [ ] **T1.5** 修改 `bootstrap.ts` - 注册新的验证管道

### 3.2 共享层迁移

- [ ] **T2.1** 创建 `shared/schema/image.schema.ts`
- [ ] **T2.2** 创建 `shared/schema/base.schema.ts`
- [ ] **T2.3** 创建 `shared/schema/write-base.schema.ts`
- [ ] **T2.4** 迁移 `shared/dto/id.dto.ts`
- [ ] **T2.5** 迁移 `shared/dto/pager.dto.ts`
- [ ] **T2.6** 迁移 `shared/dto/file.dto.ts`
- [ ] **T2.7** 清理 `shared/model/*.ts` 中的 class-validator

### 3.3 业务模块迁移 - 第一批（简单模块）

- [ ] **T3.1** 迁移 `category` 模块
  - [ ] 创建 `category.schema.ts`
  - [ ] 清理 `category.model.ts`
  - [ ] 更新 `category.controller.ts`
  - [ ] 迁移 `category.dto.ts`

- [ ] **T3.2** 迁移 `link` 模块
  - [ ] 创建 `link.schema.ts`
  - [ ] 清理 `link.model.ts`
  - [ ] 更新 `link.controller.ts`
  - [ ] 迁移 `link.dto.ts`

- [ ] **T3.3** 迁移 `webhook` 模块
  - [ ] 创建 `webhook.schema.ts`
  - [ ] 清理 `webhook.model.ts`
  - [ ] 更新 `webhook.controller.ts`

- [ ] **T3.4** 迁移 `recently` 模块
  - [ ] 创建 `recently.schema.ts`
  - [ ] 清理 `recently.model.ts`
  - [ ] 更新 `recently.controller.ts`
  - [ ] 迁移 `recently.dto.ts`

### 3.4 业务模块迁移 - 第二批（核心模块）

- [ ] **T4.1** 迁移 `post` 模块
  - [ ] 创建 `post.schema.ts`
  - [ ] 清理 `post.model.ts`
  - [ ] 更新 `post.controller.ts`
  - [ ] 迁移 `post.dto.ts`

- [ ] **T4.2** 迁移 `note` 模块
  - [ ] 创建 `note.schema.ts`
  - [ ] 清理 `note.model.ts`
  - [ ] 更新 `note.controller.ts`
  - [ ] 迁移 `note.dto.ts`

- [ ] **T4.3** 迁移 `page` 模块
  - [ ] 创建 `page.schema.ts`
  - [ ] 清理 `page.model.ts`
  - [ ] 更新 `page.controller.ts`
  - [ ] 迁移 `page.dto.ts`

- [ ] **T4.4** 迁移 `snippet` 模块
  - [ ] 创建 `snippet.schema.ts`
  - [ ] 清理 `snippet.model.ts`
  - [ ] 更新 `snippet.controller.ts`
  - [ ] 迁移 `snippet.dto.ts`

### 3.5 业务模块迁移 - 第三批（特殊模块）

- [ ] **T5.1** 迁移 `comment` 模块
  - [ ] 创建 `comment.schema.ts`
  - [ ] 清理 `comment.model.ts`
  - [ ] 更新 `comment.controller.ts`
  - [ ] 迁移 `comment.dto.ts`
  - [ ] 更新 Gateway 相关验证

- [ ] **T5.2** 迁移 `user` 模块
  - [ ] 创建 `user.schema.ts`
  - [ ] 清理 `user.model.ts`
  - [ ] 更新 `user.controller.ts`
  - [ ] 迁移 `user.dto.ts`

- [ ] **T5.3** 迁移 `activity` 模块
  - [ ] 创建相关 schema
  - [ ] 迁移 DTO 文件

### 3.6 业务模块迁移 - 第四批（其他模块）

- [ ] **T6.1** 迁移 `ack` 模块
- [ ] **T6.2** 迁移 `aggregate` 模块
- [ ] **T6.3** 迁移 `ai` 模块（ai-summary, ai-writer）
- [ ] **T6.4** 迁移 `analyze` 模块
- [ ] **T6.5** 迁移 `file` 模块
- [ ] **T6.6** 迁移 `health` 模块
- [ ] **T6.7** 迁移 `markdown` 模块
- [ ] **T6.8** 迁移 `pageproxy` 模块
- [ ] **T6.9** 迁移 `search` 模块
- [ ] **T6.10** 迁移 `serverless` 模块
- [ ] **T6.11** 迁移 `subscribe` 模块
- [ ] **T6.12** 迁移 `update` 模块
- [ ] **T6.13** 迁移 `option` 模块（email.dto）

### 3.7 配置模块迁移（最复杂）

- [ ] **T7.1** 创建 `configs.schema.ts` - 所有配置项的 Zod schema
- [ ] **T7.2** 实现 JSON Schema 生成替代方案
- [ ] **T7.3** 迁移 UI options metadata
- [ ] **T7.4** 更新 `configs.controller.ts`
- [ ] **T7.5** 测试配置页面 UI 生成

### 3.8 Gateway 层迁移

- [ ] **T8.1** 迁移 `processors/gateway/web/dtos/message.ts`
- [ ] **T8.2** 更新 WebSocket 验证逻辑

### 3.9 清理工作

- [ ] **T9.1** 移除 `decorators/dto/` 下的自定义验证器文件
- [ ] **T9.2** 移除 `decorators/simpleValidatorFactory.ts`
- [ ] **T9.3** 移除 `common/decorators/transform-boolean.decorator.ts`
- [ ] **T9.4** 更新 `package.json` - 移除 class-validator 相关依赖
- [ ] **T9.5** 全局搜索并清理残留的 class-validator 导入
- [ ] **T9.6** 运行 lint 和类型检查

### 3.10 测试与验证

- [ ] **T10.1** 运行所有单元测试
- [ ] **T10.2** 运行所有 E2E 测试
- [ ] **T10.3** 手动测试核心 API 端点
- [ ] **T10.4** 验证配置页面 JSON Schema 生成
- [ ] **T10.5** 验证错误消息格式一致性

---

## 四、详细迁移规范

### 4.1 装饰器映射表

| class-validator | Zod v4 |
|-----------------|--------|
| `@IsString()` | `z.string()` |
| `@IsNotEmpty()` | `z.string().min(1)` |
| `@IsOptional()` | `.optional()` |
| `@IsInt()` | `z.number().int()` |
| `@IsBoolean()` | `z.boolean()` |
| `@IsEmail()` | `z.string().email()` 或 `z.email()` |
| `@IsUrl()` | `z.string().url()` 或 `z.url()` |
| `@IsMongoId()` | `z.string().regex(/^[0-9a-fA-F]{24}$/)` |
| `@IsEnum(E)` | `z.nativeEnum(E)` 或 `z.enum([...])` |
| `@IsIn([...])` | `z.enum([...])` |
| `@Min(n)` | `.min(n)` |
| `@Max(n)` | `.max(n)` |
| `@MinLength(n)` | `z.string().min(n)` |
| `@MaxLength(n)` | `z.string().max(n)` |
| `@IsArray()` | `z.array()` |
| `@ArrayUnique()` | `.refine(arr => new Set(arr).size === arr.length)` |
| `@ValidateNested()` | 直接嵌套 schema |
| `@IsDate()` | `z.date()` 或 `z.coerce.date()` |
| `@IsNumber()` | `z.number()` |
| `@IsObject()` | `z.object({})` 或 `z.record()` |
| `@IsIP()` | `z.string().ip()` |
| `@IsHexColor()` | `z.string().regex(/^#[0-9a-fA-F]{6}$/)` |
| `@Matches(regex)` | `z.string().regex(regex)` |
| `@ValidateIf()` | `.refine()` 或 `.superRefine()` |

### 4.2 class-transformer 映射表

| class-transformer | Zod |
|-------------------|-----|
| `@Transform()` | `z.preprocess()` 或 `.transform()` |
| `@Type(() => Class)` | 直接嵌套对应 schema |
| `@Expose()` | N/A（Zod 不处理序列化） |
| `@Exclude()` | N/A（Zod 不处理序列化） |

### 4.3 自定义验证器迁移

```typescript
// 迁移前: IsNilOrString
@IsNilOrString()
field?: string | null

// 迁移后
field: z.string().nullable().optional()
```

```typescript
// 迁移前: IsAllowedUrl
@IsAllowedUrl()
url: string

// 迁移后
url: z.string().refine(
  (val) => /^https?:\/\/[^\s]+$/.test(val),
  { message: '请更正为正确的网址' }
)
```

```typescript
// 迁移前: TransformEmptyNull
@TransformEmptyNull()
field: string | null

// 迁移后
field: z.preprocess(
  (val) => (val === '' ? null : val),
  z.string().nullable()
).optional()
```

### 4.4 错误消息格式

保持与原有格式一致：
```typescript
// 原 class-validator
@IsString({ message: '标题必须是字符串' })
@MaxLength(20, { message: '标题太长了' })

// Zod
z.string({ message: '标题必须是字符串' })
 .max(20, '标题太长了')
```

### 4.5 DTO 生成模式

```typescript
// apps/core/src/modules/post/post.schema.ts
import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

// 1. 定义 Schema
export const PostSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  // ...
})

// 2. 生成 DTO 类
export class PostDto extends createZodDto(PostSchema) {}

// 3. Partial 版本
export const PartialPostSchema = PostSchema.partial()
export class PartialPostDto extends createZodDto(PartialPostSchema) {}

// 4. 类型导出
export type PostInput = z.infer<typeof PostSchema>
```

---

## 五、风险与注意事项

### 5.1 破坏性变更风险
- 验证错误响应格式可能略有不同
- 某些边界情况的验证行为可能有差异

### 5.2 兼容性注意
- `nestjs-zod` 需要 NestJS 8+
- Zod v4 的部分 API 与 v3 不同

### 5.3 测试重点
- 所有必填字段验证
- 可选字段默认值
- 嵌套对象验证
- 数组验证
- 类型转换（字符串转数字等）
- 自定义验证器

---

## 六、回滚方案

如果迁移过程中遇到严重问题：
1. 保留原有 class-validator 代码（注释状态）
2. 可以通过 git revert 快速回滚
3. 建议在独立分支进行迁移

---

## 七、预期收益

1. **更好的类型推断** - Zod 的 `z.infer<>` 提供精确类型
2. **更小的 bundle** - Zod 比 class-validator + class-transformer 更轻量
3. **更活跃的维护** - Zod 社区活跃，class-validator 维护停滞
4. **统一的验证方案** - 可在前后端共用 schema
5. **更简洁的代码** - 函数式 API vs 装饰器堆叠
