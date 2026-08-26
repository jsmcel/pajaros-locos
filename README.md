# 🐦 Pájaros Locos

Un juego tipo *Angry Birds* pensado para peques de **6 años**: **30 niveles** hechos con
dificultad progresiva, un **editor** para construir el tuyo, y **todos los pájaros**
—cada uno con su poder— para elegir quién vuela.

**🎮 Jugar ahora:** https://jsmcel.github.io/pajaros-locos/
**📱 Descargar el APK:** https://github.com/jsmcel/pajaros-locos/releases/latest

## Qué tiene

- **🗺️ 30 niveles** de menos a más difícil: de una casita con un cerdito a fortalezas de
  piedra con TNT. Guarda las estrellas de cada uno (3 si te sobran pájaros).
- **🔨 Modo construir**: tocas una pieza abajo y tocas la pantalla para ponerla.
  Cajas, vigas, columnas, hielo, piedra, TNT, cerditos y el cerdo jefe. Se arrastran para moverlas.
- **🐦 Todos los pájaros**: los clásicos, el equipo rosa, los del espacio, la leyenda y los
  invitados. Se eligen en el botón 🐦 y se colocan en la fila del tirachinas (hasta 8).
- **✨ Poderes**: mientras el pájaro vuela, **tocas la pantalla** y usa el suyo
  (acelerón, bombazo, trillizos, huevo, bumerán, hielo, puntería, furia…).
- **📷 Mi pájaro**: haces un dibujo en un papel, le sacas una foto y el juego
  **recorta el dibujo, le quita el fondo y lo convierte en un pájaro más** de tu equipo.
- **🎨 Fábrica de pájaros con IA**: describes un pájaro y ChatGPT lo dibuja sin fondo;
  aparece solo dentro del juego (ver abajo).
- **🎵 Música** y sonidos sintetizados, sin archivos. Se apagan con 🎵 y 🔊.
- Física de verdad (Matter.js) y todo en español.
- Se guarda solo: nivel, equipo de pájaros, estrellas y dibujos.

## Pensado para manos pequeñas

- Botones grandes con dibujos, casi sin texto que leer.
- **Ningún cartel tapa el juego**: los marcadores viven en las barras de arriba y abajo,
  y cuando se abre una ventana el juego **se pausa** en vez de seguir por detrás.
- El tirachinas se coge desde toda la zona de la izquierda, no hace falta apuntar fino.
- No se puede perder de mala manera: si se acaban los pájaros dice *"¡Casi casi!"*.

## Los pájaros y sus poderes

| Pájaro | Poder |
|---|---|
| Rojo | 💥 Grito que empuja todo |
| Rayo | ⚡ Acelerón |
| Bomba | 💣 Explota |
| Los Azules | 3️⃣ Se convierte en tres |
| Blanca | 🥚 Suelta un huevo bomba |
| Bumerán | 🪃 Da la vuelta |
| Grandote | 💪 Fuerza bruta (no necesita poder) |
| Burbuja | 🎈 Se hincha |
| Plata | 🌀 Cae en picado |
| Rosa / Amapola / Lucas / Dalia | 🫧 Burbujas · 🥁 Tambor · 🦘 Rebote · ✨ Teletransporte |
| Hielo / Láser | ❄️ Congela · 🎯 Va a donde toques |
| Águila | 🦅 Furia |
| Invitados (Tomás, Rayo Veloz, Lemi, Grizzy, Camión) | 🚂 Vapor · 🏎️ Turbo · 👥 Tropa · 🐻 Zarpazo · 🛞 Ruedas |

## Cómo está hecho

```
index.html            El juego entero (HTML + CSS + JS, sin dependencias externas)
crear.html            Página dedicada para inventar pájaros con IA
matter.min.js         Motor de física
pajaros/              Pájaros en PNG sin fondo + pajaros.json (el juego los carga solo)
imagenes/             Imágenes originales de las que salen los invitados
herramientas/         Los scripts de fabricación (ver abajo)
android/              App Android: un WebView + el puente a la cámara
.github/workflows/    Compila el APK en la nube y lo publica en Releases
```

No hace falta instalar nada para tocar el juego: se edita `index.html` y ya.

## 🎨 Fabricar pájaros nuevos

Los pájaros de `pajaros/pajaros.json` **se meten solos** en el juego (aparecen en el
selector 🐦, en su grupo). Hay dos maneras de fabricarlos:

### 1. Inventar uno con ChatGPT (codex por stdin/stdout)

```bash
node herramientas/servidor.mjs      # y abre http://127.0.0.1:8123/crear.html
```

La página dedicada pide la descripción y el poder; el servidor le pasa el encargo a
`codex exec -` **por la entrada estándar**, lee por la **salida estándar** la ruta del PNG
generado, le quita el fondo y lo apunta en el manifiesto. También va suelto:

```bash
node herramientas/crear-pajaro.mjs "un pájaro pirata con parche" --nombre "Capitán Pico"
echo '{"desc":"pájaro astronauta","poder":"turbo"}' | node herramientas/crear-pajaro.mjs --stdin
```

Hace falta tener el CLI `codex` instalado y con la sesión iniciada.

### 2. Recortar personajes de una imagen con Gemini

Para convertir una imagen de `imagenes/` en un pájaro jugable se usa el mismo truco que
en *libros jorge*: el relay CDP contra el Chrome del usuario (su perfil, su sesión) y una
**página dedicada** de Gemini, al que se le pide el personaje solo, simplificado y sobre
**fondo blanco**; luego `quita_fondo.py` lo deja transparente y recortado.

```bash
node herramientas/recorta-gemini.mjs                # los que falten
node herramientas/recorta-gemini.mjs --solo tomas --force
node herramientas/recorta-gemini.mjs --solo-recorte # sin Gemini: repasa el PNG ya bajado
```

El módulo del relay se coge de la variable `GEMINI_RELAY` (por defecto, el de
`libros jorge/robyot/scripts/cdpGeminiRelay_robyot.mjs`). Necesita el gateway de
JoseRelay levantado.

### Compilar el APK

Se compila solo en GitHub Actions con cada `push` a `main`. Para hacerlo en local
hace falta el SDK de Android:

```bash
cp index.html matter.min.js android/app/src/main/assets/
cp -r pajaros android/app/src/main/assets/
cd android && gradle assembleDebug
```

El APK sale en `android/app/build/outputs/apk/debug/app-debug.apk`.

---

Hecho con [Claude Code](https://claude.com/claude-code).
