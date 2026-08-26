#!/usr/bin/env node
/**
 * Fabrica de pajaros a partir de las imagenes de `imagenes/`.
 *
 * Usa el mismo truco que en "libros jorge": el relay CDP (JoseRelay) contra el
 * Chrome del usuario -con su perfil y su sesion ya iniciada- y una PAGINA
 * DEDICADA de Gemini. Se le manda la imagen original y se le pide el personaje
 * solo, simplificado y sobre FONDO BLANCO; despues `quita_fondo.py` deja el
 * PNG transparente y se apunta en `pajaros/pajaros.json`, que el juego lee al
 * arrancar (o sea: el pajaro se mete solo).
 *
 *   node herramientas/recorta-gemini.mjs                 # todos los que falten
 *   node herramientas/recorta-gemini.mjs --solo tomas    # solo uno
 *   node herramientas/recorta-gemini.mjs --force         # rehacer aunque exista
 *   node herramientas/recorta-gemini.mjs --solo-recorte  # sin Gemini: repasa el PNG blanco ya bajado
 *
 * El modulo del relay se coge de GEMINI_RELAY o de la ruta por defecto.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..");
const RELAY_POR_DEFECTO =
  "C:/Users/Jose-Firebat/proyectos/libros jorge/robyot/scripts/cdpGeminiRelay_robyot.mjs";

const PERSONAJES = [
  {
    id: "tomas",
    nombre: "Tomás",
    serie: "Invitados",
    origen: "imagenes/2e764147-039a-410d-9c11-e2165bb56a46.png",
    quien:
      "el pájaro azul redondo con chimenea de tren negra en la cabeza, cejas negras, " +
      "pico amarillo abierto, barriga beige y el número 1 amarillo en el costado",
    poder: "tren",
    r: 30,
    dens: 0.0062,
    pot: 1.4,
    voltea: true,          // Gemini lo dibuja mirando a la izquierda
  },
  {
    id: "rayoveloz",
    nombre: "Rayo Veloz",
    serie: "Invitados",
    origen: "imagenes/77a6012e-7d29-4644-ba35-d2a9a5e30d0f.png",
    quien:
      "el pájaro rojo redondo de carreras, con cejas negras gruesas, copete de tres plumas rojas, " +
      "pico amarillo, barriga beige y un alerón rojo detrás",
    poder: "turbo",
    r: 29,
    dens: 0.0058,
    pot: 1.35,
    voltea: true,
  },
  {
    id: "lemi",
    nombre: "Lemi",
    serie: "Invitados",
    origen: "imagenes/b2da60d4-97fb-40ca-9334-0e6acc032bc1.png",
    quien:
      "el pájaro grande azul lila del centro, con pelo verde de hojas, ojos muy abiertos, " +
      "pico naranja abierto y barriga gris clara (ignora a los pequeños y al oso)",
    poder: "tropa",
    r: 31,
    dens: 0.0060,
    pot: 1.2,
  },
  {
    id: "grizzy",
    nombre: "Grizzy",
    serie: "Invitados",
    origen: "imagenes/b2da60d4-97fb-40ca-9334-0e6acc032bc1.png",
    quien:
      "el oso marrón redondo de la derecha, con cejas negras enfadadas, hocico claro y dientes " +
      "(solo el oso, nada de pájaros ni de fondo)",
    poder: "zarpazo",
    r: 34,
    dens: 0.0072,
    pot: 1.6,
  },
  {
    id: "camion",
    nombre: "Camión Rojo",
    serie: "Invitados",
    origen: "imagenes/53004e2e-0c62-447f-bd5a-ac64115b2cea.jpg",
    quien:
      "el camión monstruo azul con cabeza de pájaro rojo enfadado encima y ruedas enormes",
    poder: "ruedas",
    r: 36,
    dens: 0.0085,
    pot: 2.0,
  },
  {
    id: "cerdicoche",
    nombre: "Cerdi-Coche",
    serie: "Invitados",
    origen: "imagenes/2d2d3444-f818-48f1-8f9a-73e9a64aac82.png",
    quien:
      "el coche-cerdito verde con cara de cerdo sonriente, orejas, hocico y alerón trasero",
    poder: "ruedas",
    r: 36,
    dens: 0.0080,
    pot: 1.8,
    cerdo: true,
  },
];

function prompt(p) {
  // TODO en una sola linea: el compositor de Gemini se come los saltos de linea
  // y el relay aborta al comprobar que el texto pegado coincide con el enviado.
  return [
    "Mira la imagen adjunta y devuelveme UNA IMAGEN nueva.",
    `Quiero SOLO ${p.quien}, recortado y simplificado.`,
    "Reglas: FONDO BLANCO PURO (#FFFFFF) liso de borde a borde, sin cielo, sin hierba, sin carretera, sin degradados y sin sombra;",
    "el personaje entero y centrado ocupando casi toda la imagen, sin cortarse;",
    "mirando hacia la DERECHA;",
    "mismos colores que el original pero SIMPLIFICADO tipo juego 2D, con formas limpias, colores planos, contorno marcado y poco detalle, para que se entienda al verlo pequenito;",
    "sin texto, sin numeros, sin logos y sin marcas de agua;",
    "un solo personaje, sin copias ni objetos sueltos;",
    "imagen cuadrada. Devuelve solo la imagen.",
  ].join(" ");
}

function args() {
  const a = process.argv.slice(2);
  const o = { solo: null, force: false, debug: false, soloRecorte: false, timeoutMs: 300000 };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--solo") o.solo = new Set(String(a[++i] || "").split(",").map((s) => s.trim()));
    else if (a[i] === "--force") o.force = true;
    else if (a[i] === "--debug") o.debug = true;
    else if (a[i] === "--solo-recorte") o.soloRecorte = true;
    else if (a[i] === "--timeout-ms") o.timeoutMs = Number(a[++i]);
  }
  return o;
}

export function apunta(p, archivo, tam) {
  const manifiesto = path.join(RAIZ, "pajaros", "pajaros.json");
  let j = { version: 1, pajaros: [] };
  try {
    j = JSON.parse(fs.readFileSync(manifiesto, "utf-8"));
    if (!Array.isArray(j.pajaros)) j.pajaros = [];
  } catch {}
  const fila = {
    id: p.id,
    nombre: p.nombre,
    serie: p.serie || "Invitados",
    archivo,
    poder: p.poder,
    r: p.r || 28,
    dens: p.dens || 0.005,
    pot: p.pot || 1,
    cerdo: !!p.cerdo,
    voltea: !!p.voltea,
    ancho: tam ? tam[0] : undefined,
    alto: tam ? tam[1] : undefined,
  };
  const i = j.pajaros.findIndex((x) => x && x.id === p.id);
  if (i >= 0) j.pajaros[i] = fila;
  else j.pajaros.push(fila);
  fs.mkdirSync(path.dirname(manifiesto), { recursive: true });
  fs.writeFileSync(manifiesto, JSON.stringify(j, null, 2) + "\n", "utf-8");
  return fila;
}

function recorta(entrada, salida) {
  const out = execFileSync(
    "python",
    [path.join(RAIZ, "herramientas", "quita_fondo.py"), entrada, salida, "--lado", "420"],
    { encoding: "utf-8" }
  );
  const m = out.match(/(\d+)x(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

async function main() {
  const o = args();
  const lista = PERSONAJES.filter((p) => !o.solo || o.solo.has(p.id));
  if (!lista.length) throw new Error("Ningún personaje seleccionado");

  const dirTmp = path.join(RAIZ, "imagenes", "blanco");
  const dirOut = path.join(RAIZ, "pajaros");
  fs.mkdirSync(dirTmp, { recursive: true });
  fs.mkdirSync(dirOut, { recursive: true });

  let gemini = null;
  if (!o.soloRecorte) {
    const rutaRelay = process.env.GEMINI_RELAY || RELAY_POR_DEFECTO;
    if (!fs.existsSync(rutaRelay)) {
      throw new Error(
        `No encuentro el relay de Gemini en ${rutaRelay}. Ponlo en la variable GEMINI_RELAY.`
      );
    }
    const relay = await import(pathToFileURL(rutaRelay).href);
    if (!(await relay.isRelayAvailable())) {
      throw new Error(
        "JoseRelay no responde. Arranca el gateway (Chrome con tu perfil) y repite."
      );
    }
    // Pagina dedicada de Gemini: si no hay ninguna abierta, se crea una para esto.
    gemini = await relay.createGeminiRelay({
      debug: o.debug,
      geminiUrl: "https://gemini.google.com/u/1/app",
      targetPolicy: { geminiOnly: true, type: "page", allowAmbiguous: true },
      createIfMissingUrl: "https://gemini.google.com/u/1/app",
    });
    console.log(`[gemini] sesión=${gemini.sessionId} dedicada=${gemini.targetCreated}`);
  }

  for (const p of lista) {
    const destino = path.join(dirOut, `${p.id}.png`);
    if (!o.force && fs.existsSync(destino)) {
      console.log(`[salto] ${p.id} ya existe`);
      continue;
    }
    const blanco = path.join(dirTmp, `${p.id}_blanco.png`);

    if (!o.soloRecorte) {
      const origen = path.join(RAIZ, p.origen);
      if (!fs.existsSync(origen)) throw new Error(`Falta la imagen original: ${origen}`);
      let ok = false;
      let ultimo = null;
      for (let intento = 1; intento <= 3 && !ok; intento++) {
        try {
          console.log(`[gemini] ${p.id} intento ${intento}...`);
          await gemini.generateFunko(origen, blanco, {
            prompt: prompt(p),
            timeoutMs: o.timeoutMs,
            skipNavigate: intento === 1 ? false : true,
            resetContext: true,
          });
          ok = true;
        } catch (e) {
          ultimo = e;
          console.log(`[aviso] ${p.id} intento ${intento} falló: ${e?.message || e}`);
          await new Promise((r) => setTimeout(r, 2500 * intento));
        }
      }
      if (!ok) {
        console.log(`[error] ${p.id}: ${ultimo?.message || ultimo}`);
        continue;
      }
    }

    if (!fs.existsSync(blanco)) {
      console.log(`[error] ${p.id}: no hay imagen en ${blanco}`);
      continue;
    }
    const tam = recorta(blanco, destino);
    const fila = apunta(p, `${p.id}.png`, tam);
    console.log(`[ok] ${p.id} -> pajaros/${p.id}.png (${fila.ancho}x${fila.alto})`);
  }

  console.log("[fin] pájaros listos en pajaros/pajaros.json");
}

main().catch((e) => {
  console.error("[fallo]", e?.message || e);
  process.exit(1);
});
