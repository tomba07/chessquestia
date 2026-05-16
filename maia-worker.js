/**
 * Maia 3 Web Worker — runs ONNX inference off the main thread.
 * Ported from github.com/CSSLab/maia-platform-frontend (GPL-3.0)
 *
 * Messages FROM main thread:
 *   { type: 'init', modelUrl, modelVersion }
 *   { type: 'download' }
 *   { type: 'inference', id, tokens, eloSelfs, eloOppos, batchSize }
 *
 * Messages TO main thread:
 *   { type: 'status', status }         — 'loading'|'no-cache'|'downloading'|'ready'
 *   { type: 'progress', progress }     — 0–100
 *   { type: 'error', message, id? }
 *   { type: 'inference-result', id, logitsMove, logitsValue }
 */

importScripts('/ort/ort.wasm.min.js')

const ORT = ort
ORT.env.wasm.wasmPaths  = '/ort/'
ORT.env.wasm.numThreads = 1   // single-threaded: no SharedArrayBuffer required

// ── IndexedDB storage ────────────────────────────────────────────────────────

const DB_NAME    = 'MaiaModels'
const STORE_NAME = 'models'
const MODEL_KEY  = 'maia-rapid-model'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_NAME))
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
  })
}

async function getCachedModel(modelUrl, modelVersion) {
  const db   = await openDB()
  const data = await new Promise((resolve, reject) => {
    const req = db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).get(MODEL_KEY)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror   = () => reject(req.error)
  })
  if (!data) return null
  if (data.url !== modelUrl || data.version !== modelVersion) {
    const tx = db.transaction([STORE_NAME], 'readwrite')
    tx.objectStore(STORE_NAME).delete(MODEL_KEY)
    return null
  }
  return await data.data.arrayBuffer()
}

async function storeModel(modelUrl, modelVersion, buffer) {
  const db = await openDB()
  await new Promise((resolve, reject) => {
    const req = db.transaction([STORE_NAME], 'readwrite')
      .objectStore(STORE_NAME)
      .put({ id: MODEL_KEY, url: modelUrl, version: modelVersion, data: new Blob([buffer]), timestamp: Date.now() })
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

// ── Worker state ─────────────────────────────────────────────────────────────

let session      = null
let modelUrl     = null
let modelVersion = null

async function initSession(buffer) {
  session = await ORT.InferenceSession.create(buffer)
}

// ── Message handler ──────────────────────────────────────────────────────────

self.onmessage = async (e) => {
  const msg = e.data
  try {
    switch (msg.type) {

      case 'init': {
        modelUrl     = msg.modelUrl
        modelVersion = msg.modelVersion
        postMessage({ type: 'status', status: 'loading' })
        const buf = await getCachedModel(modelUrl, modelVersion)
        if (buf) {
          await initSession(buf)
          postMessage({ type: 'status', status: 'ready' })
        } else {
          postMessage({ type: 'status', status: 'no-cache' })
        }
        break
      }

      case 'download': {
        postMessage({ type: 'status',   status: 'downloading' })
        postMessage({ type: 'progress', progress: 0 })
        const response = await fetch(modelUrl)
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`)

        const contentLength = +(response.headers.get('Content-Length') || 0)
        const reader = response.body.getReader()
        const chunks = []
        let received = 0, lastPct = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          received += value.length
          if (contentLength) {
            const pct = Math.floor(received / contentLength * 100)
            if (pct >= lastPct + 10) {
              postMessage({ type: 'progress', progress: pct })
              lastPct = pct
            }
          }
        }

        const buffer = new Uint8Array(received)
        let pos = 0
        for (const chunk of chunks) { buffer.set(chunk, pos); pos += chunk.length }

        await storeModel(modelUrl, modelVersion, buffer.buffer)
        await initSession(buffer.buffer)
        postMessage({ type: 'progress', progress: 100 })
        postMessage({ type: 'status',   status: 'ready' })
        break
      }

      case 'inference': {
        if (!session) {
          postMessage({ type: 'error', message: 'Model not ready', id: msg.id })
          return
        }
        const { id, tokens, eloSelfs, eloOppos, batchSize } = msg
        const feeds = {
          tokens:   new ORT.Tensor('float32', new Float32Array(tokens),   [batchSize, 64, 12]),
          elo_self: new ORT.Tensor('float32', new Float32Array(eloSelfs), [batchSize]),
          elo_oppo: new ORT.Tensor('float32', new Float32Array(eloOppos), [batchSize]),
        }
        const result     = await session.run(feeds)
        const logitsMove  = new Float32Array(result.logits_move.data)
        const logitsValue = new Float32Array(result.logits_value.data)
        postMessage(
          { type: 'inference-result', id, logitsMove: logitsMove.buffer, logitsValue: logitsValue.buffer },
          [logitsMove.buffer, logitsValue.buffer],
        )
        break
      }
    }
  } catch (err) {
    postMessage({ type: 'error', message: err.message || 'Unknown worker error', id: msg?.id })
  }
}
