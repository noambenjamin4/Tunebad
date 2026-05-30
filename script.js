const fileInput = document.querySelector("#fileInput");
const selectFiles = document.querySelector("#selectFiles");
const dropZone = document.querySelector("#dropZone");
const resultsBody = document.querySelector("#resultsBody");
const clearResults = document.querySelector("#clearResults");
const clearResultsTop = document.querySelector("#clearResultsTop");
const removeFile = document.querySelector("#removeFile");
const exportResults = document.querySelector("#exportResults");
const historyList = document.querySelector("#historyList");
const clearHistory = document.querySelector("#clearHistory");
const waveform = document.querySelector("#waveform");
const audioPreview = document.querySelector("#audioPreview");
const previewButton = document.querySelector("#previewButton");
const previewStart = document.querySelector("#previewStart");
const previewEnd = document.querySelector("#previewEnd");
const bpmInput = document.querySelector("#bpmInput");
const delayTable = document.querySelector("#delayTable");
const preDelay = document.querySelector("#preDelay");
const decayTime = document.querySelector("#decayTime");
const copyValues = document.querySelector("#copyValues");
const conversionStatus = document.querySelector("#conversionStatus");
const convertForm = document.querySelector("#convertForm");
const audioUrl = document.querySelector("#audioUrl");
const converterFile = document.querySelector("#converterFile");
const themeButtons = document.querySelectorAll("[data-theme-choice]");
const pageButtons = document.querySelectorAll("[data-page]");
const pageViews = document.querySelectorAll("[data-view]");
const qualityButtons = document.querySelectorAll("[data-quality]");
const metronomeBpm = document.querySelector("#metronomeBpm");
const metronomeToggle = document.querySelector("#metronomeToggle");
const metronomeSync = document.querySelector("#metronomeSync");
const metronomeBeat = document.querySelector("#metronomeBeat");
const beatLight = document.querySelector("#beatLight");
const dedicatedTapper = document.querySelector("#dedicatedTapper");
const tapperBpm = document.querySelector("#tapperBpm");
const tapperCount = document.querySelector("#tapperCount");
const useTapperBpm = document.querySelector("#useTapperBpm");
const resetTapper = document.querySelector("#resetTapper");
const hzInput = document.querySelector("#hzInput");
const noteDisplay = document.querySelector("#noteDisplay");
const offsetDisplay = document.querySelector("#offsetDisplay");
const metaFileName = document.querySelector("#metaFileName");
const metaFileType = document.querySelector("#metaFileType");
const metaSampleRate = document.querySelector("#metaSampleRate");
const metaBitDepth = document.querySelector("#metaBitDepth");
const summaryBpm = document.querySelector("#summaryBpm");
const summaryKey = document.querySelector("#summaryKey");
const summaryDuration = document.querySelector("#summaryDuration");
const summaryRate = document.querySelector("#summaryRate");
const summaryDepth = document.querySelector("#summaryDepth");
const summaryChannels = document.querySelector("#summaryChannels");

const AudioContextClass = window.AudioContext || window.webkitAudioContext;
let lastAnalyzedBpm = null;
let tapTimes = [];
let dedicatedTapTimes = [];
let dedicatedTapBpm = null;
let metronomeTimer = null;
let metronomeAudioContext = null;
let currentBeat = 1;
let analysisResults = [];
let historyItems = [];
let selectedQuality = "320 kbps";
let turnstileToken = "";
let turnstileWidgetId = null;
let turnstileLoadPromise = null;
const historyStorageKey = "tuner-analysis-history";
const themeStorageKey = "tuner-theme-mode";
const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const camelot = {
  "C Major": "8B", "G Major": "9B", "D Major": "10B", "A Major": "11B", "E Major": "12B", "B Major": "1B",
  "F# Major": "2B", "C# Major": "3B", "G# Major": "4B", "D# Major": "5B", "A# Major": "6B", "F Major": "7B",
  "A Minor": "8A", "E Minor": "9A", "B Minor": "10A", "F# Minor": "11A", "C# Minor": "12A", "G# Minor": "1A",
  "D# Minor": "2A", "A# Minor": "3A", "F Minor": "4A", "C Minor": "5A", "G Minor": "6A", "D Minor": "7A",
};

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
}

function formatDetailedTime(seconds) {
  if (!Number.isFinite(seconds)) return "00:00.000";
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  const ms = Math.round((seconds % 1) * 1000).toString().padStart(3, "0");
  return `${minutes}:${secs}.${ms}`;
}

function parseSelectedKbps() {
  return Number.parseInt(selectedQuality, 10) || 320;
}

function loadMp3Encoder() {
  if (window.lamejs?.Mp3Encoder) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-tuner-encoder="lamejs"]');
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", () => reject(new Error("MP3 encoder failed to load.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "/lame.min.js";
    script.async = true;
    script.dataset.tunerEncoder = "lamejs";
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("MP3 encoder failed to load.")), { once: true });
    document.head.appendChild(script);
  });
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) return "N/A";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function parseWavBitDepth(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  if (view.byteLength < 44 || String.fromCharCode(...new Uint8Array(arrayBuffer, 0, 4)) !== "RIFF") return null;
  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const id = String.fromCharCode(...new Uint8Array(arrayBuffer, offset, 4));
    const size = view.getUint32(offset + 4, true);
    if (id === "fmt " && offset + 24 <= view.byteLength) return view.getUint16(offset + 22, true);
    offset += 8 + size + (size % 2);
  }
  return null;
}

function describeBitDepth(file, arrayBuffer) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (extension === "wav") {
    const bits = parseWavBitDepth(arrayBuffer);
    return bits ? `${bits}-bit` : "PCM";
  }
  if (["mp3", "m4a", "aac", "ogg", "flac"].includes(extension)) return "Compressed";
  return "Decoded";
}

function setStatus(title, message, tone = "neutral") {
  conversionStatus.innerHTML = `<strong>${title}</strong><span>${message}</span>`;
  conversionStatus.dataset.tone = tone;
}

function resetTurnstile() {
  turnstileToken = "";
  if (window.turnstile && turnstileWidgetId !== null) {
    window.turnstile.reset(turnstileWidgetId);
  }
}

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve();
  if (turnstileLoadPromise) return turnstileLoadPromise;

  turnstileLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-tuner-turnstile="cloudflare"]');
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", () => reject(new Error("Cloudflare Turnstile failed to load.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.tunerTurnstile = "cloudflare";
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", () => reject(new Error("Cloudflare Turnstile failed to load.")), { once: true });
    document.head.appendChild(script);
  });

  return turnstileLoadPromise;
}

async function renderTurnstile() {
  const target = document.querySelector("#turnstileWidget");
  if (!target || turnstileWidgetId !== null) return;

  await loadTurnstileScript();
  const sitekey = target.dataset.turnstileSiteKey || window.TUNER_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";

  turnstileWidgetId = window.turnstile.render(target, {
    sitekey,
    action: "mp3_converter",
    theme: "light",
    callback(token) {
      turnstileToken = token;
    },
    "expired-callback"() {
      turnstileToken = "";
    },
    "error-callback"() {
      turnstileToken = "";
      setStatus("Verification failed", "Cloudflare could not verify this request. Try again.", "warning");
    },
  });
}

async function verifyTurnstile() {
  try {
    await renderTurnstile();
  } catch (error) {
    setStatus("Protection unavailable", error.message || "Cloudflare Turnstile could not load.", "warning");
    return false;
  }

  if (!turnstileToken) {
    setStatus("Verification required", "Complete the Cloudflare check before converting or downloading.", "warning");
    return false;
  }

  const response = await fetch("/api/turnstile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: turnstileToken, action: "mp3_converter" }),
  });
  const result = await response.json().catch(() => ({ success: false }));

  if (!response.ok || !result.success) {
    resetTurnstile();
    setStatus("Verification blocked", result.reason || "Cloudflare rejected this request.", "warning");
    return false;
  }

  return true;
}

function clampBpm(value) {
  return Math.max(30, Math.min(300, Number.parseFloat(value) || 120));
}

function setMainBpm(value) {
  const bpm = clampBpm(value);
  bpmInput.value = bpm.toFixed(2);
  metronomeBpm.value = Math.round(bpm);
  updateCalculations();
  return bpm;
}

function showPage(pageName, updateHash = true) {
  pageViews.forEach((view) => {
    view.classList.toggle("active", view.dataset.view === pageName);
  });
  pageButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.page === pageName);
  });
  if (updateHash) {
    history.replaceState(null, "", `#${pageName}`);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function readStoredThemeMode() {
  try {
    const stored = localStorage.getItem(themeStorageKey);
    return ["system", "light", "dark"].includes(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function saveThemeMode(mode) {
  try {
    localStorage.setItem(themeStorageKey, mode);
  } catch {
    // Some file:// browser settings can block storage; the selected mode still applies.
  }
}

function applyThemeMode(mode = readStoredThemeMode()) {
  const resolvedMode = mode === "system" ? (systemThemeQuery.matches ? "dark" : "light") : mode;
  document.body.classList.toggle("dark", resolvedMode === "dark");
  document.documentElement.dataset.themeMode = mode;
  document.documentElement.dataset.resolvedTheme = resolvedMode;
  document
    .querySelectorAll(".analysis-value, #summaryBpm, #summaryKey, #summaryDuration, #summaryRate, #summaryDepth, #summaryChannels")
    .forEach((value) => {
      value.style.setProperty("color", "#ffffff", "important");
      value.style.setProperty("-webkit-text-fill-color", "#ffffff", "important");
      value.style.setProperty("opacity", "1", "important");
      value.style.setProperty("filter", "none", "important");
      value.style.setProperty("mix-blend-mode", "normal", "important");
    });
  if (dedicatedTapper) {
    if (resolvedMode === "dark") {
      dedicatedTapper.style.setProperty("background", "rgba(6, 13, 18, 0.52)", "important");
      dedicatedTapper.style.setProperty("border-color", "#191a1a", "important");
      dedicatedTapper.style.setProperty("color", "#004cff", "important");
      dedicatedTapper.querySelectorAll("strong, span").forEach((node) => {
        node.style.setProperty("color", "#004cff", "important");
        node.style.setProperty("-webkit-text-fill-color", "#004cff", "important");
      });
    } else {
      dedicatedTapper.style.removeProperty("background");
      dedicatedTapper.style.removeProperty("border-color");
      dedicatedTapper.style.removeProperty("color");
      dedicatedTapper.querySelectorAll("strong, span").forEach((node) => {
        node.style.removeProperty("color");
        node.style.removeProperty("-webkit-text-fill-color");
      });
    }
  }
  themeButtons.forEach((button) => {
    const isActive = button.dataset.themeChoice === mode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  saveThemeMode(mode);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return entities[character];
  });
}

function loadHistory() {
  try {
    historyItems = JSON.parse(localStorage.getItem(historyStorageKey)) || [];
  } catch {
    historyItems = [];
  }
}

function saveHistory() {
  localStorage.setItem(historyStorageKey, JSON.stringify(historyItems.slice(0, 24)));
}

function renderHistory() {
  if (!historyItems.length) {
    historyList.innerHTML = '<div class="history-empty">No saved analyses yet.</div>';
    return;
  }
  historyList.innerHTML = historyItems
    .map(
      (item) => `
        <div class="history-item">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <div class="history-meta">
              <span>${escapeHtml(item.duration)}</span>
              <span>${escapeHtml(item.key)}</span>
              <span>${escapeHtml(item.analyzedAt)}</span>
            </div>
          </div>
          <button class="history-pill" type="button" data-history-bpm="${item.bpm}">${Number(item.bpm).toFixed(2)} BPM</button>
        </div>
      `,
    )
    .join("");
}

function rememberResult(result, analyzedAt) {
  const item = {
    name: result.name,
    duration: formatTime(result.duration),
    bpm: result.bpm || 0,
    key: result.key,
    scale: result.scale,
    confidence: result.confidence,
    analyzedAt,
  };
  historyItems = [item, ...historyItems.filter((existing) => existing.name !== item.name)].slice(0, 24);
  saveHistory();
  renderHistory();
}

async function saveAnalysisToSupabase(result) {
  try {
    await fetch("/api/analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    });
  } catch (error) {
    console.info("Supabase save skipped.", error);
  }
}

function updateVisualSummary(result = null) {
  if (!result) {
    metaFileName.textContent = "example-track.wav";
    metaFileType.textContent = "WAV";
    metaSampleRate.textContent = "44.1 kHz";
    metaBitDepth.textContent = "PCM";
    summaryBpm.textContent = "128.00";
    summaryKey.textContent = "C Minor";
    summaryDuration.textContent = "03:45.278";
    summaryRate.textContent = "44.1 kHz";
    summaryDepth.textContent = "PCM";
    summaryChannels.textContent = "2";
    return;
  }

  const extension = result.name.split(".").pop()?.toUpperCase() || "AUDIO";
  const sampleRate = `${(result.sampleRate / 1000).toFixed(result.sampleRate % 1000 === 0 ? 0 : 1)} kHz`;
  const channels = result.channels || 2;
  metaFileName.textContent = result.name;
  metaFileType.textContent = extension;
  metaSampleRate.textContent = sampleRate;
  metaBitDepth.textContent = result.bitDepthLabel;
  summaryBpm.textContent = result.bpm ? result.bpm.toFixed(2) : "N/A";
  summaryKey.textContent = result.key;
  document.querySelector("#summaryCamelot").textContent = result.camelot || "Camelot N/A";
  summaryDuration.textContent = formatDetailedTime(result.duration);
  summaryRate.textContent = sampleRate;
  summaryDepth.textContent = result.bitDepthLabel;
  summaryChannels.textContent = String(channels);
}

function drawPlaceholderWave() {
  waveform.innerHTML = "";
  for (let index = 0; index < 160; index += 1) {
    const bar = document.createElement("i");
    const height = 12 + Math.round(Math.abs(Math.sin(index * 0.48) * 30) + Math.random() * 18);
    bar.style.setProperty("--bar-height", `${height}px`);
    waveform.appendChild(bar);
  }
}

function drawWaveFromBuffer(buffer) {
  const data = buffer.getChannelData(0);
  const bars = 170;
  const step = Math.max(1, Math.floor(data.length / bars));
  waveform.innerHTML = "";
  for (let index = 0; index < bars; index += 1) {
    let peak = 0;
    for (let j = 0; j < step; j += 1) {
      peak = Math.max(peak, Math.abs(data[index * step + j] || 0));
    }
    const bar = document.createElement("i");
    bar.style.setProperty("--bar-height", `${Math.max(8, Math.round(peak * 56))}px`);
    waveform.appendChild(bar);
  }
}

function monoSamples(buffer) {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const output = new Float32Array(length);
  for (let channel = 0; channel < channels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) output[i] += data[i] / channels;
  }
  return output;
}

function getEnergyEnvelope(samples, sampleRate) {
  const frameSize = Math.round(sampleRate * 0.05);
  const hopSize = Math.round(sampleRate * 0.025);
  const envelope = [];
  for (let start = 0; start + frameSize < samples.length; start += hopSize) {
    let sum = 0;
    for (let i = start; i < start + frameSize; i += 1) sum += samples[i] * samples[i];
    envelope.push(Math.sqrt(sum / frameSize));
  }
  return { envelope, hopSize };
}

function estimateBpm(samples, sampleRate) {
  const { envelope, hopSize } = getEnergyEnvelope(samples, sampleRate);
  if (envelope.length < 24) return { bpm: 0, confidence: 0 };

  const mean = envelope.reduce((sum, value) => sum + value, 0) / envelope.length;
  const centered = envelope.map((value) => value - mean);
  const candidates = [];

  for (let bpm = 60; bpm <= 190; bpm += 0.5) {
    const lag = Math.round((60 / bpm) * sampleRate / hopSize);
    if (lag < 1 || lag >= centered.length) continue;
    let score = 0;
    for (let i = lag; i < centered.length; i += 1) score += centered[i] * centered[i - lag];
    candidates.push({ bpm, score: score / (centered.length - lag) });
  }

  candidates.sort((a, b) => b.score - a.score);
  let best = candidates[0] || { bpm: 0, score: 0 };
  while (best.bpm < 85) best = { ...best, bpm: best.bpm * 2 };
  while (best.bpm > 170) best = { ...best, bpm: best.bpm / 2 };

  const runnerUp = candidates[1]?.score || 0.0001;
  const confidence = Math.max(42, Math.min(96, Math.round((best.score / (best.score + runnerUp)) * 100)));
  return { bpm: best.bpm, confidence };
}

function goertzel(samples, sampleRate, frequency, start, size) {
  const coeff = 2 * Math.cos((2 * Math.PI * frequency) / sampleRate);
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < size; i += 1) {
    const sample = samples[start + i] || 0;
    s0 = sample + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return s1 * s1 + s2 * s2 - coeff * s1 * s2;
}

function estimateKey(samples, sampleRate) {
  const chroma = new Array(12).fill(0);
  const windowSize = Math.min(samples.length, Math.round(sampleRate * 0.75));
  const maxWindows = 28;
  const stride = Math.max(windowSize, Math.floor(samples.length / maxWindows));

  for (let start = 0; start + windowSize < samples.length; start += stride) {
    for (let note = 0; note < 12; note += 1) {
      for (let octave = 2; octave <= 6; octave += 1) {
        const midi = (octave + 1) * 12 + note;
        const frequency = 440 * 2 ** ((midi - 69) / 12);
        if (frequency > 70 && frequency < 1800) {
          chroma[note] += Math.sqrt(goertzel(samples, sampleRate, frequency, start, windowSize));
        }
      }
    }
  }

  const max = Math.max(...chroma) || 1;
  const normalized = chroma.map((value) => value / max);
  const scoreMode = (profile, root) =>
    profile.reduce((sum, weight, index) => sum + weight * normalized[(index + root) % 12], 0);

  let best = { root: 0, mode: "Major", score: -Infinity };
  for (let root = 0; root < 12; root += 1) {
    const majorScore = scoreMode(majorProfile, root);
    const minorScore = scoreMode(minorProfile, root);
    if (majorScore > best.score) best = { root, mode: "Major", score: majorScore };
    if (minorScore > best.score) best = { root, mode: "Minor", score: minorScore };
  }

  const total = normalized.reduce((sum, value) => sum + value, 0) || 1;
  const confidence = Math.max(45, Math.min(94, Math.round((Math.max(...normalized) / total) * 220)));
  return { key: `${noteNames[best.root]} ${best.mode}`, scale: best.mode, confidence };
}

async function analyzeFile(file) {
  const audioContext = new AudioContextClass();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  const samples = monoSamples(buffer);
  const bpmResult = estimateBpm(samples, buffer.sampleRate);
  const keyResult = estimateKey(samples, buffer.sampleRate);
  audioContext.close();
  return {
    name: file.name,
    duration: buffer.duration,
    sampleRate: buffer.sampleRate,
    channels: buffer.numberOfChannels,
    bitDepthLabel: describeBitDepth(file, arrayBuffer),
    bitrateEstimate: file.size && buffer.duration ? Math.round((file.size * 8) / buffer.duration / 1000) : null,
    fileSize: file.size,
    bpm: bpmResult.bpm,
    key: keyResult.key,
    scale: keyResult.scale,
    camelot: camelot[keyResult.key] ? `Camelot ${camelot[keyResult.key]}` : "Camelot N/A",
    confidence: Math.round((bpmResult.confidence + keyResult.confidence) / 2),
    buffer,
  };
}

function addResultRow(result) {
  resultsBody.querySelector(".empty-row")?.remove();
  const row = document.createElement("tr");
  const analyzedAt = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  row.innerHTML = `
    <td>${escapeHtml(result.name)}</td>
    <td>${formatTime(result.duration)}</td>
    <td class="accent">${result.bpm ? result.bpm.toFixed(2) : "N/A"}</td>
    <td class="accent">${escapeHtml(result.key)}</td>
    <td>${escapeHtml(result.camelot || result.scale)}</td>
    <td>
      <div class="confidence">
        <span>${result.confidence}%</span>
        <meter min="0" max="100" value="${result.confidence}"></meter>
      </div>
    </td>
    <td>${analyzedAt}</td>
  `;
  resultsBody.prepend(row);
  analysisResults = [{ ...result, analyzedAt }, ...analysisResults];
  rememberResult(result, analyzedAt);
  saveAnalysisToSupabase(result);
}

async function handleFiles(files) {
  const audioFiles = [...files].filter((file) => file.type.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|flac)$/i.test(file.name));
  if (!audioFiles.length) return;

  for (const file of audioFiles) {
    const loading = document.createElement("tr");
    loading.innerHTML = `<td colspan="7">Analyzing ${file.name}...</td>`;
    resultsBody.querySelector(".empty-row")?.remove();
    resultsBody.prepend(loading);
    try {
      const result = await analyzeFile(file);
      loading.remove();
      addResultRow(result);
      lastAnalyzedBpm = result.bpm;
      updateVisualSummary(result);
      drawWaveFromBuffer(result.buffer);
      bpmInput.value = result.bpm.toFixed(2);
      updateCalculations();
      audioPreview.src = URL.createObjectURL(file);
      previewButton.disabled = false;
      previewEnd.textContent = formatTime(result.duration);
    } catch (error) {
      loading.innerHTML = `<td colspan="7">Could not analyze ${file.name}. Try another audio format.</td>`;
      console.error(error);
    }
  }
}

function updateCalculations() {
  const bpm = clampBpm(bpmInput.value);
  const quarter = 60000 / bpm;
  const divisions = [
    ["1/1 Whole", quarter * 4],
    ["1/2 Half", quarter * 2],
    ["1/4 Quarter", quarter],
    ["1/8 Eighth", quarter / 2],
    ["1/16 Sixteenth", quarter / 4],
    ["1/8 Dotted", quarter * 0.75],
    ["1/4 Triplet", quarter * (2 / 3)],
  ];
  delayTable.innerHTML = divisions
    .map(
      ([label, value]) => `
        <div class="delay-row ${label.includes("Quarter") && !label.includes("Triplet") ? "highlight" : ""}">
          <span>${label}</span>
          <strong>${Math.round(value)} ms</strong>
        </div>
      `,
    )
    .join("");
  preDelay.textContent = `${Math.round(Math.min(60, Math.max(12, quarter / 24)))} ms`;
  decayTime.textContent = `${Math.max(0.6, Math.min(4.8, (quarter / 335).toFixed(2)))} s`;
}

function freqToPitch(freq) {
  if (freq <= 0) return { note: "N/A", octave: "", cents: 0 };

  const midiFractional = 12 * Math.log2(freq / 440) + 69;
  const midiNumber = Math.round(midiFractional);
  const cents = Math.round((midiFractional - midiNumber) * 100);
  const noteName = noteNames[((midiNumber % 12) + 12) % 12];
  const octave = Math.floor(midiNumber / 12) - 1;

  return {
    note: noteName + octave,
    cents: cents > 0 ? `+${cents}` : `${cents}`,
  };
}

function updatePitchDisplay() {
  const result = freqToPitch(Number.parseFloat(hzInput.value));
  noteDisplay.textContent = result.note;
  offsetDisplay.textContent = `${result.cents} cents`;
}

function flashBeatLight() {
  beatLight.classList.add("active");
  setTimeout(() => beatLight.classList.remove("active"), 90);
}

function playMetronomeClick(accent = false) {
  if (!AudioContextClass) return;
  if (!metronomeAudioContext) metronomeAudioContext = new AudioContextClass();
  const oscillator = metronomeAudioContext.createOscillator();
  const gain = metronomeAudioContext.createGain();
  oscillator.type = "square";
  oscillator.frequency.value = accent ? 1100 : 760;
  gain.gain.setValueAtTime(accent ? 0.18 : 0.12, metronomeAudioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, metronomeAudioContext.currentTime + 0.055);
  oscillator.connect(gain);
  gain.connect(metronomeAudioContext.destination);
  oscillator.start();
  oscillator.stop(metronomeAudioContext.currentTime + 0.06);
}

function tickMetronome() {
  metronomeBeat.textContent = currentBeat;
  flashBeatLight();
  playMetronomeClick(currentBeat === 1);
  currentBeat = currentBeat === 4 ? 1 : currentBeat + 1;
}

function stopMetronome() {
  clearInterval(metronomeTimer);
  metronomeTimer = null;
  metronomeToggle.textContent = "Start";
  beatLight.classList.remove("active");
}

function startMetronome() {
  stopMetronome();
  currentBeat = 1;
  tickMetronome();
  const interval = 60000 / clampBpm(metronomeBpm.value);
  metronomeTimer = setInterval(tickMetronome, interval);
  metronomeToggle.textContent = "Stop";
}

function updateDedicatedTapper() {
  if (!dedicatedTapBpm) {
    tapperBpm.textContent = "Tap";
    tapperCount.textContent = `${dedicatedTapTimes.length} taps`;
    return;
  }
  tapperBpm.textContent = dedicatedTapBpm.toFixed(2);
  tapperCount.textContent = `${dedicatedTapTimes.length} taps`;
}

selectFiles.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (event) => handleFiles(event.target.files));

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
  });
});

dropZone.addEventListener("drop", (event) => handleFiles(event.dataTransfer.files));

previewButton.addEventListener("click", async () => {
  if (audioPreview.paused) {
    await audioPreview.play();
    previewButton.textContent = "Ⅱ";
  } else {
    audioPreview.pause();
    previewButton.textContent = "▶";
  }
});

audioPreview.addEventListener("timeupdate", () => {
  previewStart.textContent = formatTime(audioPreview.currentTime);
});

audioPreview.addEventListener("ended", () => {
  previewButton.textContent = "▶";
});

clearResults.addEventListener("click", () => {
  resultsBody.innerHTML = '<tr class="empty-row"><td colspan="7">No tracks analyzed yet.</td></tr>';
  analysisResults = [];
  lastAnalyzedBpm = null;
  audioPreview.removeAttribute("src");
  previewButton.disabled = true;
  previewButton.textContent = "▶";
  previewStart.textContent = "0:00";
  previewEnd.textContent = "0:00";
  drawPlaceholderWave();
  updateVisualSummary();
});

clearResultsTop.addEventListener("click", () => clearResults.click());
removeFile.addEventListener("click", () => clearResults.click());

exportResults.addEventListener("click", () => {
  if (!analysisResults.length) {
    exportResults.textContent = "No Results";
    setTimeout(() => {
      exportResults.textContent = "Export CSV";
    }, 1200);
    return;
  }
  const header = ["File Name", "Duration", "BPM", "Key", "Scale", "Confidence", "Analyzed"];
const rows = analysisResults.map((item) => [
    item.name,
    formatTime(item.duration),
    item.bpm ? item.bpm.toFixed(2) : "N/A",
    item.key,
    item.camelot || item.scale,
    `${item.confidence}%`,
    item.analyzedAt,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "tuner-analysis-results.csv";
  link.click();
  URL.revokeObjectURL(url);
});

historyList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-history-bpm]");
  if (!button) return;
  bpmInput.value = Number(button.dataset.historyBpm).toFixed(2);
  updateCalculations();
  showPage("delay");
});

clearHistory.addEventListener("click", () => {
  historyItems = [];
  saveHistory();
  renderHistory();
});

document.querySelector("#bpmMinus").addEventListener("click", () => {
  setMainBpm(Number.parseFloat(bpmInput.value || 120) - 1);
});

document.querySelector("#bpmPlus").addEventListener("click", () => {
  setMainBpm(Number.parseFloat(bpmInput.value || 120) + 1);
});

bpmInput.addEventListener("input", () => {
  metronomeBpm.value = Math.round(clampBpm(bpmInput.value));
  updateCalculations();
});

document.querySelector("#syncAnalyzer").addEventListener("click", () => {
  if (!lastAnalyzedBpm) return;
  setMainBpm(lastAnalyzedBpm);
});

document.querySelector("#tapTempo").addEventListener("click", () => {
  const now = performance.now();
  tapTimes = tapTimes.filter((time) => now - time < 4500);
  tapTimes.push(now);
  if (tapTimes.length >= 2) {
    const intervals = tapTimes.slice(1).map((time, index) => time - tapTimes[index]);
    const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    setMainBpm(60000 / average);
  }
});

metronomeToggle.addEventListener("click", () => {
  if (metronomeTimer) {
    stopMetronome();
  } else {
    startMetronome();
  }
});

metronomeSync.addEventListener("click", () => {
  metronomeBpm.value = Math.round(clampBpm(bpmInput.value));
  if (metronomeTimer) startMetronome();
});

document.querySelector("#metronomeMinus").addEventListener("click", () => {
  metronomeBpm.value = Math.round(clampBpm(Number.parseFloat(metronomeBpm.value || 120) - 1));
  if (metronomeTimer) startMetronome();
});

document.querySelector("#metronomePlus").addEventListener("click", () => {
  metronomeBpm.value = Math.round(clampBpm(Number.parseFloat(metronomeBpm.value || 120) + 1));
  if (metronomeTimer) startMetronome();
});

metronomeBpm.addEventListener("input", () => {
  metronomeBpm.value = Math.round(clampBpm(metronomeBpm.value));
  if (metronomeTimer) startMetronome();
});

dedicatedTapper.addEventListener("click", () => {
  const now = performance.now();
  dedicatedTapTimes = dedicatedTapTimes.filter((time) => now - time < 5000);
  dedicatedTapTimes.push(now);
  if (dedicatedTapTimes.length >= 2) {
    const intervals = dedicatedTapTimes.slice(1).map((time, index) => time - dedicatedTapTimes[index]);
    const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    dedicatedTapBpm = clampBpm(60000 / average);
  }
  updateDedicatedTapper();
});

useTapperBpm.addEventListener("click", () => {
  if (!dedicatedTapBpm) return;
  setMainBpm(dedicatedTapBpm);
  metronomeBpm.value = Math.round(dedicatedTapBpm);
});

resetTapper.addEventListener("click", () => {
  dedicatedTapTimes = [];
  dedicatedTapBpm = null;
  updateDedicatedTapper();
});

hzInput.addEventListener("input", updatePitchDisplay);

document.querySelectorAll("[data-frequency]").forEach((button) => {
  button.addEventListener("click", () => {
    hzInput.value = button.dataset.frequency;
    updatePitchDisplay();
  });
});

copyValues.addEventListener("click", async () => {
  const text = [...delayTable.querySelectorAll(".delay-row")]
    .map((row) => row.textContent.trim().replace(/\s+/g, " "))
    .join("\n");
  await navigator.clipboard.writeText(`${text}\nPre-Delay ${preDelay.textContent}\nDecay Time ${decayTime.textContent}`);
  copyValues.textContent = "Copied";
  setTimeout(() => {
    copyValues.textContent = "Copy All Values";
  }, 1200);
});

function floatTo16BitPcm(channelData) {
  const pcm = new Int16Array(channelData.length);
  for (let i = 0; i < channelData.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return pcm;
}

function downloadBlob(blob, fileName) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function convertFileToMp3(file) {
  await loadMp3Encoder();
  if (!AudioContextClass) {
    throw new Error("This browser cannot decode audio files.");
  }

  setStatus("Decoding", `Reading ${file.name}...`, "neutral");
  const audioContext = new AudioContextClass();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  await audioContext.close();

  const channels = Math.min(2, buffer.numberOfChannels);
  const left = floatTo16BitPcm(buffer.getChannelData(0));
  const right = channels > 1 ? floatTo16BitPcm(buffer.getChannelData(1)) : left;
  const encoder = new window.lamejs.Mp3Encoder(channels, buffer.sampleRate, parseSelectedKbps());
  const chunks = [];
  const blockSize = 1152;

  for (let index = 0; index < left.length; index += blockSize) {
    const leftChunk = left.subarray(index, index + blockSize);
    const rightChunk = right.subarray(index, index + blockSize);
    const encoded = channels > 1 ? encoder.encodeBuffer(leftChunk, rightChunk) : encoder.encodeBuffer(leftChunk);
    if (encoded.length) chunks.push(encoded);
  }

  const flushed = encoder.flush();
  if (flushed.length) chunks.push(flushed);

  const baseName = file.name.replace(/\.[^.]+$/, "") || "tuner-audio";
  const blob = new Blob(chunks, { type: "audio/mpeg" });
  downloadBlob(blob, `${baseName}-${parseSelectedKbps()}kbps.mp3`);
  setStatus(
    "MP3 created",
    `${parseSelectedKbps()} kbps file ready. Source ${formatFileSize(file.size)} converted to ${formatFileSize(blob.size)}.`,
    "success",
  );
}

convertForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const verified = await verifyTurnstile();
  if (!verified) return;

  const file = converterFile.files?.[0];
  if (file) {
    try {
      await convertFileToMp3(file);
      resetTurnstile();
    } catch (error) {
      console.error(error);
      setStatus("Conversion failed", error.message || "Try a WAV, MP3, M4A, OGG, or FLAC file.", "warning");
    }
    return;
  }

  const url = audioUrl.value.trim();
  if (!url) {
    setStatus("Audio needed", "Upload an audio file or paste a direct MP3 URL.", "warning");
    return;
  }
  const isYouTube = /(^|\.)youtube\.com|youtu\.be/i.test(url);
  if (isYouTube) {
    setStatus(
      "YouTube not supported",
      "Upload your audio file here, or use a direct MP3 file URL you own or have permission to download.",
      "warning",
    );
    return;
  }
  if (!/\.mp3($|\?)/i.test(url)) {
    setStatus("MP3 link required", "Paste a direct .mp3 file URL to create a download link.", "warning");
    return;
  }
  const fileName = decodeURIComponent(url.split("/").pop()?.split("?")[0] || "tuner-track.mp3");
  conversionStatus.innerHTML = `
    <strong>Ready</strong>
    <span>
      Direct MP3 verified. Quality is already set by the source file.
      <a class="download-ready-link" href="${escapeHtml(url)}" download="${escapeHtml(fileName)}" target="_blank" rel="noopener noreferrer">Download MP3</a>
    </span>
  `;
  conversionStatus.dataset.tone = "success";
  resetTurnstile();
});

qualityButtons.forEach((button) => {
  button.addEventListener("click", () => {
    qualityButtons.forEach((qualityButton) => qualityButton.classList.remove("active"));
    button.classList.add("active");
    selectedQuality = button.dataset.quality;
  });
});

themeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyThemeMode(button.dataset.themeChoice);
  });
});

systemThemeQuery.addEventListener("change", () => {
  if (readStoredThemeMode() === "system") applyThemeMode("system");
});

pageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showPage(button.dataset.page);
  });
});

const initialPage = window.location.hash.replace("#", "") || "analysis";
if (document.querySelector(`[data-view="${initialPage}"]`)) {
  showPage(initialPage, false);
}
loadHistory();
renderHistory();
drawPlaceholderWave();
updateCalculations();
updatePitchDisplay();
updateDedicatedTapper();
applyThemeMode();
renderTurnstile();
window.addEventListener("load", renderTurnstile);
setTimeout(renderTurnstile, 1200);
