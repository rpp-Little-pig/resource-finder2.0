# Coze Resource Finder

一个本地资源链接搜索器。用户在页面输入想找的资源名称，后端会调用扣子 / Coze 工作流接口，并把工作流返回的资料链接清洗、去重、提取提取码后展示成卡片。

## 功能特点

- 本地 Web 界面，浏览器访问 `http://localhost:5177`
- 后端代理调用扣子工作流，前端不会暴露 `Authorization`
- 自动识别并展示资源链接、平台、提取码和简短说明
- 支持常见网盘平台：迅雷云盘、百度网盘、移动云盘、阿里云盘、夸克网盘、UC 网盘、蓝奏云等
- 支持将应用打包成 Windows 双击启动器

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
- 不要把带真实 `.env` 的压缩包上传到公开仓库。
- 前端不会直接调用扣子 API，避免在浏览器里暴露 Token。

## 免责声明

本项目仅对接口返回的资料链接进行整理展示，不存储资源文件，也不保证链接的有效性、合法性与安全性。请在遵守法律法规和版权要求的前提下使用。
