const $ = (id) => document.getElementById(id);
const algorithmNames = ["FIFO", "LRU", "SMART"];
let results = {};
let charts = { faults: null, hits: null };
let currentIndex = -1;
let playbackTimer = null;
let lastSequence = [];
let lastFrameCount = 3;

function parseSequence() {
  const raw = $("sequence").value.trim();
  if (!raw) throw new Error("Enter a page reference sequence first.");
  const tokens = raw.split(/[\s,;]+/).filter(Boolean);
  const sequence = tokens.map(token => {
    if (!/^-?\d+$/.test(token)) throw new Error(`"${token}" is not a valid integer page ID.`);
    const value = Number(token);
    if (!Number.isSafeInteger(value)) throw new Error(`"${token}" is outside the supported integer range.`);
    return value;
  });
  if (sequence.length > 500) throw new Error("Use 500 or fewer page requests for this interactive demo.");
  return sequence;
}

function normalizeWeights() {
  const freq = Number($("freqWeight").value);
  const recent = Number($("recentWeight").value);
  const total = freq + recent;
  return total === 0 ? { frequency: 0.5, recency: 0.5 } : { frequency: freq / total, recency: recent / total };
}

function simulate(sequence, frameCount, policy, weights = {frequency: .6, recency: .4}) {
  const frames = [];
  const resident = new Set();
  const insertionOrder = new Map();
  const lastUsed = new Map();
  const frequency = new Map();
  const history = [];
  let faults = 0, hits = 0;
  const start = performance.now();

  sequence.forEach((page, index) => {
    const wasResident = resident.has(page);
    let replaced = null;
    let victim = null;
    if (wasResident) {
      hits++;
    } else {
      faults++;
      if (frames.length >= frameCount) {
        if (policy === "FIFO") {
          victim = frames.reduce((oldest, p) =>
            insertionOrder.get(p) < insertionOrder.get(oldest) ? p : oldest, frames[0]);
        } else if (policy === "LRU") {
          victim = frames.reduce((leastRecent, p) =>
            lastUsed.get(p) < lastUsed.get(leastRecent) ? p : leastRecent, frames[0]);
        } else {
          const maxFrequency = Math.max(1, ...frames.map(p => frequency.get(p) || 0));
          const weightsTotal = (weights.frequency + weights.recency) || 1;
          const score = (p) => {
            const freqScore = (frequency.get(p) || 0) / maxFrequency;
            // More recent pages get a larger score; normalize against request index.
            const recencyAge = index - (lastUsed.get(p) ?? -1);
            const recencyScore = 1 / (recencyAge + 1);
            return (weights.frequency * freqScore + weights.recency * recencyScore) / weightsTotal;
          };
          victim = frames.reduce((lowest, p) => {
            const a = score(p), b = score(lowest);
            if (a < b) return p;
            if (a === b && lastUsed.get(p) < lastUsed.get(lowest)) return p;
            return lowest;
          }, frames[0]);
        }
        replaced = victim;
        resident.delete(victim);
        frames.splice(frames.indexOf(victim), 1);
        insertionOrder.delete(victim);
        lastUsed.delete(victim);
        // Keep cumulative access frequency to let a returning page retain historical popularity.
      }
      frames.push(page);
      resident.add(page);
      insertionOrder.set(page, index);
    }
    frequency.set(page, (frequency.get(page) || 0) + 1);
    lastUsed.set(page, index);
    history.push({
      index, page, hit: wasResident, fault: !wasResident, replaced,
      frames: frames.slice(), slots: Array.from({length: frameCount}, (_, i) => frames[i] ?? null),
      frequency: Object.fromEntries(frequency), lastUsed: Object.fromEntries(lastUsed)
    });
  });
  const runtimeMs = performance.now() - start;
  return { policy, faults, hits, hitRatio: sequence.length ? hits / sequence.length * 100 : 0,
    faultRatio: sequence.length ? faults / sequence.length * 100 : 0, runtimeMs, history };
}

function runAll() {
  stopPlayback();
  $("error").textContent = "";
  try {
    const sequence = parseSequence();
    const frameCount = Number($("frames").value);
    const weights = normalizeWeights();
    const computed = {};
    for (const policy of algorithmNames) computed[policy] = simulate(sequence, frameCount, policy, weights);
    results = computed;
    lastSequence = sequence;
    lastFrameCount = frameCount;
    currentIndex = -1;
    $("requestMetric").textContent = sequence.length;
    const best = algorithmNames.reduce((a, b) => computed[a].faults <= computed[b].faults ? a : b);
    $("bestMetric").textContent = `${best} · ${computed[best].faults}`;
    $("smartHitMetric").textContent = `${computed.SMART.hitRatio.toFixed(1)}%`;
    $("smartFaultMetric").textContent = computed.SMART.faults;
    $("playBtn").disabled = false;
    $("stepBtn").disabled = false;
    $("prevBtn").disabled = true;
    $("nextBtn").disabled = false;
    $("csvBtn").disabled = false;
    renderResults();
    renderCharts();
    renderTimeline();
    renderStep(-1);
    $("eventMessage").innerHTML = `Comparison complete for <b>${sequence.length}</b> requests and <b>${frameCount}</b> RAM frames. Select an algorithm and use Step through or Play animation.`;
  } catch (error) {
    $("error").textContent = error.message;
  }
}

function renderResults() {
  const body = $("resultsBody");
  body.innerHTML = "";
  for (const policy of algorithmNames) {
    const r = results[policy];
    const tr = document.createElement("tr");
    const name = policy === "SMART" ? "Smart (custom)" : policy;
    tr.innerHTML = `<td class="algorithm-name ${policy === "SMART" ? "smart" : ""}">${name}</td>
      <td>${r.faults}</td><td>${r.hits}</td><td>${r.hitRatio.toFixed(2)}%</td>
      <td>${r.faultRatio.toFixed(2)}%</td><td>${r.runtimeMs.toFixed(3)} ms</td>`;
    body.appendChild(tr);
  }
}

function renderCharts() {
  if (typeof Chart === "undefined") {
    $("faultChart").replaceWith(Object.assign(document.createElement("p"), {textContent: "Chart.js could not load. Check your internet connection; the results table still works."}));
    $("hitChart").replaceWith(Object.assign(document.createElement("p"), {textContent: "Chart.js could not load. Check your internet connection; the results table still works."}));
    return;
  }
  if (charts.faults) charts.faults.destroy();
  if (charts.hits) charts.hits.destroy();
  const labels = ["FIFO", "LRU", "Smart"];
  charts.faults = new Chart($("faultChart"), {
    type: "bar",
    data: { labels, datasets: [
      {label: "Page faults", data: algorithmNames.map(p => results[p].faults), backgroundColor: ["#f1a46e", "#6ac49d", "#9276f0"], borderRadius: 6},
      {label: "Page hits", data: algorithmNames.map(p => results[p].hits), backgroundColor: ["#f8d4bb", "#bfe9d4", "#d7ccff"], borderRadius: 6}
    ]},
    options: {responsive: true, maintainAspectRatio: true, plugins: {legend: {position: "bottom"}}, scales: {y: {beginAtZero: true, ticks: {precision: 0}}}}
  });
  charts.hits = new Chart($("hitChart"), {
    type: "bar",
    data: {labels, datasets: [{label: "Hit ratio (%)", data: algorithmNames.map(p => results[p].hitRatio), backgroundColor: ["#f1a46e", "#6ac49d", "#9276f0"], borderRadius: 6}]},
    options: {responsive: true, maintainAspectRatio: true, plugins: {legend: {display: false}}, scales: {y: {beginAtZero: true, max: 100, ticks: {callback: v => `${v}%`}}}}
  });
}

function renderTimeline() {
  const timeline = $("timeline");
  timeline.innerHTML = "";
  const policy = $("algorithmSelect").value;
  const history = results[policy]?.history || [];
  history.forEach((step, index) => {
    const item = document.createElement("div");
    item.className = `timeline-item ${step.hit ? "hit" : "fault"}`;
    item.textContent = step.page;
    item.title = `Request ${index + 1}: page ${step.page} — ${step.hit ? "hit" : "fault"}`;
    item.dataset.index = index;
    timeline.appendChild(item);
  });
  $("timelineText").textContent = `${Math.max(0, currentIndex + 1)} / ${history.length}`;
}

function renderStep(index) {
  const policy = $("algorithmSelect").value;
  const result = results[policy];
  if (!result) return;
  const history = result.history;
  currentIndex = Math.max(-1, Math.min(index, history.length - 1));
  const step = history[currentIndex];
  $("stepCount").textContent = currentIndex < 0 ? "Ready to play" : `Request ${currentIndex + 1} of ${history.length}`;
  $("currentPage").textContent = step ? step.page : "—";
  const badge = $("stepType");
  badge.className = "status-badge" + (step ? (step.hit ? " hit" : " fault") : "");
  badge.textContent = step ? (step.hit ? "PAGE HIT" : "PAGE FAULT") : "READY";
  const grid = $("ramFrames");
  grid.innerHTML = "";
  if (!step) {
    grid.innerHTML = '<div class="empty-state">Press Step through or Play animation to see RAM change.</div>';
  } else {
    step.slots.forEach((page, i) => {
      const frame = document.createElement("div");
      const isNew = page === step.page && !step.hit;
      const wasReplaced = step.replaced !== null && i < step.frames.length && page === step.page;
      frame.className = `ram-frame ${step.hit && page === step.page ? "hit-frame" : ""} ${isNew ? "fault-frame" : ""} ${wasReplaced ? "replaced-frame" : ""}`;
      frame.innerHTML = `<span class="frame-label">RAM FRAME ${i + 1}</span><strong class="page-value">${page === null ? "—" : `P${page}`}</strong><span class="frame-note">${page === null ? "Empty" : (page === step.page ? (step.hit ? "Accessed · hit" : (step.replaced !== null ? `Loaded · replaced P${step.replaced}` : "Loaded · fault")) : "Resident page")}</span>`;
      grid.appendChild(frame);
    });
  }
  document.querySelectorAll(".timeline-item").forEach((item, i) => item.classList.toggle("active", i === currentIndex));
  $("timelineText").textContent = `${Math.max(0, currentIndex + 1)} / ${history.length}`;
  $("prevBtn").disabled = currentIndex <= 0;
  $("nextBtn").disabled = currentIndex >= history.length - 1;
  $("stepBtn").disabled = currentIndex >= history.length - 1;
  if (step) {
    $("eventMessage").innerHTML = step.hit
      ? `Page <b>${step.page}</b> was already in RAM: <b>page hit</b>. The access history has been updated.`
      : `Page <b>${step.page}</b> caused a <b>page fault</b>. ${step.replaced !== null ? `Page <b>${step.replaced}</b> was replaced.` : "An empty frame was available."}`;
  }
}

function stopPlayback() {
  if (playbackTimer) clearInterval(playbackTimer);
  playbackTimer = null;
  $("playBtn").textContent = "▶ Play animation";
}

function play() {
  if (!results[$("algorithmSelect").value]) return;
  if (playbackTimer) { stopPlayback(); return; }
  if (currentIndex >= results[$("algorithmSelect").value].history.length - 1) renderStep(-1);
  $("playBtn").textContent = "Ⅱ Pause";
  const delay = Number($("speed").value);
  playbackTimer = setInterval(() => {
    if (currentIndex >= results[$("algorithmSelect").value].history.length - 1) {
      stopPlayback();
      return;
    }
    renderStep(currentIndex + 1);
  }, delay);
}

function exportCSV() {
  if (!Object.keys(results).length) return;
  const rows = [["Algorithm","Page Faults","Page Hits","Hit Ratio (%)","Fault Ratio (%)","Runtime (ms)"]];
  algorithmNames.forEach(p => {
    const r = results[p];
    rows.push([p, r.faults, r.hits, r.hitRatio.toFixed(3), r.faultRatio.toFixed(3), r.runtimeMs.toFixed(4)]);
  });
  rows.push([]);
  rows.push(["Input sequence", ...lastSequence]);
  rows.push(["RAM frames", lastFrameCount]);
  const csv = rows.map(row => row.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const blob = new Blob([csv], {type: "text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "page-replacement-results.csv";
  a.click();
  URL.revokeObjectURL(url);
}

$("runBtn").addEventListener("click", runAll);
$("stepBtn").addEventListener("click", () => {
  if (!results[$("algorithmSelect").value]) runAll();
  if (results[$("algorithmSelect").value]) renderStep(currentIndex + 1);
});
$("playBtn").addEventListener("click", play);
$("prevBtn").addEventListener("click", () => renderStep(currentIndex - 1));
$("nextBtn").addEventListener("click", () => renderStep(currentIndex + 1));
$("csvBtn").addEventListener("click", exportCSV);
$("algorithmSelect").addEventListener("change", () => {
  stopPlayback();
  currentIndex = -1;
  if (results[$("algorithmSelect").value]) {
    renderTimeline();
    renderStep(-1);
  }
});
$("frames").addEventListener("input", () => $("frameValue").textContent = $("frames").value);
$("freqWeight").addEventListener("input", () => $("freqValue").textContent = `${$("freqWeight").value}%`);
$("recentWeight").addEventListener("input", () => $("recentValue").textContent = `${$("recentWeight").value}%`);
$("resetBtn").addEventListener("click", () => {
  stopPlayback();
  $("sequence").value = "1, 2, 3, 2, 4, 1, 5, 2, 1, 2, 3, 4, 5";
  $("frames").value = 3; $("frameValue").textContent = "3";
  $("speed").value = 600;
  $("freqWeight").value = 60; $("freqValue").textContent = "60%";
  $("recentWeight").value = 40; $("recentValue").textContent = "40%";
  $("algorithmSelect").value = "SMART";
  runAll();
});
runAll();
