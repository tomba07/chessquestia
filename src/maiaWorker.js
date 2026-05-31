export function createMaiaWorker({
  elements,
  getCoop,
  readSoloProgress,
  onReady,
  onPendingSoloStart,
}) {
  const {
    statusDot,
    statusLabel,
    downloadBtn,
    modelLoadingEl,
    progressBar,
    progressFill,
  } = elements;

  const worker = new Worker("/maia-worker.js");
  const pending = new Map();
  let inferenceId = 0;
  let modelReady = false;
  let modelDownloadRequested = false;

  function showModelLoading(text = "Preparing game...") {
    modelLoadingEl.style.display = "flex";
    statusLabel.textContent = text;
  }

  function hideModelLoading() {
    modelLoadingEl.style.display = "none";
    downloadBtn.style.display = "none";
    progressBar.classList.remove("visible");
  }

  function requestModelDownload() {
    if (modelDownloadRequested || modelReady) return;
    modelDownloadRequested = true;
    worker.postMessage({ type: "download" });
  }

  function syncMaiaStatus() {
    const coop = getCoop();
    if (coop?.ws?.readyState === WebSocket.OPEN) {
      coop.ws.send(JSON.stringify({
        type: "maia-status",
        ready: modelReady,
        unlockedOpponentCount: readSoloProgress(),
      }));
    }
  }

  function handleModelStatus(status) {
    const coop = getCoop();
    if (status === "loading") {
      modelReady = false;
      statusDot.className = "status-dot working";
      if (onPendingSoloStart() || coop?.phase === "lobby") showModelLoading("Preparing game...");
    } else if (status === "no-cache") {
      modelReady = false;
      statusDot.className = "status-dot working";
      if (onPendingSoloStart() || coop?.phase === "lobby") showModelLoading("Preparing game...");
      downloadBtn.style.display = "none";
      requestModelDownload();
    } else if (status === "downloading") {
      modelReady = false;
      statusDot.className = "status-dot working";
      if (onPendingSoloStart() || coop?.phase === "lobby") showModelLoading("Preparing game...");
      downloadBtn.style.display = "none";
      progressBar.classList.add("visible");
    } else if (status === "ready") {
      modelReady = true;
      modelDownloadRequested = false;
      statusDot.className = "status-dot ready";
      hideModelLoading();
      onReady();
    }
    syncMaiaStatus();
  }

  worker.onmessage = ({ data: msg }) => {
    if (msg.type === "inference-result") {
      const r = pending.get(msg.id);
      pending.delete(msg.id);
      r?.resolve({ logitsMove: new Float32Array(msg.logitsMove) });
    } else if (msg.type === "status") {
      handleModelStatus(msg.status);
    } else if (msg.type === "progress") {
      progressFill.style.width = `${msg.progress}%`;
    } else if (msg.type === "error") {
      const r = pending.get(msg.id);
      if (r) {
        pending.delete(msg.id);
        r.reject(new Error(msg.message));
      } else {
        modelReady = false;
        modelDownloadRequested = false;
        statusDot.className = "status-dot error";
        showModelLoading("The game model could not load.");
        downloadBtn.style.display = "inline-flex";
        syncMaiaStatus();
      }
    }
  };

  worker.postMessage({ type: "init", modelUrl: "/maia3/maia3_simplified.onnx", modelVersion: "3" });

  function runInference(tokens, elo) {
    return new Promise((resolve, reject) => {
      const id = inferenceId++;
      pending.set(id, { resolve, reject });
      const t = tokens.slice();
      worker.postMessage(
        { type: "inference", id, tokens: t.buffer, eloSelfs: [elo], eloOppos: [elo], batchSize: 1 },
        [t.buffer],
      );
    });
  }

  function bindDownloadButton() {
    downloadBtn.onclick = () => requestModelDownload();
  }

  return {
    bindDownloadButton,
    get modelReady() { return modelReady; },
    hideModelLoading,
    requestModelDownload,
    runInference,
    showModelLoading,
    syncMaiaStatus,
  };
}
