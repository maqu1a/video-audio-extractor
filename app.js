/* SoundPeel — 動画から音声(mp3/wav)を抜き出す
   すべてブラウザ内(ffmpeg.wasm)で処理。ファイルは外部に送信しません。 */
"use strict";

const { FFmpeg } = FFmpegWASM;   // vendor/ffmpeg/ffmpeg.js
const { fetchFile } = FFmpegUtil; // vendor/ffmpeg/util.js

// ---- 要素 ----
const $ = (id) => document.getElementById(id);
const fileInput = $("fileInput");
const dropzone = $("dropzone");
const fileInfo = $("fileInfo");
const fiName = $("fiName");
const fiSize = $("fiSize");
const fiClear = $("fiClear");
const runBtn = $("runBtn");
const runLabel = $("runLabel");
const mp3Quality = $("mp3Quality");
const bitrateSel = $("bitrate");
const progressCard = $("progressCard");
const progressState = $("progressState");
const progressPct = $("progressPct");
const barFill = $("barFill");
const progressNote = $("progressNote");
const resultCard = $("resultCard");
const resultName = $("resultName");
const player = $("player");
const saveBtn = $("saveBtn");
const downloadLink = $("downloadLink");
const saveHint = $("saveHint");

// ---- 状態 ----
let ffmpeg = null;      // 遅延ロード
let ffmpegReady = false;
let currentFile = null;
let lastResult = null;  // { blob, filename, url }

// ---- ユーティリティ ----
function humanSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  const u = ["KB", "MB", "GB"];
  let i = -1, n = bytes;
  do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
  return n.toFixed(n < 10 ? 1 : 0) + " " + u[i];
}

function baseName(name) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

function setProgress(pct, state) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  barFill.style.width = p + "%";
  progressPct.textContent = p + "%";
  if (state) progressState.textContent = state;
}

// ---- ファイル選択 ----
function acceptFile(file) {
  if (!file) return;
  currentFile = file;
  fiName.textContent = file.name;
  fiSize.textContent = humanSize(file.size);
  fileInfo.hidden = false;
  runBtn.disabled = false;
  resultCard.hidden = true;
  if (file.size > 500 * 1024 * 1024) {
    progressNote.textContent = "⚠ ファイルが大きめ(" + humanSize(file.size) +
      ")。スマホのメモリ上限で失敗する場合は短く切ってお試しを。";
  }
}

fileInput.addEventListener("change", (e) => acceptFile(e.target.files[0]));

fiClear.addEventListener("click", (e) => {
  e.preventDefault();
  currentFile = null;
  fileInput.value = "";
  fileInfo.hidden = true;
  runBtn.disabled = true;
});

// ドラッグ&ドロップ(PC用)
["dragover", "dragenter"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add("dragover"); })
);
["dragleave", "drop"].forEach((ev) =>
  dropzone.addEventListener(ev, () => dropzone.classList.remove("dragover"))
);
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  const f = e.dataTransfer.files[0];
  if (f) acceptFile(f);
});

// ---- 形式セグメント ----
document.querySelectorAll('input[name="fmt"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    document.querySelectorAll(".seg").forEach((s) =>
      s.classList.toggle("selected", s.querySelector("input").checked)
    );
    mp3Quality.hidden = getFormat() !== "mp3";
  });
});
function getFormat() {
  return document.querySelector('input[name="fmt"]:checked').value;
}

// ---- ffmpeg 読み込み(初回のみ) ----
async function ensureFFmpeg() {
  if (ffmpegReady) return;
  ffmpeg = new FFmpeg();
  ffmpeg.on("progress", ({ progress }) => {
    // progress: 0..1（変換フェーズ）。10〜99% にマッピング
    const pct = 10 + Math.min(0.99, Math.max(0, progress)) * 89;
    setProgress(pct, "変換中…");
  });
  setProgress(3, "エンジンを読み込み中…");
  // 絶対URLで渡す。ffmpeg内部はこれらを自身の基準URLで解決するため、
  // 相対パスだと誤った場所を参照してWorker生成に失敗する。
  const v = new URL("./vendor/ffmpeg/", location.href).href;
  await ffmpeg.load({
    classWorkerURL: v + "814.ffmpeg.js",
    coreURL: v + "ffmpeg-core.js",
    wasmURL: v + "ffmpeg-core.wasm",
  });
  ffmpegReady = true;
}

// ---- 実行 ----
runBtn.addEventListener("click", async () => {
  if (!currentFile) return;
  const fmt = getFormat();

  runBtn.disabled = true;
  resultCard.hidden = true;
  progressCard.hidden = false;
  progressNote.textContent = "初回はエンジン(約32MB)を読み込みます。少し待ってね。";
  setProgress(1, "準備中…");

  try {
    await ensureFFmpeg();

    setProgress(8, "ファイルを読み込み中…");
    const inName = "input" + (currentFile.name.match(/\.[^.]+$/)?.[0] || ".dat");
    await ffmpeg.writeFile(inName, await fetchFile(currentFile));

    const outName = "output." + fmt;
    const args = ["-i", inName, "-vn"];
    if (fmt === "mp3") {
      args.push("-c:a", "libmp3lame", "-b:a", bitrateSel.value + "k");
    } else {
      args.push("-c:a", "pcm_s16le");
    }
    args.push(outName);

    setProgress(10, "変換中…");
    const code = await ffmpeg.exec(args);
    if (code !== 0) throw new Error("変換に失敗しました (code " + code + ")");

    const data = await ffmpeg.readFile(outName);
    const mime = fmt === "mp3" ? "audio/mpeg" : "audio/wav";
    const blob = new Blob([data.buffer], { type: mime });

    // 後片付け(メモリ解放)
    try { await ffmpeg.deleteFile(inName); await ffmpeg.deleteFile(outName); } catch (_) {}

    const filename = baseName(currentFile.name) + "." + fmt;
    showResult(blob, filename);
    setProgress(100, "完了");
  } catch (err) {
    console.error(err);
    progressState.textContent = "エラー";
    progressNote.textContent = "⚠ " + (err && err.message ? err.message : err) +
      "\nファイルを短くする / 形式をWAVに変える等をお試しください。";
    runBtn.disabled = false;
    return;
  }

  progressCard.hidden = true;
  runBtn.disabled = false;
});

// ---- 結果表示 ----
function showResult(blob, filename) {
  if (lastResult?.url) URL.revokeObjectURL(lastResult.url);
  const url = URL.createObjectURL(blob);
  lastResult = { blob, filename, url };

  resultName.textContent = filename + "（" + humanSize(blob.size) + "）";
  player.src = url;
  downloadLink.href = url;
  downloadLink.download = filename;
  saveHint.textContent = "";
  resultCard.hidden = false;
  resultCard.scrollIntoView({ behavior: "smooth", block: "center" });
}

// ---- 保存 / 共有 ----
saveBtn.addEventListener("click", async () => {
  if (!lastResult) return;
  const { blob, filename } = lastResult;
  const file = new File([blob], filename, { type: blob.type });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      saveHint.textContent = "共有シートから「ファイルに保存」やアプリを選べます。";
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return; // ユーザーがキャンセル
    }
  }
  // フォールバック: ダウンロード
  downloadLink.click();
  saveHint.textContent = "ダウンロードを開始しました。見つからない時は端末の「ダウンロード」フォルダを確認。";
});

// ---- Service Worker(オフライン化) ----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((e) => console.warn("SW登録失敗", e));
  });
}
