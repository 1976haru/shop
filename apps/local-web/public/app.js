let csvText = "";
let filename = "";
let current = null;
const element = (id) => document.getElementById(id);
const escapeText = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));

async function readCsv(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return new TextDecoder("euc-kr").decode(bytes); }
}

element("file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  csvText = await readCsv(file);
  filename = file.name;
  element("status").textContent = `${file.name} 파일을 읽었습니다.`;
});

async function diagnose(text, name) {
  element("status").textContent = "진단 중입니다.";
  const response = await fetch("/api/diagnose", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ csvText: text, filename: name })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? "진단에 실패했습니다.");
  current = data;
  render(data);
  await loadHistory();
  element("status").textContent = "진단이 완료되었습니다.";
}

element("diagnose").addEventListener("click", async () => {
  try {
    if (!csvText) throw new Error("CSV 파일을 먼저 선택하세요.");
    await diagnose(csvText, filename);
  } catch (error) { element("status").textContent = error.message; }
});

element("demo").addEventListener("click", async () => {
  try {
    csvText = await (await fetch("/api/demo.csv")).text();
    filename = "dirty-sample.csv";
    await diagnose(csvText, filename);
  } catch (error) { element("status").textContent = error.message; }
});

function render(report) {
  element("result").classList.remove("hidden");
  const summary = report.summary;
  element("summary").innerHTML = Object.entries(summary).map(([key, value]) =>
    `<span class="card"><b>${escapeText(key)}</b><br>${value}</span>`).join("");
  element("downloads").innerHTML = ["report.json", "report.html", "issues.csv", "payloads.json"].map((name) =>
    `<a class="download" href="/api/runs/${report.run.id}/${name}">${name}</a>`).join("");
  element("causes").innerHTML = report.rootCauses.map((cause) =>
    `<span class="cause">${escapeText(cause.ruleId)} <b>${cause.count}</b></span>`).join("");
  element("items").innerHTML = report.items.map((item, index) => `<tr>
    <td>${item.sourceRow}</td><td>${escapeText(item.supplierSku)}</td>
    <td><span class="badge ${item.verdict}">${item.verdict}</span></td>
    <td>${item.readiness.overallScore}<br><small>데이터 ${item.readiness.dataQualityScore} · 채널 ${item.readiness.channelCompatibilityScore} · 규정 ${item.readiness.complianceSafetyScore} · 마진 ${item.readiness.marginHealthScore}</small></td>
    <td>${item.issues.filter((issue) => issue.severity !== "INFO").slice(0, 3).map((issue) => escapeText(issue.message)).join("<br>")}</td>
    <td><button data-edit="${index}">필드 수정</button></td></tr>`).join("");
  document.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => editItem(Number(button.dataset.edit))));
}

async function editItem(index) {
  const item = current.items[index];
  const field = prompt("수정할 표준 입력 필드명", "brand");
  if (!field) return;
  const value = prompt(`${field}의 새 값`, item.source[field] ?? "");
  if (value === null) return;
  const response = await fetch(`/api/runs/${current.run.id}/patch`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ itemIndex: index, field, value })
  });
  const data = await response.json();
  if (!response.ok) return alert(data.error?.message ?? "수정에 실패했습니다.");
  current = data;
  render(data);
  await loadHistory();
}

async function loadHistory() {
  const data = await (await fetch("/api/runs")).json();
  element("history").innerHTML = data.runs.map((run) => `<div class="history">
    <span>${new Date(run.createdAt).toLocaleString()} · ${escapeText(run.filename)} · BLOCKED ${run.summary.blocked}</span>
    <span><button data-open="${run.id}">열기</button><button data-delete="${run.id}">삭제</button></span></div>`).join("");
  document.querySelectorAll("[data-open]").forEach((button) => button.addEventListener("click", async () => {
    current = await (await fetch(`/api/runs/${button.dataset.open}`)).json(); render(current);
  }));
  document.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", async () => {
    await fetch(`/api/runs/${button.dataset.delete}`, { method: "DELETE" }); await loadHistory();
  }));
}

loadHistory();
