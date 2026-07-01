let currentCampaign = null;
let currentCreativeId = null;
let currentRenderedVideo = null;

const h = (id) => document.getElementById(id);
const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[character]));
const number = (value) => Number(value || 0).toLocaleString("ko-KR");
const percentBp = (value) => `${(Number(value || 0) / 100).toFixed(2)}%`;

async function jsonRequest(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? "요청을 처리하지 못했습니다.");
  return data;
}

function setCampaignStatus(message, error = false) {
  h("campaignStatus").textContent = message;
  h("campaignStatus").classList.toggle("error-text", error);
}

function selectedChannels() {
  return [...document.querySelectorAll('[name="campaignChannel"]:checked')]
    .map((input) => input.value);
}

function downloadText(filename, text, type = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slug(value) {
  return String(value ?? "campaign")
    .trim()
    .replace(/[^0-9A-Za-z가-힣_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "campaign";
}

async function loadCampaignRuns() {
  try {
    const data = await jsonRequest("/api/runs");
    const select = h("campaignRun");
    const previous = select.value;
    select.innerHTML = data.runs.length
      ? data.runs.map((run) => `<option value="${safe(run.id)}">${safe(run.filename)} · PASS ${run.summary.pass} · 경고 ${run.summary.warning}</option>`).join("")
      : '<option value="">먼저 상품 CSV를 진단하세요</option>';
    if (data.runs.some((run) => run.id === previous)) select.value = previous;
    await loadCampaignProducts();
  } catch (error) {
    setCampaignStatus(error.message, true);
  }
}

async function loadCampaignProducts() {
  const runId = h("campaignRun").value;
  const select = h("campaignProduct");
  if (!runId) {
    select.innerHTML = '<option value="">진단 이력이 없습니다</option>';
    return;
  }
  try {
    const report = await jsonRequest(`/api/runs/${encodeURIComponent(runId)}`);
    const usable = report.items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.verdict !== "BLOCKED" && item.canonical);
    select.innerHTML = usable.length
      ? usable.map(({ item, index }) => `<option value="${index}">${safe(item.canonical.titleStandard)} · ${safe(item.verdict)} · ${number(item.price?.sellPrice)}원</option>`).join("")
      : '<option value="">수정 후 캠페인으로 만들 수 있는 상품이 없습니다</option>';
    if (usable[0]) {
      h("campaignName").value = `${usable[0].item.canonical.titleStandard} 쇼핑쇼츠 캠페인`;
    }
  } catch (error) {
    select.innerHTML = '<option value="">상품을 불러오지 못했습니다</option>';
    setCampaignStatus(error.message, true);
  }
}

h("campaignRun").addEventListener("change", loadCampaignProducts);
h("campaignProduct").addEventListener("change", async () => {
  const runId = h("campaignRun").value;
  const itemIndex = Number(h("campaignProduct").value);
  if (!runId || !Number.isInteger(itemIndex)) return;
  try {
    const report = await jsonRequest(`/api/runs/${encodeURIComponent(runId)}`);
    const product = report.items[itemIndex]?.canonical;
    if (product) h("campaignName").value = `${product.titleStandard} 쇼핑쇼츠 캠페인`;
  } catch {
    // Existing selection remains available even when the title preview fails.
  }
});
h("refreshCampaignSources").addEventListener("click", loadCampaignRuns);

h("createCampaign").addEventListener("click", async () => {
  try {
    const runId = h("campaignRun").value;
    const itemIndex = Number(h("campaignProduct").value);
    if (!runId || !Number.isInteger(itemIndex)) throw new Error("먼저 진단 이력과 상품을 선택하세요.");
    const channels = selectedChannels();
    if (!channels.length) throw new Error("게시 대상 채널을 한 개 이상 선택하세요.");
    h("createCampaign").disabled = true;
    setCampaignStatus("상품 사실정보를 바탕으로 쇼츠 3종과 안전검사 결과를 생성하고 있습니다.");
    const campaign = await jsonRequest("/api/campaigns/from-run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runId,
        itemIndex,
        settings: {
          campaignName: h("campaignName").value.trim(),
          objective: h("campaignObjective").value,
          targetAudience: h("campaignAudience").value.trim(),
          tone: h("campaignTone").value,
          durationSeconds: Number(h("campaignDuration").value),
          channels,
          disclosureType: h("campaignDisclosure").value,
          landingUrl: h("campaignLandingUrl").value.trim(),
          forbiddenClaims: h("campaignForbiddenClaims").value
            .split(/[,\n]/)
            .map((value) => value.trim())
            .filter(Boolean),
          evidence: {
            originConfirmed: h("campaignOriginConfirmed").checked,
            imageRightsConfirmed: h("campaignImageRightsConfirmed").checked,
            factsConfirmed: h("campaignFactsConfirmed").checked
          }
        }
      })
    });
    renderCampaign(campaign);
    await loadCampaignHistory();
    setCampaignStatus("캠페인을 생성했습니다. 안전 항목과 세 가지 쇼츠 버전을 확인하세요.");
    window.scrollTo({ top: h("campaignResult").offsetTop - 20, behavior: "smooth" });
  } catch (error) {
    setCampaignStatus(error.message, true);
  } finally {
    h("createCampaign").disabled = false;
  }
});

function campaignCreative() {
  return currentCampaign?.creatives.find((creative) => creative.id === currentCreativeId)
    ?? currentCampaign?.creatives[0]
    ?? null;
}

function renderCampaign(campaign) {
  currentCampaign = campaign;
  currentCreativeId = currentCreativeId && campaign.creatives.some((item) => item.id === currentCreativeId)
    ? currentCreativeId
    : campaign.creatives[0]?.id;
  h("campaignResult").classList.remove("hidden");
  h("campaignResultTitle").textContent = campaign.input.campaignName;
  h("campaignResultProduct").textContent = `${campaign.input.product.title} · ${campaign.input.product.optionSummary}`;
  h("campaignApprovalBadge").textContent = campaign.approvalStatus;
  h("campaignApprovalBadge").className = `badge ${campaign.approvalStatus}`;
  const blockedCount = campaign.safetyIssues.filter((issue) => issue.severity === "BLOCKED").length;
  h("approveCampaign").disabled = campaign.approvalStatus === "APPROVED" || blockedCount > 0;

  h("campaignSummary").innerHTML = [
    ["권장 판매가", campaign.offer.sellPrice === undefined ? "확인 필요" : `${number(campaign.offer.sellPrice)}원`],
    ["쇼츠 버전", `${campaign.creatives.length}종`],
    ["게시 채널", `${campaign.input.channels.length}개`],
    ["안전 차단", `${blockedCount}건`],
    ["성과 기록", `${campaign.performanceSnapshots.length}건`]
  ].map(([label, value]) => `<div class="readiness-card"><span>${safe(label)}</span><strong>${safe(value)}</strong></div>`).join("");

  h("campaignSafety").innerHTML = campaign.safetyIssues.length
    ? campaign.safetyIssues.map((issue) => `
      <div class="safety-issue ${issue.severity}">
        <span class="badge ${issue.severity}">${safe(issue.severity)}</span>
        <div><b>${safe(issue.message)}</b><p>${safe(issue.fix)}</p></div>
      </div>`).join("")
    : '<div class="success-box">차단 또는 경고 항목이 없습니다. 그래도 게시 전 최종 사람 검토가 필요합니다.</div>';

  h("campaignCreativeTabs").innerHTML = campaign.creatives.map((creative) => `
    <button type="button" class="creative-tab ${creative.id === currentCreativeId ? "active" : ""}" data-creative-id="${safe(creative.id)}">
      <b>${safe(creative.name)}</b><span>${safe(creative.angle)}</span>
    </button>`).join("");
  document.querySelectorAll("[data-creative-id]").forEach((button) => button.addEventListener("click", () => {
    currentCreativeId = button.dataset.creativeId;
    renderCampaign(currentCampaign);
  }));

  renderCreativeDetail();
  renderPerformance(campaign);
}

function renderCreativeDetail() {
  const creative = campaignCreative();
  if (!creative) return;
  h("campaignCreativeDetail").innerHTML = `
    <div class="creative-header">
      <div><p class="eyebrow">${safe(creative.angle)}</p><h3>${safe(creative.name)}</h3></div>
      <span class="duration-chip">${creative.renderManifest.durationSeconds}초 · ${creative.renderManifest.aspectRatio}</span>
    </div>
    <div class="hook-card"><span>첫 2초 후킹</span><strong>${safe(creative.hook)}</strong></div>
    <div class="copy-grid">
      <div><h4>게시 제목</h4><p>${safe(creative.title)}</p></div>
      <div><h4>광고·관계 고지</h4><p>${safe(creative.disclosureText)}</p></div>
      <div class="span-2"><h4>게시 설명</h4><pre>${safe(creative.description)}</pre></div>
      <div class="span-2"><h4>해시태그</h4><p>${creative.hashtags.map((tag) => `<span class="tag">${safe(tag)}</span>`).join(" ")}</p></div>
    </div>
    <h4>장면별 스토리보드</h4>
    <div class="scene-list">${creative.scenes.map((scene) => `
      <article class="scene-card">
        <div class="scene-time">${scene.startSecond.toFixed(1)}–${scene.endSecond.toFixed(1)}초</div>
        <b>${safe(scene.caption)}</b>
        <p>${safe(scene.visualDirection)}</p>
        <small>내레이션 초안: ${safe(scene.narration)}</small>
      </article>`).join("")}</div>`;

  h("performanceCreative").innerHTML = currentCampaign.creatives
    .map((item) => `<option value="${safe(item.id)}" ${item.id === creative.id ? "selected" : ""}>${safe(item.name)}</option>`)
    .join("");
}

h("approveCampaign").addEventListener("click", async () => {
  if (!currentCampaign) return;
  try {
    const updated = await jsonRequest(`/api/campaigns/${encodeURIComponent(currentCampaign.id)}/approve`, {
      method: "POST"
    });
    renderCampaign(updated);
    await loadCampaignHistory();
  } catch (error) {
    h("campaignSafety").insertAdjacentHTML("afterbegin", `<div class="warning-box">${safe(error.message)}</div>`);
  }
});

h("exportCampaign").addEventListener("click", () => {
  if (!currentCampaign) return;
  downloadText(
    `${slug(currentCampaign.input.campaignName)}.json`,
    JSON.stringify(currentCampaign, null, 2),
    "application/json;charset=utf-8"
  );
});

h("downloadSrt").addEventListener("click", () => {
  const creative = campaignCreative();
  if (!creative || !currentCampaign) return;
  downloadText(`${slug(currentCampaign.input.campaignName)}-${creative.angle}.srt`, creative.subtitleSrt);
});

h("downloadPostingCopy").addEventListener("click", () => {
  const creative = campaignCreative();
  if (!creative || !currentCampaign) return;
  const text = [
    `[제목]\n${creative.title}`,
    `[설명]\n${creative.description}`,
    `[해시태그]\n${creative.hashtags.join(" ")}`,
    `[고정댓글]\n${creative.pinnedComment}`,
    `[후킹]\n${creative.hook}`
  ].join("\n\n");
  downloadText(`${slug(currentCampaign.input.campaignName)}-${creative.angle}-posting.txt`, text);
});

function renderPerformance(campaign) {
  h("performanceChannel").innerHTML = campaign.input.channels
    .map((channel) => `<option value="${safe(channel)}">${safe(channel)}</option>`)
    .join("");
  h("performanceCreative").innerHTML = campaign.creatives
    .map((creative) => `<option value="${safe(creative.id)}">${safe(creative.name)}</option>`)
    .join("");
  if (currentCreativeId) h("performanceCreative").value = currentCreativeId;

  h("campaignInsight").innerHTML = `
    <span class="badge ${safe(campaign.insight.type)}">${safe(campaign.insight.type)}</span>
    <div><b>${safe(campaign.insight.message)}</b><p>${safe(campaign.insight.nextAction)}</p></div>`;

  h("performanceHistory").innerHTML = campaign.performanceSnapshots.length
    ? `<table><thead><tr><th>기록일</th><th>채널·버전</th><th>조회</th><th>클릭률</th><th>주문전환</th><th>매출·광고비</th></tr></thead><tbody>${campaign.performanceSnapshots.map((item) => {
      const creative = campaign.creatives.find((candidate) => candidate.id === item.creativeId);
      return `<tr>
        <td>${new Date(item.recordedAt).toLocaleString("ko-KR")}</td>
        <td>${safe(item.channel)}<br><small>${safe(creative?.name ?? item.creativeId)}</small></td>
        <td>${number(item.views)}</td>
        <td>${percentBp(item.clickThroughRateBp)}</td>
        <td>${percentBp(item.orderConversionRateBp)}</td>
        <td>${number(item.revenue)}원<br><small>광고 ${number(item.adSpend)}원</small></td>
      </tr>`;
    }).join("")}</tbody></table>`
    : '<p class="empty-state">아직 입력된 성과가 없습니다.</p>';
}

h("savePerformance").addEventListener("click", async () => {
  if (!currentCampaign) return;
  try {
    const updated = await jsonRequest(`/api/campaigns/${encodeURIComponent(currentCampaign.id)}/performance`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        channel: h("performanceChannel").value,
        creativeId: h("performanceCreative").value,
        views: Number(h("performanceViews").value),
        clicks: Number(h("performanceClicks").value),
        orders: Number(h("performanceOrders").value),
        revenue: Number(h("performanceRevenue").value),
        adSpend: Number(h("performanceAdSpend").value),
        note: h("performanceNote").value.trim()
      })
    });
    renderCampaign(updated);
    await loadCampaignHistory();
  } catch (error) {
    h("campaignInsight").innerHTML = `<div class="warning-box">${safe(error.message)}</div>`;
  }
});

async function loadCampaignHistory() {
  try {
    const data = await jsonRequest("/api/campaigns");
    h("campaignHistory").innerHTML = data.campaigns.length
      ? data.campaigns.map((campaign) => `
        <div class="history campaign-history-row">
          <span><b>${safe(campaign.campaignName)}</b><br><small>${safe(campaign.productTitle)} · ${campaign.channels.length}개 채널 · 성과 ${campaign.performanceCount}건 · ${safe(campaign.insight.type)}</small></span>
          <span class="history-actions"><span class="badge ${safe(campaign.approvalStatus)}">${safe(campaign.approvalStatus)}</span><button data-campaign-open="${safe(campaign.id)}" class="small">열기</button><button data-campaign-delete="${safe(campaign.id)}" class="secondary small">삭제</button></span>
        </div>`).join("")
      : '<p class="empty-state">아직 쇼핑쇼츠 캠페인이 없습니다.</p>';

    document.querySelectorAll("[data-campaign-open]").forEach((button) => button.addEventListener("click", async () => {
      const campaign = await jsonRequest(`/api/campaigns/${encodeURIComponent(button.dataset.campaignOpen)}`);
      renderCampaign(campaign);
      window.scrollTo({ top: h("campaignResult").offsetTop - 20, behavior: "smooth" });
    }));
    document.querySelectorAll("[data-campaign-delete]").forEach((button) => button.addEventListener("click", async () => {
      await jsonRequest(`/api/campaigns/${encodeURIComponent(button.dataset.campaignDelete)}`, { method: "DELETE" });
      if (currentCampaign?.id === button.dataset.campaignDelete) {
        currentCampaign = null;
        h("campaignResult").classList.add("hidden");
      }
      await loadCampaignHistory();
    }));
  } catch (error) {
    h("campaignHistory").innerHTML = `<p class="empty-state error-text">${safe(error.message)}</p>`;
  }
}

h("refreshCampaignHistory").addEventListener("click", loadCampaignHistory);

function mediaRecorderType() {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm"
  ];
  return candidates.find((type) => window.MediaRecorder?.isTypeSupported(type)) ?? "";
}

function wrapText(context, text, maxWidth) {
  const characters = [...String(text)];
  const lines = [];
  let line = "";
  for (const character of characters) {
    const candidate = line + character;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = character;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

function drawCoverImage(context, image, width, height) {
  const imageRatio = image.width / image.height;
  const canvasRatio = width / height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.width;
  let sourceHeight = image.height;
  if (imageRatio > canvasRatio) {
    sourceWidth = image.height * canvasRatio;
    sourceX = (image.width - sourceWidth) / 2;
  } else {
    sourceHeight = image.width / canvasRatio;
    sourceY = (image.height - sourceHeight) / 2;
  }
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
}

function roundedPanel(context, x, y, width, height, radius) {
  context.beginPath();
  if (typeof context.roundRect === "function") context.roundRect(x, y, width, height, radius);
  else context.rect(x, y, width, height);
  context.fill();
}

function drawVideoFrame(context, canvas, image, scene, creative, campaign, progress) {
  const { width, height } = canvas;
  context.clearRect(0, 0, width, height);
  if (image) {
    drawCoverImage(context, image, width, height);
  } else {
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#19324a");
    gradient.addColorStop(1, "#09121f");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }

  context.fillStyle = "rgba(0, 0, 0, 0.34)";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "rgba(0, 0, 0, 0.72)";
  roundedPanel(context, 42, 54, width - 84, 112, 22);
  context.fillStyle = "#ffffff";
  context.font = "700 28px sans-serif";
  context.textAlign = "center";
  context.fillText(creative.disclosureText, width / 2, 105, width - 120);

  context.fillStyle = "rgba(255, 255, 255, 0.94)";
  roundedPanel(context, 42, height - 440, width - 84, 310, 28);
  context.fillStyle = "#102030";
  context.font = "800 46px sans-serif";
  context.textAlign = "center";
  const lines = wrapText(context, scene.caption, width - 150);
  lines.forEach((line, index) => context.fillText(line, width / 2, height - 340 + index * 58));

  context.fillStyle = "rgba(11, 30, 46, 0.9)";
  roundedPanel(context, 42, height - 105, width - 84, 54, 18);
  context.fillStyle = "#ffffff";
  context.font = "700 24px sans-serif";
  context.fillText(campaign.offer.callToAction, width / 2, height - 70, width - 120);

  context.fillStyle = "rgba(255,255,255,0.4)";
  context.fillRect(42, height - 30, width - 84, 8);
  context.fillStyle = "#ffffff";
  context.fillRect(42, height - 30, (width - 84) * progress, 8);
}

async function loadRenderImages() {
  const files = [...h("shortImages").files].slice(0, 10);
  return Promise.all(files.map((file) => createImageBitmap(file)));
}

function ensureVideoDownload(blob, extension) {
  if (currentRenderedVideo) URL.revokeObjectURL(currentRenderedVideo.url);
  const url = URL.createObjectURL(blob);
  currentRenderedVideo = { url, extension };
  h("shortPreview").src = url;
  let button = h("downloadRenderedVideo");
  if (!button) {
    button = document.createElement("button");
    button.id = "downloadRenderedVideo";
    button.type = "button";
    button.className = "secondary";
    button.textContent = "완성 영상 저장";
    h("renderShortVideo").insertAdjacentElement("afterend", button);
  }
  button.onclick = () => {
    if (!currentCampaign || !currentRenderedVideo) return;
    const link = document.createElement("a");
    link.href = currentRenderedVideo.url;
    link.download = `${slug(currentCampaign.input.campaignName)}-${campaignCreative()?.angle ?? "short"}.${currentRenderedVideo.extension}`;
    link.click();
  };
}

h("renderShortVideo").addEventListener("click", async () => {
  const creative = campaignCreative();
  if (!currentCampaign || !creative) return;
  if (!currentCampaign.input.evidence.imageRightsConfirmed) {
    h("renderStatus").textContent = "이미지 사용권 확인이 없는 캠페인은 영상을 만들 수 없습니다.";
    return;
  }
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
    h("renderStatus").textContent = "이 브라우저는 영상 녹화를 지원하지 않습니다. 최신 Chrome 또는 Edge를 사용하세요.";
    return;
  }

  h("renderShortVideo").disabled = true;
  try {
    const images = await loadRenderImages();
    const canvas = h("shortCanvas");
    const context = canvas.getContext("2d");
    const stream = canvas.captureStream(30);
    const mimeType = mediaRecorderType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    const chunks = [];
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size) chunks.push(event.data);
    });
    const stopped = new Promise((resolve) => recorder.addEventListener("stop", resolve, { once: true }));
    recorder.start(1000);
    const startedAt = performance.now();
    const durationMs = creative.renderManifest.durationSeconds * 1000;
    let lastSecond = -1;

    await new Promise((resolve) => {
      const frame = (timestamp) => {
        const elapsed = Math.min(timestamp - startedAt, durationMs);
        const second = elapsed / 1000;
        const scene = creative.scenes.find((item) => second >= item.startSecond && second < item.endSecond)
          ?? creative.scenes.at(-1);
        const sceneIndex = Math.max(0, creative.scenes.indexOf(scene));
        const image = images.length ? images[sceneIndex % images.length] : null;
        drawVideoFrame(context, canvas, image, scene, creative, currentCampaign, elapsed / durationMs);
        const currentSecond = Math.floor(second);
        if (currentSecond !== lastSecond) {
          lastSecond = currentSecond;
          h("renderStatus").textContent = `영상 생성 중 ${currentSecond}/${creative.renderManifest.durationSeconds}초 · 브라우저에서 실시간 렌더링합니다.`;
        }
        if (elapsed >= durationMs) resolve();
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });

    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
    images.forEach((image) => image.close());
    const actualType = recorder.mimeType || mimeType || "video/webm";
    const blob = new Blob(chunks, { type: actualType });
    const extension = actualType.startsWith("video/mp4") ? "mp4" : "webm";
    ensureVideoDownload(blob, extension);
    h("renderStatus").textContent = `자막형 세로 영상이 완성됐습니다. ${extension.toUpperCase()} 파일로 저장할 수 있습니다.`;
  } catch (error) {
    h("renderStatus").textContent = error.message;
  } finally {
    h("renderShortVideo").disabled = false;
  }
});

loadCampaignRuns();
loadCampaignHistory();
