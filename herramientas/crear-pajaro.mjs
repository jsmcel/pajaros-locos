#!/usr/bin/env node
/**
 * Crea un pájaro nuevo con IA (imagen SIN FONDO) para "Pájaros Locos".
 *
 * Habla con Codex/ChatGPT por STDIN y STDOUT: le mandamos el encargo por la
 * entrada estándar (`codex exec -`) y leemos por la salida estándar la ruta del
 * PNG que ha generado. Después se le quita el fondo (si viene sobre blanco),
 * se recorta y se apunta en `pajaros/pajaros.json`, que el juego lee al
 * arrancar: el pájaro se mete solo, sin tocar código.
 *
 *   node herramientas/crear-pajaro.mjs "un pájaro pirata con parche"
 *   node herramientas/crear-pajaro.mjs --nombre Pirata --poder acelera "un pájaro pirata"
 *   echo '{"desc":"pájaro astronauta","nombre":"Astro"}' | node herramientas/crear-pajaro.mjs --stdin
 *
 * Con --stdin lee una petición JSON por línea y escribe una respuesta JSON por
 * línea, para poder encadenarlo con otros programas.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..");
const DIR_PAJAROS = path.join(RAIZ, "pajaros");
const MANIFIESTO = path.join(DIR_PAJAROS, "pajaros.json");

const PODERES = [
  "grito","acelera","explota","divide","huevo","vuelve","hincha","burbujas","picado",
  "congela","laser","furia","salto","teletransporte","tambor","tren","turbo","tropa",
  "zarpazo","ruedas",
];

function limpiaId(txt) {
  return String(txt || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 28) || "pajaro";
}

function idLibre(base) {
  const usados = new Set(leeManifiesto().pajaros.map((p) => p.id));
  let id = base, n = 2;
  while (usados.has(id) || fs.existsSync(path.join(DIR_PAJAROS, id + ".png"))) id = `${base}-${n++}`;
  return id;
}

function leeManifiesto() {
  try {
    const j = JSON.parse(fs.readFileSync(MANIFIESTO, "utf-8"));
    if (!Array.isArray(j.pajaros)) j.pajaros = [];
    return j;
  } catch {
    return { version: 1, pajaros: [] };
  }
}

function apunta(fila) {
  const j = leeManifiesto();
  const i = j.pajaros.findIndex((p) => p && p.id === fila.id);
  if (i >= 0) j.pajaros[i] = fila; else j.pajaros.push(fila);
  fs.mkdirSync(DIR_PAJAROS, { recursive: true });
  fs.writeFileSync(MANIFIESTO, JSON.stringify(j, null, 2) + "\n", "utf-8");
  return fila;
}

function encargo(desc, destino) {
  // Sin lineas en blanco ni adornos: es una orden corta y clara.
  return [
    'Eres el generador de pajaros del juego infantil "Pajaros Locos".',
    `Genera UNA imagen PNG de 1024x1024 con FONDO TRANSPARENTE de este personaje: ${desc}.`,
    "Estilo obligatorio: pajaro de videojuego 2D tipo Angry Birds, cuerpo redondo y rechoncho,",
    "ojos grandes y expresivos, contorno marcado, colores planos, mirando hacia la DERECHA,",
    "cuerpo entero centrado y grande, sin texto, sin numeros, sin logos, sin sombra y sin escenario.",
    "Si tu herramienta de imagenes no admite fondo transparente, hazla sobre BLANCO PURO liso.",
    `Guarda el PNG final EXACTAMENTE en esta ruta: ${destino}`,
    "No crees ni modifiques ningun otro archivo del proyecto.",
    `Cuando este guardado responde SOLO con esta linea: LISTO:${destino}`,
  ].join("\n");
}

function ultimaImagenCodex(desde) {
  const raiz = path.join(os.homedir(), ".codex", "generated_images");
  let mejor = null;
  const mira = (dir) => {
    let e = [];
    try { e = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const f of e) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) mira(p);
      else if (/\.(png|webp|jpg|jpeg)$/i.test(f.name)) {
        const st = fs.statSync(p);
        if (st.mtimeMs >= desde && (!mejor || st.mtimeMs > mejor.t)) mejor = { p, t: st.mtimeMs };
      }
    }
  };
  mira(raiz);
  return mejor && mejor.p;
}

/** Lanza `codex exec -` metiendole el encargo por stdin y leyendo su stdout. */
function pideACodex(texto, { timeoutMs = 600000, log = () => {} } = {}) {
  return new Promise((resolve, reject) => {
    const salidaUlt = path.join(os.tmpdir(), `pajaro-${Date.now()}.txt`);
    const esWin = process.platform === "win32";
    // En Windows codex es un .cmd: hay que pasar por el shell (y entrecomillar rutas).
    const args = ["exec", "--sandbox", "workspace-write", "--cd", RAIZ, "-o", salidaUlt, "-"];
    const hijo = spawn(
      esWin ? "codex.cmd" : "codex",
      esWin ? args.map((a) => (/\s/.test(a) ? `"${a}"` : a)) : args,
      { stdio: ["pipe", "pipe", "pipe"], shell: esWin }
    );
    let out = "", err = "";
    const reloj = setTimeout(() => { hijo.kill(); reject(new Error("Codex ha tardado demasiado")); }, timeoutMs);
    hijo.stdout.on("data", (d) => { out += d; log(String(d).trimEnd()); });
    hijo.stderr.on("data", (d) => { err += d; });
    hijo.on("error", (e) => { clearTimeout(reloj); reject(new Error(`No he podido arrancar codex: ${e.message}`)); });
    hijo.on("close", () => {
      clearTimeout(reloj);
      let ultimo = "";
      try { ultimo = fs.readFileSync(salidaUlt, "utf-8"); fs.unlinkSync(salidaUlt); } catch {}
      resolve({ out, err, ultimo });
    });
    hijo.stdin.write(texto);
    hijo.stdin.end();
  });
}

function quitaFondo(entrada, salida) {
  const out = execFileSync(
    "python",
    [path.join(RAIZ, "herramientas", "quita_fondo.py"), entrada, salida, "--lado", "420"],
    { encoding: "utf-8" }
  );
  const m = out.match(/(\d+)x(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

export async function creaPajaro({ desc, nombre, poder, log = () => {} } = {}) {
  if (!desc || !String(desc).trim()) throw new Error("Dime cómo es el pájaro");
  const id = idLibre(limpiaId(nombre || desc));
  const bruto = path.join(RAIZ, "imagenes", "ia", `${id}_bruto.png`);
  const destino = path.join(DIR_PAJAROS, `${id}.png`);
  fs.mkdirSync(path.dirname(bruto), { recursive: true });
  fs.mkdirSync(DIR_PAJAROS, { recursive: true });

  const t0 = Date.now() - 1000;
  log(`🎨 Le pido el pájaro a ChatGPT (codex)…`);
  const { out, ultimo } = await pideACodex(encargo(desc, bruto.replace(/\\/g, "/")), { log });

  let fuente = null;
  const texto = `${ultimo}\n${out}`;
  const m = texto.match(/LISTO:\s*(\S.*?)\s*$/m);
  if (m && fs.existsSync(m[1].trim())) fuente = m[1].trim();
  if (!fuente && fs.existsSync(bruto)) fuente = bruto;
  if (!fuente) fuente = ultimaImagenCodex(t0);
  if (!fuente || !fs.existsSync(fuente)) {
    throw new Error("Codex no ha dejado ninguna imagen. Mira lo que ha contestado: " + texto.slice(-400));
  }

  log(`✂️ Quitando el fondo…`);
  const tam = quitaFondo(fuente, destino);

  const fila = apunta({
    id,
    nombre: nombre || desc.slice(0, 18),
    serie: "Hechos con IA",
    archivo: `${id}.png`,
    poder: PODERES.includes(poder) ? poder : PODERES[Math.floor(Math.random() * PODERES.length)],
    r: 30,
    dens: 0.005,
    pot: 1.15,
    ancho: tam ? tam[0] : undefined,
    alto: tam ? tam[1] : undefined,
    desc: String(desc).slice(0, 200),
  });
  log(`✅ ${fila.nombre} ya vuela (poder: ${fila.poder})`);
  return fila;
}

export function borraPajaro(id) {
  const j = leeManifiesto();
  const i = j.pajaros.findIndex((p) => p && p.id === id);
  if (i < 0) return false;
  const [fuera] = j.pajaros.splice(i, 1);
  fs.writeFileSync(MANIFIESTO, JSON.stringify(j, null, 2) + "\n", "utf-8");
  try { fs.unlinkSync(path.join(DIR_PAJAROS, fuera.archivo)); } catch {}
  return true;
}

/* ---------------- linea de comandos ---------------- */
const esPrincipal = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (esPrincipal) {
  const args = process.argv.slice(2);
  const opt = { desc: "", nombre: "", poder: "", stdin: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--stdin") opt.stdin = true;
    else if (args[i] === "--nombre") opt.nombre = args[++i];
    else if (args[i] === "--poder") opt.poder = args[++i];
    else opt.desc += (opt.desc ? " " : "") + args[i];
  }

  if (opt.stdin) {
    // protocolo por lineas: entra JSON, sale JSON
    const rl = readline.createInterface({ input: process.stdin });
    for await (const linea of rl) {
      const t = linea.trim();
      if (!t) continue;
      let pet;
      try { pet = t.startsWith("{") ? JSON.parse(t) : { desc: t }; }
      catch (e) { console.log(JSON.stringify({ ok: false, error: "JSON malo: " + e.message })); continue; }
      try {
        const fila = await creaPajaro({ ...pet, log: (m) => process.stderr.write(m + "\n") });
        console.log(JSON.stringify({ ok: true, pajaro: fila }));
      } catch (e) {
        console.log(JSON.stringify({ ok: false, error: e.message }));
      }
    }
  } else {
    try {
      const fila = await creaPajaro({ ...opt, log: (m) => console.log(m) });
      console.log(JSON.stringify(fila, null, 2));
    } catch (e) {
      console.error("[fallo]", e.message);
      process.exit(1);
    }
  }
}
