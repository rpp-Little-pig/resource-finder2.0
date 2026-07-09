---
name: resource-finder
description: "创建、更新、调试或打包一个调用扣子工作流的本地 Windows Web 应用，用于搜索全网资源并清洗展示资源链接、平台、提取码和说明。适用于全网资源搜索界面、资源链接搜索器、接口驱动的本地应用、Windows exe 打包，以及 Resource Finder 模板维护。"
---

# Resource Finder

## 核心定位

Resource Finder 是一个面向全网资源搜索获取的本地工具。用户输入想找的资源关键词后，后端调用扣子工作流或资源搜索接口，前端把返回的链接、平台、提取码和说明整理成清晰卡片。

使用内置模板 `assets/app-template/` 作为起点。模板包含：

- `server.js`：本地 Node 后端，负责代理扣子工作流请求并清洗返回链接。
- `public/`：浏览器界面，用于输入资源关键词并展示清洗后的资源卡片。
- `.env.example`：配置项示例，不包含真实密钥。
- `scripts/ResourceFinderLauncher.cs`：Windows 双击启动器源码，可编译成 exe。

创建或更新应用时：

1. 将 `assets/app-template/` 复制到用户指定目录。
2. 基于 `.env.example` 创建 `.env`；不要把真实 Token 写进前端文件。
3. 配置 `COZE_WORKFLOW_ID`、`COZE_API_TOKEN` 和 `COZE_PARAMETER_KEY`，默认参数名为 `input`。
4. 浏览器只请求本地接口：`POST /api/search`，请求体为 `{ "query": "..." }`。
5. 由 `server.js` 请求扣子工作流：`POST https://api.coze.cn/v1/workflow/run`，请求体示例：

```json
{
  "workflow_id": "WORKFLOW_ID",
  "parameters": {
    "input": "USER_QUERY"
  }
}
```

6. 默认只展示清洗后的资源结果；只有用户明确要求排查问题时，才显示请求和原始返回内容。

## 界面规则

- 正常界面不要暴露 `Authorization`、原始请求体或完整工作流返回。
- 资源卡片必须显示在搜索区域下方。
- 如果页面展示第三方资源链接，需要保留免责声明。
- 优先展示平台名称和短链接摘要，避免直接把很长的原始 URL 堆在界面上。
- 每个资源链接都应提供复制和打开按钮。

## 数据清洗规则

保留模板中的清洗逻辑：

- 解析 `output`、`output1`、`output2`、`answer`、`result`、`content`、`text` 和 `message` 等字段。
- 提取 Markdown 链接，例如 `[点击打开](https://...)`。
- 对重复 URL 去重。
- 从 `提取码`、`访问码`、`密码`、`口令`、`code` 等标签中提取访问码。
- 识别常见平台，包括迅雷云盘、百度网盘、移动云盘、阿里云盘、夸克网盘、UC 网盘、蓝奏云、GitHub、Bilibili 和 YouTube。

## 调试排查

如果用户说扣子预览正常，但本地应用拿不到结果：

1. 确认工作流已经发布，并且开始节点参数名和 `COZE_PARAMETER_KEY` 一致。
2. 临时使用 `POST /api/debug-search` 检查后端发送的请求和扣子原始返回。
3. 如果本地返回为空但扣子预览有数据，检查工作流是否还需要额外开始节点参数；固定参数可写入 `COZE_STATIC_PARAMETERS_JSON`。
4. 如果后端无法连接扣子，检查本地代理或 TLS 设置，必要时配置 `HTTPS_PROXY`。

问题排查结束后，除非用户明确要求保留调试信息，否则从用户界面移除调试面板。

## Windows exe 打包

制作 Windows 可双击运行包时：

1. 编译 `scripts/ResourceFinderLauncher.cs`：

```powershell
& 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe' /nologo /target:winexe /out:ResourceFinder.exe scripts\ResourceFinderLauncher.cs
```

2. 将以下文件放在 `ResourceFinder.exe` 同级目录：

- `node.exe`
- `server.js`
- `public/`
- `.env`
- `.env.example`

3. 双击 `ResourceFinder.exe` 后，会启动 `node.exe server.js`，打开 `http://localhost:PORT/`，并把运行日志写入 `server.log`。

只有在环境可以安装 `postject` 等必要工具时，才考虑使用 Node SEA 或其他打包方案。
