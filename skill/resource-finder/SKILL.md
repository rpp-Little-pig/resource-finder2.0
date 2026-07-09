---
name: resource-finder
description: Build, update, debug, or package a local Windows web app that calls a Coze/扣子 workflow to search full-web resources and display cleaned links, platforms, access codes, and notes. Use when the user asks for a full-web resource search UI, resource-link finder, API-backed local app, Windows exe packaging, or modifications to this Resource Finder template.
---

# Resource Finder

## Core Workflow

Use the bundled template at `assets/app-template/` as the starting point. The app is positioned as a full-web resource search and acquisition helper: users enter keywords, the backend calls a resource search workflow, and the UI turns returned links into clear cards. It contains:

- `server.js`: local Node backend that proxies Coze workflow calls and cleans returned links.
- `public/`: browser UI for entering a resource name and displaying cleaned cards.
- `.env.example`: configuration keys without secrets.
- `scripts/ResourceFinderLauncher.cs`: Windows launcher source for creating a double-click exe wrapper.

When creating or updating an app:

1. Copy `assets/app-template/` to the user's target directory.
2. Create `.env` from `.env.example`; never hardcode tokens in frontend files.
3. Set `COZE_WORKFLOW_ID`, `COZE_API_TOKEN`, and `COZE_PARAMETER_KEY` (`input` by default).
4. Keep the browser request local: `POST /api/search` with `{ "query": "..." }`.
5. Let `server.js` call `POST https://api.coze.cn/v1/workflow/run` with:

```json
{
  "workflow_id": "WORKFLOW_ID",
  "parameters": {
    "input": "USER_QUERY"
  }
}
```

6. Show cleaned results only unless the user explicitly asks for debugging output.

## UI Rules

- Do not expose `Authorization`, raw request payloads, or full workflow output in the normal UI.
- Display resource cards below the search area.
- Keep the disclaimer visible if the app lists third-party resource links.
- Prefer platform labels and short display URLs over long raw URLs.
- Include copy/open buttons for each resource link.

## Cleaning Behavior

Preserve the template's cleaning approach:

- Parse `output`, `output1`, `output2`, `answer`, `result`, `content`, `text`, and `message`.
- Extract markdown links such as `[点击打开](https://...)`.
- Deduplicate URLs.
- Extract access codes from labels such as `提取码`, `访问码`, `密码`, `口令`, or `code`.
- Recognize common platforms including 迅雷云盘, 百度网盘, 移动云盘, 阿里云盘, 夸克网盘, UC 网盘, 蓝奏云, GitHub, Bilibili, and YouTube.

## Debugging

If the user says the Coze preview works but the app does not:

1. Confirm the workflow is published and the start node parameter name matches `COZE_PARAMETER_KEY`.
2. Use `POST /api/debug-search` temporarily to inspect the backend request and raw workflow data.
3. If the app receives empty output but Coze preview has data, check whether the workflow needs additional start-node parameters. Put fixed values in `COZE_STATIC_PARAMETERS_JSON`.
4. If the backend cannot connect to Coze, check local proxy/TLS settings and optionally set `HTTPS_PROXY`.

Remove debug panels from the user-facing UI after troubleshooting unless explicitly requested.

## Windows Exe Packaging

For a practical Windows package:

1. Compile `scripts/ResourceFinderLauncher.cs` with:

```powershell
& 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe' /nologo /target:winexe /out:ResourceFinder.exe scripts\ResourceFinderLauncher.cs
```

2. Place these files beside `ResourceFinder.exe`:

- `node.exe`
- `server.js`
- `public/`
- `.env`
- `.env.example`

3. Double-clicking `ResourceFinder.exe` starts `node.exe server.js`, opens `http://localhost:PORT/`, and writes runtime logs to `server.log`.

Use Node SEA or another packager only when the environment can install the required tooling such as `postject`.
