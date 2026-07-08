import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = resolve(fileURLToPath(new URL(".", import.meta.url)));
const publicDir = join(__dirname, "public");

loadEnv(join(__dirname, ".env"));

const port = Number(process.env.PORT || 5177);
const apiBase = (process.env.COZE_API_BASE || "https://api.coze.cn").replace(/\/$/, "");
const workflowId = process.env.COZE_WORKFLOW_ID || "7659629634601959458";
const token = process.env.COZE_API_TOKEN || "";
const defaultParameterKey = normalizeParameterKey(process.env.COZE_PARAMETER_KEY || "input");
const botId = String(process.env.COZE_BOT_ID || "").trim();
const appId = String(process.env.COZE_APP_ID || "").trim();
const workflowVersion = String(process.env.COZE_WORKFLOW_VERSION || "").trim();
const staticParameters = parseObjectEnv(process.env.COZE_STATIC_PARAMETERS_JSON);
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy;

await configureProxy(proxyUrl);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, {
        ok: true,
        configured: Boolean(token && workflowId),
        workflowId
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/search") {
      await handleSearch(req, res, false);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/debug-search") {
      await handleSearch(req, res, true);
      return;
    }

    if (req.method === "GET") {
      serveStatic(url.pathname, res);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(res, 500, {
      error: "服务器开小差了，请稍后重试。",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

server.listen(port, () => {
  console.log(`Coze resource finder running at http://localhost:${port}`);
});

async function handleSearch(req, res, debug = false) {
  if (!token) {
    sendJson(res, 500, {
      error: "缺少 COZE_API_TOKEN，请在 .env 中配置扣子访问令牌。"
    });
    return;
  }

  const body = await readJsonBody(req);
  const query = String(body.query || "").trim();
  const parameterKey = normalizeParameterKey(body.parameterKey || defaultParameterKey);

  if (!query) {
    sendJson(res, 400, { error: "请输入要搜索的资源。" });
    return;
  }

  const cozePayload = {
    workflow_id: workflowId,
    parameters: {
      ...staticParameters,
      [parameterKey]: query
    }
  };

  if (appId) {
    cozePayload.app_id = appId;
  } else if (botId) {
    cozePayload.bot_id = botId;
  }

  if (workflowVersion) {
    cozePayload.workflow_version = workflowVersion;
  }

  let cozeResponse;
  try {
    cozeResponse = await fetch(`${apiBase}/v1/workflow/run`, {
      method: "POST",
      headers: {
        Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(cozePayload)
    });
  } catch (error) {
    sendJson(res, 502, {
      error: "无法连接扣子 API，请检查当前网络、代理或证书设置。",
      detail: describeNetworkError(error),
      hint: "如果浏览器能访问扣子但 Node 不能访问，可在 .env 中配置 HTTPS_PROXY，例如 HTTPS_PROXY=http://127.0.0.1:7897。",
      cozeRequest: buildRequestPreview(cozePayload)
    });
    return;
  }

  const responseText = await cozeResponse.text();
  const cozeJson = parseMaybeJson(responseText) ?? { raw: responseText };

  if (!cozeResponse.ok || cozeJson.code) {
    sendJson(res, cozeResponse.ok ? 502 : cozeResponse.status, {
      error: cozeJson.msg || cozeJson.message || "扣子工作流调用失败。",
      code: cozeJson.code,
      cozeRequest: buildRequestPreview(cozePayload),
      raw: cozeJson
    });
    return;
  }

  const workflowData = parseMaybeJsonDeep(cozeJson.data ?? cozeJson);
  const fullOutput = stringifyHumanAnswer(workflowData);
  const links = extractLinks(workflowData);
  const answer = cleanDisplayText(fullOutput, links);

  const responsePayload = {
    query,
    links,
    answer
  };

  if (debug) {
    responsePayload.debug = {
      requestPayload: cozePayload,
      cozeCode: cozeJson.code,
      cozeMessage: cozeJson.msg || cozeJson.message || "",
      workflowData,
      answerBeforeClean: fullOutput
    };
  }

  sendJson(res, 200, responsePayload);
}

function serveStatic(pathname, res) {
  const safePath = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const normalized = resolve(join(publicDir, safePath));

  if (!normalized.startsWith(publicDir)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  if (!existsSync(normalized)) {
    sendText(res, 404, "Not found");
    return;
  }

  const ext = extname(normalized);
  res.writeHead(200, {
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  res.end(readFileSync(normalized));
}

function readJsonBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        req.destroy();
        rejectBody(new Error("请求内容太大。"));
      }
    });
    req.on("end", () => {
      resolveBody(parseMaybeJson(raw) || {});
    });
    req.on("error", rejectBody);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function buildRequestPreview(body) {
  return {
    url: `${apiBase}/v1/workflow/run`,
    method: "POST",
    headers: {
      Authorization: "Bearer ***",
      "Content-Type": "application/json"
    },
    body
  };
}

function loadEnv(filePath) {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

async function configureProxy(url) {
  if (!url) return;

  try {
    const { ProxyAgent, setGlobalDispatcher } = await import("undici");
    setGlobalDispatcher(new ProxyAgent(url));
  } catch {
    console.warn("HTTPS_PROXY is configured, but the optional undici proxy agent is not available.");
  }
}

function describeNetworkError(error) {
  const parts = [];
  if (error instanceof Error && error.message) parts.push(error.message);
  if (error?.cause?.code) parts.push(error.cause.code);
  if (error?.cause?.message) parts.push(error.cause.message);
  return parts.join(" | ") || String(error);
}

function normalizeParameterKey(value) {
  const key = String(value || "input").trim();
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? key : "input";
}

function parseMaybeJson(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function parseMaybeJsonDeep(value) {
  let current = value;
  for (let i = 0; i < 4; i += 1) {
    const parsed = parseMaybeJson(current);
    if (parsed === current) break;
    current = parsed;
  }
  return current;
}

function parseObjectEnv(value) {
  if (!value || !String(value).trim()) return {};

  const parsed = parseMaybeJson(value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

function extractLinks(data) {
  const found = [];
  const seen = new Set();

  visit(data, undefined);

  return found;

  function visit(value, context) {
    const parsed = parseMaybeJsonDeep(value);

    if (typeof parsed === "string") {
      addLinksFromText(parsed, context);
      return;
    }

    if (Array.isArray(parsed)) {
      for (const item of parsed) visit(item, context);
      return;
    }

    if (parsed && typeof parsed === "object") {
      const title =
        firstString(parsed.title, parsed.name, parsed.resource, parsed.label, parsed.filename, parsed.file_name) ||
        context;
      const note = firstString(parsed.description, parsed.desc, parsed.summary, parsed.note, parsed.remark);
      const code = findAccessCode(firstString(parsed.code, parsed.access_code, parsed.password, parsed.passcode, note));

      for (const [key, value] of Object.entries(parsed)) {
        const parsedValue = parseMaybeJsonDeep(value);
        if (typeof parsedValue === "string" && /(url|link|href|链接|地址)/i.test(key)) {
          for (const url of findUrls(parsedValue)) {
            addLink(url, {
              title,
              note,
              accessCode: code || findAccessCode(parsedValue)
            });
          }
        }
        visit(parsedValue, title);
      }
    }
  }

  function addLinksFromText(text, context) {
    const normalized = normalizeText(text);
    const markdownLinks = findMarkdownLinks(normalized);
    const lines = normalized
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    for (const item of markdownLinks) {
      const lineIndex = lines.findIndex(candidate => candidate.includes(item.url));
      const line = lineIndex >= 0 ? lines[lineIndex] : item.title;
      const blockText = blockTextFromLines(lines, lineIndex);
      addLink(item.url, {
        title: blockTitleFromLines(lines, lineIndex) || cleanTitle(item.title) || cleanTitle(context),
        note: cleanNote(blockText || line),
        accessCode: findAccessCode(blockText || line)
      });
    }

    lines.forEach((line, index) => {
      for (const url of findUrls(line)) {
        const markdownTitle = markdownLinks.find(item => item.url === url)?.title;
        const nearby = blockTextFromLines(lines, index);
        const title =
          blockTitleFromLines(lines, index) ||
          cleanTitle(markdownTitle) ||
          titleFromUrlLine(line) ||
          titleFromNearbyLines(lines, index) ||
          cleanTitle(context) ||
          platformFromUrl(url);

        addLink(url, {
          title,
          note: cleanNote(nearby),
          accessCode: findAccessCode(nearby)
        });
      }
    });
  }

  function addLink(url, detail = {}) {
    const cleanUrl = cleanTrailingPunctuation(url);
    const key = normalizeUrlKey(cleanUrl);
    if (seen.has(key) || isInternalUrl(cleanUrl)) return;

    seen.add(key);
    found.push({
      url: cleanUrl,
      title: detail.title && detail.title !== cleanUrl ? detail.title : platformFromUrl(cleanUrl),
      domain: domainFromUrl(cleanUrl),
      platform: platformFromUrl(cleanUrl),
      displayUrl: compactUrl(cleanUrl),
      accessCode: detail.accessCode || "",
      note: detail.note || ""
    });
  }
}

function findUrls(text) {
  return String(text).match(/https?:\/\/[^\s"'<>，。；、\]）]+/g) || [];
}

function findMarkdownLinks(text) {
  const matches = [];
  const pattern = /\[([^\]\n]{1,120})\]\((https?:\/\/[^)\s]+)\)/g;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    matches.push({
      title: match[1],
      url: cleanTrailingPunctuation(match[2])
    });
  }

  return matches;
}

function cleanTrailingPunctuation(url) {
  return url.replace(/[.,;:!?，。；：！？)）]+$/g, "");
}

function normalizeUrlKey(url) {
  try {
    const parsed = new URL(url);
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return String(url).trim().toLowerCase();
  }
}

function isInternalUrl(url) {
  try {
    const parsed = new URL(url);
    return /(^|\.)coze\.(cn|com)$/.test(parsed.hostname) && /debug|workflow|history/i.test(url);
  } catch {
    return false;
  }
}

function domainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "资源链接";
  }
}

function platformFromUrl(url) {
  const domain = domainFromUrl(url);
  const rules = [
    [/yun\.139\.com/i, "移动云盘"],
    [/pan\.baidu\.com/i, "百度网盘"],
    [/(aliyundrive|alipan)\.com/i, "阿里云盘"],
    [/drive\.uc\.cn/i, "UC 网盘"],
    [/pan\.quark\.cn/i, "夸克网盘"],
    [/pan\.xunlei\.com/i, "迅雷云盘"],
    [/lanzou[a-z]?\.com/i, "蓝奏云"],
    [/115\.com/i, "115 网盘"],
    [/github\.com/i, "GitHub"],
    [/bilibili\.com/i, "哔哩哔哩"],
    [/youtube\.com|youtu\.be/i, "YouTube"]
  ];
  const match = rules.find(([pattern]) => pattern.test(domain));
  return match ? match[1] : domain;
}

function compactUrl(url) {
  try {
    const parsed = new URL(url);
    const pathname = decodeURIComponent(parsed.pathname).replace(/\/$/, "");
    const shortPath = pathname && pathname !== "/" ? pathname.split("/").filter(Boolean).slice(0, 2).join("/") : "";
    return [parsed.hostname.replace(/^www\./, ""), shortPath].filter(Boolean).join("/");
  } catch {
    return String(url).slice(0, 80);
  }
}

function normalizeText(text) {
  return String(text)
    .replace(/\\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanTitle(text) {
  if (!text) return "";

  const clean = normalizeText(text)
    .replace(/\[[^\]]+\]\((https?:\/\/[^)]+)\)/g, "$1")
    .replace(/https?:\/\/[^\s"'<>，。；、\]）]+/g, "")
    .replace(/^(资源名称|资源名|名称|标题|链接|地址|下载地址|网盘链接|资料链接|url|URL)\s*[:：-]\s*/i, "")
    .replace(/^[-*•\d.、\s]+/, "")
    .replace(/[「」《》【】]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean || isGenericLine(clean)) return "";
  return clean.length > 48 ? `${clean.slice(0, 48)}...` : clean;
}

function titleFromUrlLine(line) {
  const beforeUrl = String(line).split(/https?:\/\//)[0];
  return cleanTitle(beforeUrl);
}

function titleFromNearbyLines(lines, index) {
  const candidates = [lines[index - 1], lines[index - 2], lines[index - 3], lines[index + 1]]
    .filter(Boolean)
    .map(cleanTitle)
    .filter(Boolean);

  return candidates.find(candidate => !findUrls(candidate).length) || "";
}

function blockTitleFromLines(lines, index) {
  if (index < 0) return "";

  for (let offset = 1; offset <= 6; offset += 1) {
    const line = lines[index - offset];
    if (!line) break;
    if (findUrls(line).length || findAccessCode(line) || /^[-*•\s]*(链接|地址|下载|提取码|访问码|密码|口令)\s*[:：]?/i.test(line)) {
      continue;
    }

    const title = cleanTitle(line);
    if (title) return title;
  }

  return "";
}

function blockTextFromLines(lines, index) {
  if (index < 0) return "";

  const start = Math.max(0, index - 4);
  const end = Math.min(lines.length, index + 3);
  return lines.slice(start, end).join("\n");
}

function cleanNote(text) {
  const clean = normalizeText(text)
    .replace(/\[[^\]]+\]\((https?:\/\/[^)]+)\)/g, "")
    .replace(/https?:\/\/[^\s"'<>，。；、\]）]+/g, "")
    .split(/\n/)
    .map(line =>
      line
        .replace(/^[-*•\d.、\s]+/, "")
        .replace(/^(资源名称|资源名|名称|标题|链接|地址|下载地址|网盘链接|资料链接|url|URL)\s*[:：-]\s*/i, "")
        .trim()
    )
    .filter(line => line && !isGenericLine(line))
    .join(" · ")
    .replace(/\s+/g, " ")
    .trim();

  return clean.length > 120 ? `${clean.slice(0, 120)}...` : clean;
}

function cleanDisplayText(text, links = []) {
  let clean = cleanNote(text);
  for (const link of links) {
    clean = clean.replace(link.title, "").replace(link.platform, "");
    if (link.accessCode) clean = clean.replace(link.accessCode, "");
  }
  clean = clean.replace(/[·\s]+/g, " ").trim();
  return clean.length > 180 ? `${clean.slice(0, 180)}...` : clean;
}

function findAccessCode(text) {
  const match = String(text).match(/(?:提取码|访问码|密码|口令|code|Code|CODE)\s*[:：]?\s*([A-Za-z0-9]{3,12})/);
  return match ? match[1] : "";
}

function isGenericLine(text) {
  return /^(以下|这里|为你|找到|相关|资源|资料|链接|地址|下载|搜索结果|推荐|暂无|无|点击打开|打开|查看|查看链接)$/i.test(text.trim()) ||
    /^(提取码|访问码|密码|口令)\s*[:：]/i.test(text.trim());
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function stringifyHumanAnswer(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value) || (value && typeof value === "object")) {
    const output = firstString(
      value.output,
      value.output1,
      value.output2,
      value.data,
      value.answer,
      value.result,
      value.content,
      value.text,
      value.message
    );
    if (output) return output;
    return JSON.stringify(value, null, 2);
  }
  return String(value ?? "");
}
