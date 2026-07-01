let csvText = "";
let filename = "";
let current = null;
let agentCsvText = "";
let agentCurrent = null;

const element = (id) => document.getElementById(id);
const escapeText = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));
const numberText = (value) => Number.isFinite(Number(value))
  ? Number(value).toLocaleString("ko-KR")
  : "-";
const percentText = (value) => `${Number(value || 0).toFixed(1)}%`;

const editableFields = [
  ["product_title", "상품명"],
  ["brand_mode", "브랜드 유형 (BRANDED/UNBRANDED/UNKNOWN)"],
  ["brand", "브랜드명"],
  ["manufacturer", "제조사"],
  ["origin_country", "원산지 국가코드 (예: KR)"],
  ["origin_display", "원산지 표시문구"],
  ["option_name", "옵션명"],
  ["option_value", "옵션값"],
  ["cost", "공급가"],
  ["supplier_ship_fee", "공급사 배송비"],
  ["fixed_cost", "기타 고정비"],
  ["stock", "재고"],
  ["tax_type", "과세 유형 (TAX/FREE)"],
  ["identifier_exemption_reason", "상품식별번호 면제사유"],
  ["notice_product_name", "고시 상품명"],
  ["notice_origin", "고시 원산지"],
  ["notice_weight", "고시 중량"],
  ["notice_producer", "고시 생산자" ]
];
const editableFieldSet = new Set(editableFields.map(([field]) => field));

const defaultPolicyInput = {
  platformFeePercent: "10.8",
  adReservePercent: "5",
  returnReservePercent: "2",
  paymentReservePercent: "0",
  targetMarginPercent: "20",
  roundingMode: "END_900",
  minPriceFloor: ""
};
const policyStorageKey = "commerce-diagnostic-hub.price-policy.v1";

async function readCsv(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("euc-kr").decode(bytes);
  }
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? "요청을 처리하지 못했습니다.");
  return data;
}

function setPolicyInputs(values) {
  for (const [key, fallback] of Object.entries(defaultPolicyInput)) {
    const target = element(key);
    if (target) target.value = values?.[key] ?? fallback;
  }
}

function loadSavedPolicy() {
  try {
    const saved = JSON.parse(localStorage.getItem(policyStorageKey) ?? "null");
    setPolicyInputs(saved ?? defaultPolicyInput);
    if (saved) element("policyStatus").textContent = "저장된 가격정책을 불러왔습니다.";
  } catch {
    setPolicyInputs(defaultPolicyInput);
    element("policyStatus").textContent = "저장된 정책을 읽지 못해 기본값을 사용합니다.";
  }
}

function policyInputSnapshot() {
  return Object.fromEntries(Object.keys(defaultPolicyInput).map((key) => [key, element(key).value]));
}

function toBasisPoints(id, label) {
  const value = Number(element(id).value);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${label}은 0~100 사이 숫자여야 합니다.`);
  }
  return Math.round(value * 100);
}

function buildPricePolicy() {
  const policy = {
    platformFeeBp: toBasisPoints("platformFeePercent", "플랫폼 수수료"),
    adReserveBp: toBasisPoints("adReservePercent", "광고비 예비율"),
    returnReserveBp: toBasisPoints("returnReservePercent", "반품 예비율"),
    paymentReserveBp: toBasisPoints("paymentReservePercent", "결제비 예비율"),
    targetContributionMarginBp: toBasisPoints("targetMarginPercent", "목표 공헌마진"),
    roundingMode: element("roundingMode").value
  };
  const totalBp = policy.platformFeeBp + policy.adReserveBp + policy.returnReserveBp
    + policy.paymentReserveBp + policy.targetContributionMarginBp;
  if (totalBp >= 10_000) {
    throw new Error("수수료·예비율·목표마진 합계는 100%보다 작아야 합니다.");
  }
  const minPriceFloor = element("minPriceFloor").value.trim();
  if (minPriceFloor) {
    const value = Number(minPriceFloor);
    if (!Number.isInteger(value) || value < 0) throw new Error("최저 판매가는 0 이상의 정수여야 합니다.");
    policy.minPriceFloor = value;
  }
  return policy;
}

function savePolicy() {
  try {
    buildPricePolicy();
    localStorage.setItem(policyStorageKey, JSON.stringify(policyInputSnapshot()));
    element("policyStatus").textContent = "가격정책을 이 브라우저에 저장했습니다.";
  } catch (error) {
    element("policyStatus").textContent = error.message;
  }
}

element("savePolicy").addEventListener("click", savePolicy);
element("resetPolicy").addEventListener("click", () => {
  setPolicyInputs(defaultPolicyInput);
  localStorage.removeItem(policyStorageKey);
  element("policyStatus").textContent = "기본 가격정책으로 되돌렸습니다.";
});

async function loadAgentCapabilities() {
  try {
    const data = await requestJson("/api/agent/capabilities");
    element("agentCapabilities").innerHTML = data.capabilities.map((capability) => `
      <div class="capability ${capability.enabled ? "enabled" : "disabled"}">
        <b>${escapeText(capability.id)}</b><br>
        <span>${capability.enabled ? "사용 가능" : "설정 필요"}</span>
        <p class="muted">${escapeText(capability.reason)}</p>
      </div>`).join("");
    if (!data.externalResearchAllowed) {
      element("agentStatus").textContent = "현재 외부 연구 모드는 꺼져 있습니다. 데모 모드는 바로 사용할 수 있습니다.";
    }
  } catch (error) {
    element("agentStatus").textContent = error.message;
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
    const data = await requestJson("/api/agent/run", {
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
      <div><b>${escapeText(step.title)}</b> <span class="badge ${step.status}">${escapeText(step.status)}</span></div>
      <div class="muted">${escapeText(step.detail)}</div>
    </div>`).join("");

  element("agentSources").innerHTML = run.sources.map((source) => `
    <div class="source-card ${source.status}">
      <div><b>${escapeText(source.source)}</b> <span class="badge ${source.status}">${escapeText(source.status)}</span></div>
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
      <td>시장가 ${numberText(candidate.scores.marketPrice)}원<br>최소 권장가 ${numberText(candidate.scores.requiredSellPrice)}원<br>예상마진 ${candidate.scores.estimatedMarginBp === undefined ? "-" : percentText(candidate.scores.estimatedMarginBp / 100)}</td>
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
  try {
    const data = await requestJson(`/api/agent/runs/${agentCurrent.id}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ candidateIds })
    });
    agentCurrent = data;
    renderAgent(data);
    await loadAgentHistory();
    element("agentStatus").textContent = `${data.approvedCandidateIds.length}개 후보를 검토 승인했습니다. 실제 판매 등록은 수행되지 않았습니다.`;
  } catch (error) {
    element("agentStatus").textContent = error.message;
  }
});

async function loadAgentHistory() {
  try {
    const data = await requestJson("/api/agent/runs");
    element("agentHistory").innerHTML = data.runs.length ? data.runs.map((run) => `
      <div class="history">
        <span>${new Date(run.createdAt).toLocaleString("ko-KR")} · ${escapeText(run.theme)} · 후보 ${run.summary.collectedCandidates} · <span class="badge ${run.executionStatus}">${escapeText(run.executionStatus)}</span> · <span class="badge ${run.approvalStatus}">${escapeText(run.approvalStatus)}</span></span>
        <span class="history-actions"><button data-agent-open="${run.id}" class="small">열기</button><button data-agent-delete="${run.id}" class="secondary small">삭제</button></span>
      </div>`).join("") : '<p class="empty-state">아직 에이전트 실행 이력이 없습니다.</p>';

    document.querySelectorAll("[data-agent-open]").forEach((button) => button.addEventListener("click", async () => {
      agentCurrent = await requestJson(`/api/agent/runs/${button.dataset.agentOpen}`);
      renderAgent(agentCurrent);
      window.scrollTo({ top: element("agentResult").offsetTop - 20, behavior: "smooth" });
    }));
    document.querySelectorAll("[data-agent-delete]").forEach((button) => button.addEventListener("click", async () => {
      await requestJson(`/api/agent/runs/${button.dataset.agentDelete}`, { method: "DELETE" });
      await loadAgentHistory();
    }));
  } catch (error) {
    element("agentHistory").innerHTML = `<p class="empty-state error-text">${escapeText(error.message)}</p>`;
  }
}

element("refreshAgentHistory").addEventListener("click", loadAgentHistory);

element("file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) {
    csvText = "";
    filename = "";
    element("selectedFile").textContent = "선택된 파일이 없습니다.";
    return;
  }
  csvText = await readCsv(file);
  filename = file.name;
  element("selectedFile").textContent = `${file.name} · ${numberText(file.size)} bytes`;
  element("status").textContent = `${file.name} 파일을 읽었습니다. 가격정책을 확인한 뒤 진단하세요.`;
});

async function diagnose(text, name) {
  element("diagnose").disabled = true;
  element("demo").disabled = true;
  element("status").textContent = "진단 중입니다. 행별 오류를 격리하고 등록 준비도를 계산하고 있습니다.";
  try {
    const data = await requestJson("/api/diagnose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ csvText: text, filename: name, pricePolicy: buildPricePolicy() })
    });
    current = data;
    render(data);
    await loadHistory();
    element("status").textContent = `진단이 완료되었습니다. PASS ${data.summary.pass}건, WARNING ${data.summary.warning}건, BLOCKED ${data.summary.blocked}건입니다.`;
  } finally {
    element("diagnose").disabled = false;
    element("demo").disabled = false;
  }
}

element("diagnose").addEventListener("click", async () => {
  try {
    if (!csvText) throw new Error("CSV 파일을 먼저 선택하세요.");
    await diagnose(csvText, filename);
  } catch (error) {
    element("status").textContent = error.message;
  }
});

element("demo").addEventListener("click", async () => {
  try {
    csvText = await (await fetch("/api/demo.csv")).text();
    filename = "dirty-sample.csv";
    element("selectedFile").textContent = "내장 오류 샘플 · dirty-sample.csv";
    await diagnose(csvText, filename);
  } catch (error) {
    element("status").textContent = error.message;
  }
});

function dashboardCard(label, value, detail, tone, progress) {
  return `<article class="metric-card ${tone}">
    <span>${escapeText(label)}</span>
    <strong>${escapeText(value)}</strong>
    <p>${escapeText(detail)}</p>
    ${progress === undefined ? "" : `<div class="metric-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></div>`}
  </article>`;
}

function renderDashboard(report) {
  const total = report.summary.processed || 0;
  const passRate = total ? Math.round((report.summary.pass / total) * 100) : 0;
  const averageReadiness = total
    ? Math.round(report.items.reduce((sum, item) => sum + item.readiness.overallScore, 0) / total)
    : 0;
  const publishReady = report.items.filter((item) => item.coupangPayloadPreview?.publishReady).length;
  element("readinessDashboard").innerHTML = [
    dashboardCard("즉시 검토 가능", `${report.summary.pass} / ${total}건`, `PASS 비율 ${passRate}%`, "success", passRate),
    dashboardCard("평균 준비도", `${averageReadiness}점`, "데이터·채널·규정·마진 종합", averageReadiness >= 80 ? "success" : "warning", averageReadiness),
    dashboardCard("채널 미리보기 준비", `${publishReady}건`, "비실행 쿠팡 payload 기준", publishReady === total && total ? "success" : "neutral"),
    dashboardCard("사람 확인 필요", `${report.summary.warning + report.summary.blocked}건`, `행 오류 ${report.summary.rowErrors}건 포함`, report.summary.blocked ? "danger" : "warning")
  ].join("");
}

function issueList(item) {
  const issues = item.issues.filter((issue) => issue.severity !== "INFO").slice(0, 4);
  if (!issues.length) return '<span class="all-clear">차단 문제 없음</span>';
  return `<ul class="issue-list">${issues.map((issue) => `<li>
    <span class="issue-dot ${issue.severity}"></span>
    <div><b>${escapeText(issue.field ?? issue.ruleId)}</b><br>${escapeText(issue.message)}</div>
  </li>`).join("")}</ul>`;
}

function render(report) {
  element("result").classList.remove("hidden");
  element("runStatusBadge").className = `badge ${report.run.status}`;
  element("runStatusBadge").textContent = report.run.status;
  renderDashboard(report);

  const summaryLabels = {
    processed: "처리 행",
    pass: "PASS",
    warning: "WARNING",
    blocked: "BLOCKED",
    rowErrors: "행 오류"
  };
  element("summary").innerHTML = Object.entries(report.summary).map(([key, value]) =>
    `<span class="card"><b>${escapeText(summaryLabels[key] ?? key)}</b><br>${numberText(value)}</span>`).join("");
  element("downloads").innerHTML = ["report.json", "report.html", "issues.csv", "payloads.json"].map((name) =>
    `<a class="download" href="/api/runs/${report.run.id}/${name}">${name}</a>`).join("");
  element("causes").innerHTML = report.rootCauses.length ? report.rootCauses.map((cause) =>
    `<span class="cause ${cause.severity}">${escapeText(cause.ruleId)} <b>${cause.count}</b></span>`).join("") : '<span class="all-clear">주요 차단 원인이 없습니다.</span>';
  element("items").innerHTML = report.items.map((item, index) => `<tr>
    <td>${item.sourceRow}</td>
    <td><b>${escapeText(item.supplierSku || "SKU 없음")}</b><br><small>${escapeText(item.internalCode ?? "")}</small></td>
    <td><span class="badge ${item.verdict}">${item.verdict}</span></td>
    <td><div class="readiness-score"><strong>${item.readiness.overallScore}</strong><span>/100</span></div><small>데이터 ${item.readiness.dataQualityScore} · 채널 ${item.readiness.channelCompatibilityScore}<br>규정 ${item.readiness.complianceSafetyScore} · 마진 ${item.readiness.marginHealthScore}</small></td>
    <td>${issueList(item)}</td>
    <td><button data-edit="${index}" class="small">화면에서 수정</button></td>
  </tr>`).join("");
  document.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => openEditor(Number(button.dataset.edit))));
  element("result").scrollIntoView({ behavior: "smooth", block: "start" });
}

function setEditFieldValue() {
  const index = Number(element("editItemIndex").value);
  const item = current?.items[index];
  const field = element("editField").value;
  const value = item?.source?.[field] ?? "";
  element("editValue").value = value;
  element("editCurrentValue").textContent = value
    ? `현재 값: ${value}`
    : "현재 값이 비어 있습니다.";
}

function openEditor(index) {
  const item = current?.items[index];
  if (!item) return;
  element("editItemIndex").value = String(index);
  element("editProductContext").textContent = `원본 ${item.sourceRow}행 · SKU ${item.supplierSku || "없음"} · 현재 판정 ${item.verdict}`;
  const firstEditableIssue = item.issues.find((issue) => issue.field && editableFieldSet.has(issue.field));
  element("editField").innerHTML = editableFields.map(([field, label]) =>
    `<option value="${field}">${escapeText(label)} · ${field}</option>`).join("");
  element("editField").value = firstEditableIssue?.field ?? "brand";
  element("editIssueHints").innerHTML = item.issues.filter((issue) => issue.severity !== "INFO").slice(0, 5).map((issue) =>
    `<button type="button" class="hint-button" data-hint-field="${escapeText(issue.field ?? "")}" ${editableFieldSet.has(issue.field) ? "" : "disabled"}>
      <span class="badge ${issue.severity}">${escapeText(issue.severity)}</span>
      <b>${escapeText(issue.field ?? issue.ruleId)}</b>
      <span>${escapeText(issue.fix ?? issue.message)}</span>
    </button>`).join("");
  element("editStatus").textContent = "";
  setEditFieldValue();
  element("editIssueHints").querySelectorAll("[data-hint-field]").forEach((button) => button.addEventListener("click", () => {
    if (!editableFieldSet.has(button.dataset.hintField)) return;
    element("editField").value = button.dataset.hintField;
    setEditFieldValue();
    element("editValue").focus();
  }));
  const dialog = element("editDialog");
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closeEditor() {
  const dialog = element("editDialog");
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

element("editField").addEventListener("change", setEditFieldValue);
element("closeEditDialog").addEventListener("click", closeEditor);
element("cancelEdit").addEventListener("click", closeEditor);
element("editDialog").addEventListener("click", (event) => {
  if (event.target === element("editDialog")) closeEditor();
});

element("editForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!current) return;
  const itemIndex = Number(element("editItemIndex").value);
  const field = element("editField").value;
  const value = element("editValue").value.trim();
  if (!editableFieldSet.has(field)) {
    element("editStatus").textContent = "화면에서 수정할 수 없는 필드입니다.";
    return;
  }
  if (!value) {
    element("editStatus").textContent = "새 값을 입력하세요.";
    return;
  }
  try {
    element("submitEdit").disabled = true;
    element("editStatus").textContent = "저장 후 전체 파일을 다시 진단하고 있습니다.";
    const data = await requestJson(`/api/runs/${current.run.id}/patch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemIndex, field, value })
    });
    current = data;
    closeEditor();
    render(data);
    await loadHistory();
    element("status").textContent = `${field} 필드를 수정하고 새 실행으로 재진단했습니다.`;
  } catch (error) {
    element("editStatus").textContent = error.message;
  } finally {
    element("submitEdit").disabled = false;
  }
});

async function loadHistory() {
  try {
    const data = await requestJson("/api/runs");
    element("history").innerHTML = data.runs.length ? data.runs.map((run) => `<div class="history">
      <span><b>${escapeText(run.filename)}</b><br><small>${new Date(run.createdAt).toLocaleString("ko-KR")} · PASS ${run.summary.pass} · WARNING ${run.summary.warning} · BLOCKED ${run.summary.blocked}</small></span>
      <span class="history-actions"><button data-open="${run.id}" class="small">결과 열기</button><button data-delete="${run.id}" class="secondary small">삭제</button></span>
    </div>`).join("") : '<p class="empty-state">아직 상품 진단 이력이 없습니다.</p>';
    document.querySelectorAll("[data-open]").forEach((button) => button.addEventListener("click", async () => {
      current = await requestJson(`/api/runs/${button.dataset.open}`);
      render(current);
    }));
    document.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", async () => {
      await requestJson(`/api/runs/${button.dataset.delete}`, { method: "DELETE" });
      await loadHistory();
    }));
  } catch (error) {
    element("history").innerHTML = `<p class="empty-state error-text">${escapeText(error.message)}</p>`;
  }
}

loadSavedPolicy();
loadAgentCapabilities();
loadAgentHistory();
loadHistory();
