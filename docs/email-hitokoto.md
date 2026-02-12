# 邮件一言功能

## 概述

MX Space 现在支持在发送邮件时自动获取并插入随机一言（Hitokoto）。一言是一个提供随机名言警句的服务，可以为你的邮件增添文化气息。

## 配置

### 1. 启用一言功能

在管理后台的 **设置** → **邮件通知设置** → **一言设置** 中：

- **启用一言**: 开启/关闭一言功能
- **一言 API 地址**: 配置一言 API 的地址，默认为 `https://v1.hitokoto.cn`

### 2. 配置示例

```json
{
  "mailOptions": {
    "enable": true,
    "hitokoto": {
      "enable": true,
      "api": "https://v1.hitokoto.cn"
    }
  }
}
```

## 在邮件模板中使用

一言数据会自动注入到所有邮件模板的渲染上下文中，你可以在自定义邮件模板中使用以下变量：

### 可用变量

- `hitokoto`: 一言对象，包含以下属性：
  - `text`: 一言内容（字符串）
  - `from`: 一言出处（字符串）
  - `author`: 一言作者（字符串，可选）

### 模板示例

在 EJS 邮件模板中使用一言：

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>邮件通知</title>
</head>
<body>
  <!-- 你的邮件内容 -->
  <div>
    <h2>你好，<%= owner %></h2>
    <p>这是一封来自 MX Space 的通知邮件。</p>
  </div>

  <!-- 一言部分 -->
  <% if (hitokoto) { %>
  <div style="margin-top: 30px; padding: 15px; background: #f5f5f5; border-left: 4px solid #1890ff;">
    <p style="margin: 0; font-style: italic; color: #333;">
      「<%= hitokoto.text %>」
    </p>
    <p style="margin: 10px 0 0; font-size: 12px; color: #999; text-align: right;">
      ——
      <% if (hitokoto.author) { %>
        <%= hitokoto.author %>《<%= hitokoto.from %>》
      <% } else { %>
        《<%= hitokoto.from %>》
      <% } %>
    </p>
  </div>
  <% } %>

  <!-- 邮件底部 -->
  <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999;">
    <p>此邮件由系统自动发送，请勿直接回复。</p>
  </div>
</body>
</html>
```

### 简单示例

如果只想在邮件底部添加一言：

```html
<!-- 邮件内容 -->

<% if (hitokoto) { %>
<hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
<p style="font-style: italic; color: #666;">
  <%= hitokoto.text %>
  <% if (hitokoto.author) { %>
    —— <%= hitokoto.author %>
  <% } %>
</p>
<% } %>
```

## 注意事项

1. **网络请求**: 一言数据通过网络请求获取，设置了 5 秒超时时间
2. **失败处理**: 如果获取一言失败（网络问题、超时等），`hitokoto` 变量会是 `null`，不会影响邮件发送
3. **性能考虑**: 一言 API 调用是异步的，不会阻塞邮件发送流程
4. **自定义 API**: 你可以使用自己搭建的一言 API 服务，只需在配置中修改 API 地址

## API 返回格式

一言 API 返回的数据格式示例：

```json
{
  "id": 1,
  "uuid": "abc123",
  "hitokoto": "那些看似不起波澜的日复一日，会突然在某一天让你看到坚持的意义。",
  "type": "a",
  "from": "你的名字",
  "from_who": "新海诚",
  "creator": "hitokoto",
  "creator_uid": 1,
  "reviewer": 0,
  "commit_from": "web",
  "created_at": "2023-01-01",
  "length": 30
}
```

实际在模板中可用的数据经过简化处理：

```javascript
{
  text: "那些看似不起波澜的日复一日，会突然在某一天让你看到坚持的意义。",
  from: "你的名字",
  author: "新海诚"  // 可选
}
```

## 自定义一言源

你可以使用其他兼容的一言 API，只要返回格式包含以下字段：

- `hitokoto`: 一言内容
- `from`: 出处
- `from_who`: 作者（可选）

推荐的一言 API:

- [官方 API](https://v1.hitokoto.cn)
- [Hitokoto 国际版](https://international.v1.hitokoto.cn)
- 自建服务: 参考 [Hitokoto API 文档](https://hitokoto.cn/api)
