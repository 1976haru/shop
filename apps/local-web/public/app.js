let csvText = "";
let filename = "";
let current = null;
let agentCsvText = "";
let agentCurrent = null;

const element = (id) => document.getElementById(id);
const escapeText = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));
const numberText = (value) => Number.isFinite(value) ? Number(value).toLocaleString("ko-KR") : "-";

async function readCsv(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return new TextDecoder("euc-kr").decode(bytes); }
}

async function loadAgentCapabilities() {
  const response = await fetch("/api/agent/capabilities");
  const data = await response.json();
  element("agentCapabilities").innerHTML = data.capabilities.map((capability) => `
    <div class="capability ${capability.enabled ? "enabled" : "disabled"}">
      <b>${escapeText(capability.id)}</b><br>
      <span>${capability.enabled ? "사용 가능" : "설정 필요"}</span>
      <p class="muted">${escapeText(capability.reason)}</p>
    </div>`).join("");
  if (!data.externalResearchAllowed) {
    element("agentStatus").textContent = "현재 외부 연구 모드는 꺼져 있습니다. 데모 모드는 바로 사용할 수 있습니다.";
  }
}

element("refreshAgentCapabilities").addEventListener("click", loadAgentCapabilities);
element("agentFile").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  agentCsvText = file ? await readCsv(file) : "";
  element("agentStatus").textContent = file
    ? `${file.name}을 에이전트 후보 상품에 연결했습니다.`
    : "";
});

element("runAgent").addEventListener("click", async () => {
  try {
    element("runAgent").disabled = true;
    element("agentStatus").textContent = "에이전트가 데이터원을 확인하고 후보를 분석 중입니다.";
    const response = await fetch("/api/agent/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        theme: element("agentTheme").value,
        mode: element("agentMode").value,
        topN: 20,
        ...(agentCsvText ? { supplierCsvText: agentCsvText } : {}),
        sellerProfile: {
          healthSupplementBusinessReported: element("healthReported").checked,
          imageRightsConfirmed: element("imageRights").checked,
          originEvidenceAvailable: element("originEvidence").checked
        }
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message ?? "에이전트 실행에 실패했습니다.");
    agentCurrent = data;
    renderAgent(data);
    await loadAgentHistory();
    element("agentStatus").textContent = "분석이 끝났습니다. 근거와 위험을 확인한 뒤 후보를 승인하세요.";
  } catch (error) {
    element("agentStatus").textContent = error.message;
  } finally {
    element("runAgent").disabled = false;
  }
});

function renderAgent(run) {
  element("agentResult").classList.remove("hidden");
  element("agentSummary").innerHTML = [
    ["실행상태", run.executionStatus],
    ["승인상태", run.approvalStatus],
    ["수집 후보", run.summary.collectedCandidates],
    ["우선 검토", run.summary.priorityReview],
    ["규정 차단", run.summary.blocked],
    ["데이터원 실패", run.summary.sourceFailures]
  ].map(([label, value]) => `<span class="card"><b>${escapeText(label)}</b><br>${escapeText(value)}</span>`).join("");

  element("agentWarnings").innerHTML = run.warnings.map((warning) =>
    `<div class="warning-box">${escapeText(warning)}</div>`).join("");

  element("agentPlan").innerHTML = run.plan.map((step) => `
    <div class="plan-step ${step.status}">
      <b>${escapeText(step.title)}</b>
      <span class="badge ${step.status}">${escapeText(step.status)}</span>
      <div class="muted">${escapeText(step.detail)}</div>
    </div>`).join("");

  element("agentSources").innerHTML = run.sources.map((source) => `
    <div class="source-card ${source.status}">
      <b>${escapeText(source.source)}</b>
      <span class="badge ${source.status}">${escapeText(source.status)}</span>
      <p>${escapeText(source.message)}</p>
      <small>수집 ${numberText(source.recordCount)}건</small>
    </div>`).join("");

  element("agentCandidates").innerHTML = run.candidates.map((candidate) => `
    <tr>
      <td><input type="checkbox" data-agent-candidate="${escapeText(candidate.candidateId)}" ${candidate.gate === "BLOCKED" ? "disabled" : ""}></td>
      <td>${candidate.rank}</td>
      <td><b>${escapeText(candidate.name)}</b><br><small>${escapeText(candidate.supplierSku ?? candidate.candidateId)}</small><br><span class="badge ${candidate.recommendation === "BLOCKED" ? "BLOCKED" : "PASS"}">${escapeText(candidate.recommendation)}</span></td>
      <td><span class="badge ${candidate.gate}">${escapeText(candidate.gate)}</span><br><small>${candidate.gateReasons.map(escapeText).join("<br>")}</small></td>
      <td><b>${candidate.scores.overallScore}</b><div class="score-grid">시장 ${candidate.scores.marketScore} · 수익 ${candidate.scores.profitScore}<br>공급 ${candidate.scores.supplyScore} · 운영 ${candidate.scores.operationScore}</div></td>
      <td>시장가 ${numberText(candidate.scores.marketPrice)}원<br>최소 권장가 ${numberText(candidate.scores.requiredSellPrice)}원<br>예상마진 ${candidate.scores.estimatedMarginBp === undefined ? "-" : (candidate.scores.estimatedMarginBp / 100).toFixed(1) + "%"}</td>
      <td class="candidate-reasons"><b>추천 이유</b><ul>${candidate.whyRecommended.map((item) => `<li>${escapeText(item)}</li>`).join("")}</ul><b>위험·다음 작업</b><ul>${[...candidate.risks, ...candidate.nextActions].slice(0, 6).map((item) => `<li>${escapeText(item)}</li>`).join("")}</ul></td>
    </tr>`).join("");

  element("approveAgent").disabled = run.approvalStatus !== "AWAITING_APPROVAL";
}

element("approveAgent").addEventListener("click", async () => {
  if (!agentCurrent) return;
  const candidateIds = [...document.querySelectorAll("[data-agent-candidate]:checked")]
    .map((input) => input.dataset.agentCandidate);
  if (!candidateIds.length) {
    alert("검토 승인할 후보를 한 개 이상 선택하세요.");
    return;
  }
  const response = await fetch(`/api/agent/runs/${agentCurrent.id}/approve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ candidateIds })
  });
  const data = await response.json();
  if (!response.ok) {
    alert(data.error?.message ?? "승인 저장에 실패했습니다.");
    return;
  }
  agentCurrent = data;
  renderAgent(data);
  await loadAgentHistory();
  element("agentStatus").textContent = `${data.approvedCandidateIds.length}개 후보를 검토 승인했습니다. 실제 판매 등록은 수행되지 않았습니다.`;
});

async function loadAgentHistory() {
  const data = await (await fetch("/api/agent/runs")).json();
  element("agentHistory").innerHTML = data.runs.map((run) => `
    <div class="history">
      <span>${new Date(run.createdAt).toLocaleString()} · ${escapeText(run.theme)} · 후보 ${run.summary.collectedCandidates} · <span class="badge ${run.executionStatus}">${escapeText(run.executionStatus)}</span> · <span class="badge ${run.approvalStatus}">${escapeText(run.approvalStatus)}</span></span>
      <span class="history-actions"><button data-agent-open="${run.id}" class="small">열기</button><button data-agent-delete="${run.id}" class="secondary small">삭제</button></span>
    </div>`).join("");

  document.querySelectorAll("[data-agent-open]").forEach((button) => button.addEventListener("click", async () => {
    const response = await fetch(`/api/agent/runs/${button.dataset.agentOpen}`);
    agentCurrent = await response.json();
    renderAgent(agentCurrent);
    window.scrollTo({ top: element("agentResult").offsetTop - 20, behavior: "smooth" });
  }));
  document.querySelectorAll("[data-agent-delete]").forEach((button) => button.addEventListener("click", async () => {
    await fetch(`/api/agent/runs/${button.dataset.agentDelete}`, { method: "DELETE" });
    await loadAgentHistory();
  }));
}

element("refreshAgentHistory").addEventListener("click", loadAgentHistory);

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
    <span><button data-open="${run.id}" class="small">열기</button><button data-delete="${run.id}" class="secondary small">삭제</button></span></div>`).join("");
  document.querySelectorAll("[data-open]").forEach((button) => button.addEventListener("click", async () => {
    current = await (await fetch(`/api/runs/${button.dataset.open}`)).json(); render(current);
  }));
  document.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", async () => {
    await fetch(`/api/runs/${button.dataset.delete}`, { method: "DELETE" }); await loadHistory();
  }));
}

loadAgentCapabilities();
loadAgentHistory();
loadHistory();
