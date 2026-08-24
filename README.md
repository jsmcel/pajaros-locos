# 🐦 Pájaros Locos

Un juego tipo *Angry Birds* pensado para peques de **6 años**: primero **construyen** su
propio nivel tocando piezas, y luego lo **juegan** con el tirachinas.

**🎮 Jugar ahora:** https://jsmcel.github.io/pajaros-locos/
**📱 Descargar el APK:** https://github.com/jsmcel/pajaros-locos/releases/latest

## Qué tiene

- **🔨 Modo construir**: tocas una pieza abajo y tocas la pantalla para ponerla.
  Cajas, vigas, columnas, hielo, piedra, TNT y cerditos. Se arrastran para moverlas.
- **🚀 Modo jugar**: estiras el pájaro hacia atrás y lo sueltas. Con línea de puntos
  que enseña por dónde va a ir, para no fallar.
- **📷 Mi pájaro**: haces un dibujo en un papel, le sacas una foto y el juego
  **recorta el dibujo, le quita el fondo del papel y lo convierte en el pájaro**
  que sale volando. Se guardan hasta 8 dibujos.
- Física de verdad (Matter.js), sonidos, y todo en español.
- Se guarda solo: al volver, el nivel y los dibujos siguen ahí.

## Pensado para manos pequeñas

- Botones grandes con dibujos, casi sin texto que leer.
- No se puede perder de mala manera: si se acaban los pájaros dice *"¡Casi casi!"*.
- Avisa con dibujos cuando algo no cabe, en vez de dejar el nivel roto.
- Tres niveles de ejemplo con el botón 🎲 para empezar sin construir nada.

## Cómo está hecho

```
index.html          El juego entero (HTML + CSS + JS, sin dependencias externas)
matter.min.js       Motor de física
android/            App Android: un WebView + el puente a la cámara
.github/workflows/  Compila el APK en la nube y lo publica en Releases
```

No hace falta instalar nada para tocar el juego: se edita `index.html` y ya.

### Compilar el APK

Se compila solo en GitHub Actions con cada `push` a `main`. Para hacerlo en local
hace falta el SDK de Android:

```bash
cp index.html matter.min.js android/app/src/main/assets/
cd android && gradle assembleDebug
```

El APK sale en `android/app/build/outputs/apk/debug/app-debug.apk`.
Está firmado con la clave de depuración, así que Android pedirá permiso para
instalar "apps de fuentes desconocidas" la primera vez.

---

Hecho con [Claude Code](https://claude.com/claude-code).
