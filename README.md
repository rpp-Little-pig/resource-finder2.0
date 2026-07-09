# Resource Finder

Resource Finder 是一个全网网盘资源链接搜索器，也是一个面向全网资源搜索获取的本地工具。用户输入想找的影视、课程、软件、资料或其他关键词后，系统会调用资源搜索接口检索全网可访问的资源线索，并把返回的资料链接清洗、去重、提取提取码后展示成卡片。

它不是个人资源库，也不是“整理自己的资源”的工具；它的定位是一个“全网资源链接搜索入口”，负责把接口返回的搜索结果整理成更容易打开、复制和使用的形式。

## 功能特点

- 全网资源关键词搜索，适合查找影视、课程、工具、文档、素材等资源线索
- 本地 Web 界面，浏览器访问 `http://localhost:5177`
- 后端代理调用资源搜索接口，前端不会暴露 `Authorization`
- 自动清洗接口返回内容，识别并展示资源链接、平台、提取码和简短说明
- 支持常见网盘平台：迅雷云盘、百度网盘、移动云盘、阿里云盘、夸克网盘、UC 网盘、蓝奏云等
- 支持将应用打包成 Windows 双击启动器

## 最简单的使用方式（Windows）

如果你只是想直接使用，不想安装 Node.js：

1. 打开本仓库的 Releases 页面。
2. 下载 `resource-finder-windows.zip`。
3. 解压整个压缩包。
4. 打开 `.env`，填写作者 Token：

```env
COZE_API_TOKEN=your_coze_token_here
```

5. 双击 `ResourceFinder.exe`。
6. 浏览器会自动打开 `http://localhost:5177`。

压缩包里已经包含 `node.exe`、`ResourceFinder.exe`、服务端代码和前端页面。不要只单独下载 exe，必须保留整个文件夹。

## 作为 Codex Skill 使用

仓库内提供了技能目录：

```text
skill/resource-finder/
```

安装方式：

1. 下载本仓库，或从 Release 下载 `resource-finder-skill.zip`。
2. 把 `resource-finder` 文件夹复制到你的 Codex skills 目录，例如：

```powershell
copy skill\resource-finder $env:USERPROFILE\.codex\skills\resource-finder -Recurse
```

3. 之后可以在 Codex 中这样使用：

```text
Use $resource-finder to create or update a local Coze workflow app for searching and displaying full-web resource links.
```

说明：skill 里只包含模板和流程说明，不包含真实 API Token。生成应用后仍需要在 `.env` 中配置自己的 `COZE_API_TOKEN`，或使用你自己部署的后端代理。

## 项目结构

```text
.
├── public/
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── scripts/
│   └── ResourceFinderLauncher.cs
├── server.js
├── package.json
├── .env.example
└── README.md
```

## 运行环境

- Node.js 18 或更高版本
- 一个已发布的扣子工作流
- 扣子 API Token，并且具备运行工作流的权限

## 配置

复制 `.env.example` 为 `.env`：

```powershell
copy .env.example .env
```

然后编辑 `.env`：

```env
COZE_API_TOKEN=your_coze_token_here
COZE_WORKFLOW_ID=7659629634601959458
COZE_PARAMETER_KEY=input
COZE_APP_ID=
COZE_BOT_ID=
COZE_WORKFLOW_VERSION=
COZE_STATIC_PARAMETERS_JSON={}
COZE_API_BASE=https://api.coze.cn
PORT=5177
```

常用配置说明：

- `COZE_API_TOKEN`：扣子访问令牌，不要提交到 GitHub。
- `COZE_WORKFLOW_ID`：工作流 ID。
- `COZE_PARAMETER_KEY`：开始节点入参名，默认是 `input`。
- `COZE_STATIC_PARAMETERS_JSON`：如果工作流开始节点还有固定参数，可以放在这里，例如：

```env
COZE_STATIC_PARAMETERS_JSON={"max_wait_seconds":20,"refresh_token":"your_value"}
```

## 本地启动

```powershell
npm start
```

打开：

```text
http://localhost:5177
```

## 请求流程

浏览器只请求本地后端：

```http
POST /api/search
Content-Type: application/json
```

```json
{
  "query": "指环王"
}
```

本地后端再请求扣子：

```http
POST https://api.coze.cn/v1/workflow/run
Authorization: Bearer <COZE_API_TOKEN>
Content-Type: application/json
```

```json
{
  "workflow_id": "7659629634601959458",
  "parameters": {
    "input": "指环王"
  }
}
```

## Windows 打包

项目提供了一个 C# 启动器源码：`scripts/ResourceFinderLauncher.cs`。

编译启动器：

```powershell
& 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe' /nologo /target:winexe /out:ResourceFinder.exe scripts\ResourceFinderLauncher.cs
```

打包目录建议包含：

```text
ResourceFinder.exe
node.exe
server.js
public/
.env
.env.example
```

双击 `ResourceFinder.exe` 后会启动本地服务并自动打开浏览器。

## 安全说明

- 不要提交 `.env`，里面包含真实 API Token。
- 不要把带真实 token 的 `.env` 上传到 GitHub，也不要放进公开压缩包。
- 前端不会直接调用扣子 API，避免在浏览器里暴露 Token。
- Release 压缩包内的 `.env` 只应包含占位符，使用者需要填写自己的 token。

## 免责声明

本项目仅对接口检索到的全网资源链接进行整理展示，不存储、不上传、不分发任何资源文件，也不保证链接的有效性、合法性与安全性。请在遵守法律法规、平台规则和版权要求的前提下使用。
