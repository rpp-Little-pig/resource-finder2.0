const form = document.querySelector("#search-form");
const queryInput = document.querySelector("#query");
const submitButton = document.querySelector("#submit-button");
const statusPill = document.querySelector("#status-pill");
const emptyState = document.querySelector("#empty-state");
const errorBox = document.querySelector("#error-box");
const results = document.querySelector("#results");

document.querySelectorAll("[data-example]").forEach(button => {
  button.addEventListener("click", () => {
    queryInput.value = button.dataset.example || "";
    queryInput.focus();
  });
});

form.addEventListener("submit", async event => {
  event.preventDefault();

  const query = queryInput.value.trim();
  if (!query) return;

  setLoading(true);
  clearResults();

  try {
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(formatApiError(data));
    }

    renderResults(data);
  } catch (error) {
    showError(error instanceof Error ? error.message : "请求失败，请稍后重试。");
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.classList.toggle("loading", isLoading);
  statusPill.textContent = isLoading ? "接口调用中" : statusPill.textContent;
  statusPill.className = "status-pill";
}

function clearResults() {
  results.innerHTML = "";
  errorBox.hidden = true;
  errorBox.textContent = "";
  emptyState.hidden = false;
}

function renderResults(data) {
  emptyState.hidden = true;
  const links = Array.isArray(data.links) ? data.links : [];

  if (links.length) {
    statusPill.textContent = `找到 ${links.length} 个链接`;
    statusPill.className = "status-pill success";

    const fragment = document.createDocumentFragment();
    links.forEach((link, index) => fragment.appendChild(createLinkCard(link, index)));
    results.appendChild(fragment);
  } else {
    statusPill.textContent = "已返回内容";
    statusPill.className = "status-pill success";
    results.innerHTML = `
      <div class="answer-box">${escapeHtml(data.answer || "接口返回了内容，但没有识别到 URL。")}</div>
    `;
  }

}

function createLinkCard(link, index) {
  const article = document.createElement("article");
  article.className = "result-card";

  const top = document.createElement("div");
  top.className = "result-card-top";

  const indexBadge = document.createElement("span");
  indexBadge.className = "result-index";
  indexBadge.textContent = String(index + 1).padStart(2, "0");

  const platform = document.createElement("span");
  platform.className = "platform-badge";
  platform.textContent = link.platform || link.domain || "资源链接";

  top.append(indexBadge, platform);

  const anchor = document.createElement("a");
  anchor.className = "resource-title";
  anchor.href = link.url;
  anchor.target = "_blank";
  anchor.rel = "noreferrer";
  anchor.textContent = cleanCardTitle(link.title, link.platform);

  const meta = document.createElement("p");
  meta.className = "result-meta";
  meta.textContent = link.displayUrl || link.domain || "可打开资源链接";

  article.append(top, anchor, meta);

  if (link.accessCode) {
    const code = document.createElement("p");
    code.className = "access-code";
    code.innerHTML = `<span>提取码</span><strong>${escapeHtml(link.accessCode)}</strong>`;
    article.appendChild(code);
  }

  if (link.note) {
    const snippet = document.createElement("p");
    snippet.className = "result-snippet";
    snippet.textContent = compactText(link.note);
    article.appendChild(snippet);
  }

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const open = document.createElement("a");
  open.className = "open-link";
  open.href = link.url;
  open.target = "_blank";
  open.rel = "noreferrer";
  open.textContent = "打开资源";

  const copy = document.createElement("button");
  copy.className = "copy-button";
  copy.type = "button";
  copy.textContent = "复制链接";
  copy.addEventListener("click", async () => {
    await navigator.clipboard.writeText(link.url);
    copy.textContent = "已复制";
    setTimeout(() => {
      copy.textContent = "复制链接";
    }, 1300);
  });

  actions.append(open, copy);
  article.appendChild(actions);

  return article;
}

function showError(message) {
  emptyState.hidden = true;
  statusPill.textContent = "调用失败";
  statusPill.className = "status-pill error";
  errorBox.hidden = false;
  errorBox.textContent = message;
}

function formatApiError(data) {
  const parts = [data?.error || "接口调用失败。"];
  if (data?.code) parts.push(`错误码：${data.code}`);
  return parts.join("\n");
}

function compactText(text) {
  return String(text).replace(/\s+/g, " ").trim().slice(0, 240);
}

function cleanCardTitle(title, fallback) {
  const clean = String(title || "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean || fallback || "资源链接";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
