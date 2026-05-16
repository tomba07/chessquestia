#!/usr/bin/env node
/**
 * Download Maia 3 model, ORT WASM, and move mapping files.
 * Run once before starting the server.
 */

const https = require("https");
const http  = require("http");
const fs    = require("fs");
const path  = require("path");

const ASSETS = {
  "data/all_moves_maia3.json":
    "https://raw.githubusercontent.com/CSSLab/maia-platform-frontend/main/src/lib/engine/data/all_moves_maia3.json",
  "data/all_moves_maia3_reversed.json":
    "https://raw.githubusercontent.com/CSSLab/maia-platform-frontend/main/src/lib/engine/data/all_moves_maia3_reversed.json",
  "maia3/maia3_simplified.onnx":
    "https://github.com/CSSLab/maia-platform-frontend/raw/main/public/maia3/maia3_simplified.onnx",
  "ort/ort.wasm.min.js":
    "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.3/dist/ort.wasm.min.js",
  "ort/ort-wasm-simd.wasm":
    "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.3/dist/ort-wasm-simd.wasm",
  "ort/ort-wasm.wasm":
    "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.3/dist/ort-wasm.wasm",
};

function download(dest, url) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) {
      console.log(`  skip  ${dest}`);
      return resolve();
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    process.stdout.write(`  fetch ${dest} ... `);

    const client = url.startsWith("https") ? https : http;
    client.get(url, (res) => {
      // follow redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        return download(dest, res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const total = parseInt(res.headers["content-length"] || "0", 10);
      let received = 0;
      const out = fs.createWriteStream(dest);
      res.on("data", (chunk) => {
        received += chunk.length;
        if (total) {
          const pct = Math.floor(received / total * 100);
          process.stdout.write(`\r  fetch ${dest} ... ${pct}%`);
        }
      });
      res.pipe(out);
      out.on("finish", () => {
        const kb = Math.floor(fs.statSync(dest).size / 1024).toLocaleString();
        console.log(`\r  done  ${dest} (${kb} KB)       `);
        resolve();
      });
      out.on("error", reject);
    }).on("error", reject);
  });
}

(async () => {
  console.log("Downloading assets…");
  for (const [dest, url] of Object.entries(ASSETS)) {
    await download(dest, url);
  }
  console.log("All assets ready.");
})();
