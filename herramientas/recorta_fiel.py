"""Recorta el personaje de una imagen ORIGINAL y le quita el fondo, sin redibujar nada.

Usa rembg (U2Net) sobre la foto original, asi el personaje queda EXACTAMENTE
como estaba -sus colores, su decoracion, su pose- solo que sin fondo.

    python herramientas/recorta_fiel.py entrada.png salida.png
    python herramientas/recorta_fiel.py poster.png salida.png --caja 0.33,0.29,0.63,0.87
        (--caja x1,y1,x2,y2 en tanto por uno: para sacar UN personaje de una lamina con varios)
"""

import sys

from PIL import Image

try:
    from rembg import remove, new_session
except ImportError:  # pragma: no cover
    raise SystemExit("Falta rembg: pip install rembg")

_SESION = None


def sesion():
    global _SESION
    if _SESION is None:
        _SESION = new_session("u2net")
    return _SESION


def recorta_fiel(entrada, salida, caja=None, lado=460, pad=6, alpha_min=12):
    im = Image.open(entrada).convert("RGBA")

    if caja:
        w, h = im.size
        x1, y1, x2, y2 = caja
        im = im.crop((int(x1 * w), int(y1 * h), int(x2 * w), int(y2 * h)))

    # quitar fondo respetando el dibujo original
    fuera = remove(im, session=sesion(), post_process_mask=True)

    # limpiar restos semitransparentes del borde
    px = fuera.load()
    w, h = fuera.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < alpha_min:
                px[x, y] = (r, g, b, 0)

    # quedarse solo con la mancha grande (fuera trocitos sueltos del fondo)
    fuera = _mancha_principal(fuera)

    caja_util = fuera.getbbox()
    if caja_util is None:
        raise SystemExit("No ha quedado nada: revisa la caja o la imagen")
    x1, y1, x2, y2 = caja_util
    fuera = fuera.crop(
        (max(0, x1 - pad), max(0, y1 - pad), min(w, x2 + pad), min(h, y2 + pad))
    )

    k = min(lado / fuera.width, lado / fuera.height, 1.0)
    if k < 1.0:
        fuera = fuera.resize(
            (max(1, int(fuera.width * k)), max(1, int(fuera.height * k))), Image.LANCZOS
        )

    fuera.save(salida, "PNG")
    print(f"{salida} {fuera.width}x{fuera.height}")
    return fuera.size


def _mancha_principal(im, minimo=0.02):
    """Deja la region opaca mas grande y borra las islas pequenas."""
    import numpy as np
    import cv2

    a = np.array(im)
    mascara = (a[:, :, 3] > 8).astype("uint8")
    n, etiquetas, stats, _ = cv2.connectedComponentsWithStats(mascara, 8)
    if n <= 2:
        return im
    areas = stats[1:, cv2.CC_STAT_AREA]
    mayor = 1 + int(areas.argmax())
    umbral = areas.max() * minimo
    buenas = {mayor}
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= umbral:
            buenas.add(i)
    quita = ~np.isin(etiquetas, list(buenas))
    a[quita, 3] = 0
    return Image.fromarray(a)


if __name__ == "__main__":
    args = sys.argv[1:]
    if len(args) < 2:
        raise SystemExit(__doc__)
    entrada, salida = args[0], args[1]
    caja = None
    lado = 460
    for i, x in enumerate(args):
        if x == "--caja":
            caja = tuple(float(v) for v in args[i + 1].split(","))
        elif x == "--lado":
            lado = int(args[i + 1])
    recorta_fiel(entrada, salida, caja=caja, lado=lado)
