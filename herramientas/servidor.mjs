#!/usr/bin/env node
/**
 * Servidor de casa para "Pájaros Locos".
 *
 * Sirve el juego y la página dedicada `crear.html`, y le da a esa página un
 * par de botones que funcionan de verdad:
 *   POST /api/crear   {desc,nombre,poder}  -> habla con Codex/ChatGPT (stdin/stdout),
 *                                             recorta el fondo y mete el pájaro en el juego
 *   POST /api/borrar  {id}                 -> lo quita
 *   GET  /api/pajaros                      -> los que hay
 *
 *   node herramientas/servidor.mjs           (y abre http://127.0.0.1:8123/crear.html)
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { creaPajaro, borraPajaro } from "./crear-pajaro.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUERTO = Number(process.env.PUERTO || 8123);

const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json",
  ".css": "text/css; charset=utf-8", ".ico": "image/x-icon",
};

function cuerpo(req) {
  return new Promise((res, rej) => {
    let d = "";
    req.on("data", (c) => { d += c; if (d.length > 1e6) req.destroy(); });
    req.on("end", () => { try { res(d ? JSON.parse(d) : {}); } catch (e) { rej(e); } });
    req.on("error", rej);
  });
}
function json(res, code, obj) {
  const s = JSON.stringify(obj);
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(s);
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/pajaros") {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(RAIZ, "pajaros", "pajaros.json"), "utf-8"));
      return json(res, 200, j);
    } catch { return json(res, 200, { version: 1, pajaros: [] }); }
  }

  if (url.pathname === "/api/crear" && req.method === "POST") {
    try {
      const pet = await cuerpo(req);
      console.log(`[crear] ${pet.nombre || ""} — ${pet.desc || ""}`);
      const fila = await creaPajaro({ ...pet, log: (m) => console.log("   " + m) });
      return json(res, 200, { ok: true, pajaro: fila });
    } catch (e) {
      console.error("[crear] fallo:", e.message);
      return json(res, 200, { ok: false, error: e.message });
    }
  }

  if (url.pathname === "/api/borrar" && req.method === "POST") {
    try {
      const { id } = await cuerpo(req);
      return json(res, 200, { ok: borraPajaro(id) });
    } catch (e) { return json(res, 200, { ok: false, error: e.message }); }
  }

  // ficheros del juego
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/" || rel === "") rel = "/index.html";
  const destino = path.join(RAIZ, rel);
  if (!destino.startsWith(RAIZ)) { res.writeHead(403).end("no"); return; }
  fs.readFile(destino, (err, datos) => {
    if (err) { res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("No está: " + rel); return; }
    res.writeHead(200, { "content-type": TIPOS[path.extname(destino).toLowerCase()] || "application/octet-stream",
                         "cache-control": "no-store" });
    res.end(datos);
  });
});

servidor.listen(PUERTO, "127.0.0.1", () => {
  console.log(`🐦 Pájaros Locos en marcha:`);
  console.log(`   Juego:            http://127.0.0.1:${PUERTO}/index.html`);
  console.log(`   Fábrica de aves:  http://127.0.0.1:${PUERTO}/crear.html`);
  console.log(`   (Ctrl+C para parar)`);
});
