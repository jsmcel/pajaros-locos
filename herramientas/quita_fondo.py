"""Deja un personaje sobre fondo transparente.

La imagen de entrada viene de Gemini con fondo BLANCO liso. Se inunda desde
los bordes para quitar solo el blanco de fuera (asi los blancos de dentro del
dibujo -ojos, dientes- se conservan), se quita el halo, se recorta a la caja
del personaje y se deja a un tamano comodo para el juego.

    python herramientas/quita_fondo.py entrada.png salida.png [--umbral 34] [--lado 420]
"""

import sys
from collections import deque

from PIL import Image


def quita_fondo(ruta_entrada, ruta_salida, umbral=34, lado=420, pad=6):
    im = Image.open(ruta_entrada).convert("RGBA")
    w, h = im.size
    px = im.load()

    # si ya viene sin fondo (las cuatro esquinas transparentes) solo hay que recortar
    esquinas = [px[0, 0][3], px[w - 1, 0][3], px[0, h - 1][3], px[w - 1, h - 1][3]]
    if max(esquinas) <= 8:
        return _recorta_y_guarda(im, ruta_salida, lado, pad)

    def es_fondo(x, y):
        r, g, b, a = px[x, y]
        return a > 8 and (255 - r) <= umbral and (255 - g) <= umbral and (255 - b) <= umbral

    # --- inundacion desde los cuatro bordes ---
    visto = bytearray(w * h)
    cola = deque()

    def mete(x, y):
        i = y * w + x
        if not visto[i] and es_fondo(x, y):
            visto[i] = 1
            cola.append((x, y))

    for x in range(w):
        mete(x, 0)
        mete(x, h - 1)
    for y in range(h):
        mete(0, y)
        mete(w - 1, y)

    while cola:
        x, y = cola.popleft()
        if x > 0:
            mete(x - 1, y)
        if x < w - 1:
            mete(x + 1, y)
        if y > 0:
            mete(x, y - 1)
        if y < h - 1:
            mete(x, y + 1)

    for y in range(h):
        fila = y * w
        for x in range(w):
            if visto[fila + x]:
                r, g, b, _ = px[x, y]
                px[x, y] = (r, g, b, 0)

    # --- halo: pixeles casi blancos pegados al borde recortado ---
    for _ in range(2):
        borrar = []
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                if (255 - r) > umbral + 26 or (255 - g) > umbral + 26 or (255 - b) > umbral + 26:
                    continue
                vecino_vacio = (
                    (x > 0 and px[x - 1, y][3] == 0)
                    or (x < w - 1 and px[x + 1, y][3] == 0)
                    or (y > 0 and px[x, y - 1][3] == 0)
                    or (y < h - 1 and px[x, y + 1][3] == 0)
                )
                if vecino_vacio:
                    borrar.append((x, y))
        if not borrar:
            break
        for x, y in borrar:
            r, g, b, _ = px[x, y]
            px[x, y] = (r, g, b, 0)

    return _recorta_y_guarda(im, ruta_salida, lado, pad)


def _recorta_y_guarda(im, ruta_salida, lado, pad):
    """Recorta a la caja de lo que se ve y lo deja a un tamano comodo."""
    w, h = im.size
    caja = im.getbbox()
    if caja is None:
        raise SystemExit("La imagen se ha quedado vacia: sube el umbral o revisa el fondo")
    x1, y1, x2, y2 = caja
    x1 = max(0, x1 - pad)
    y1 = max(0, y1 - pad)
    x2 = min(w, x2 + pad)
    y2 = min(h, y2 + pad)
    im = im.crop((x1, y1, x2, y2))

    k = min(lado / im.width, lado / im.height, 1.0)
    if k < 1.0:
        im = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)

    im.save(ruta_salida, "PNG")
    opacos = sum(1 for p in im.getdata() if p[3] > 16)
    print(f"{ruta_salida} {im.width}x{im.height} opacos={opacos}")
    return im.size


if __name__ == "__main__":
    args = sys.argv[1:]
    if len(args) < 2:
        raise SystemExit(__doc__)
    entrada, salida = args[0], args[1]
    umbral, lado = 34, 420
    for i, a in enumerate(args):
        if a == "--umbral":
            umbral = int(args[i + 1])
        elif a == "--lado":
            lado = int(args[i + 1])
    quita_fondo(entrada, salida, umbral=umbral, lado=lado)
