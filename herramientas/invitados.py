"""Convierte las imagenes de `imagenes/` en pajaros jugables.

Coge el personaje ORIGINAL tal cual (nada de redibujarlo), le quita el fondo
con rembg, lo recorta y lo apunta en `pajaros/pajaros.json`, que el juego lee
al arrancar. O sea: los pajaros se meten solos.

    python herramientas/invitados.py            # todos
    python herramientas/invitados.py tomas      # solo uno
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from recorta_fiel import recorta_fiel  # noqa: E402

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# caja = (x1,y1,x2,y2) en tanto por uno, para sacar un personaje de una lamina con varios
# voltea = el dibujo mira a la izquierda y en el juego se vuela hacia la derecha
INVITADOS = [
    dict(id="tomas", nombre="Tomás", origen="imagenes/2e764147-039a-410d-9c11-e2165bb56a46.png",
         poder="tren", r=31, dens=0.0062, pot=1.40, voltea=True),
    dict(id="rayoveloz", nombre="Rayo Veloz", origen="imagenes/77a6012e-7d29-4644-ba35-d2a9a5e30d0f.png",
         poder="turbo", r=30, dens=0.0058, pot=1.35, voltea=True),
    dict(id="lemi", nombre="Lemi", origen="imagenes/b2da60d4-97fb-40ca-9334-0e6acc032bc1.png",
         caja=(0.34, 0.28, 0.64, 0.88), poder="tropa", r=31, dens=0.0060, pot=1.20, voltea=False),
    dict(id="grizzy", nombre="Grizzy", origen="imagenes/b2da60d4-97fb-40ca-9334-0e6acc032bc1.png",
         caja=(0.70, 0.42, 0.94, 0.90), poder="zarpazo", r=34, dens=0.0072, pot=1.60, voltea=True),
    dict(id="camion", nombre="Race Ace", origen="imagenes/53004e2e-0c62-447f-bd5a-ac64115b2cea.jpg",
         poder="ruedas", r=38, dens=0.0085, pot=2.00, voltea=True),
    dict(id="cerdicoche", nombre="Cerdi-Coche", origen="imagenes/2d2d3444-f818-48f1-8f9a-73e9a64aac82.png",
         poder="ruedas", r=40, dens=0.0080, pot=1.80, voltea=False, cerdo=True),
]

MANIFIESTO = os.path.join(RAIZ, "pajaros", "pajaros.json")


def manifiesto():
    try:
        with open(MANIFIESTO, encoding="utf-8") as f:
            j = json.load(f)
        if not isinstance(j.get("pajaros"), list):
            j["pajaros"] = []
        return j
    except Exception:
        return {"version": 1, "pajaros": []}


def apunta(inv, tam):
    j = manifiesto()
    fila = {
        "id": inv["id"],
        "nombre": inv["nombre"],
        "serie": inv.get("serie", "Invitados"),
        "archivo": f"{inv['id']}.png",
        "poder": inv["poder"],
        "r": inv.get("r", 30),
        "dens": inv.get("dens", 0.005),
        "pot": inv.get("pot", 1),
        "cerdo": bool(inv.get("cerdo")),
        "voltea": bool(inv.get("voltea")),
        "ancho": tam[0],
        "alto": tam[1],
    }
    for i, p in enumerate(j["pajaros"]):
        if p.get("id") == fila["id"]:
            j["pajaros"][i] = fila
            break
    else:
        j["pajaros"].append(fila)
    os.makedirs(os.path.dirname(MANIFIESTO), exist_ok=True)
    with open(MANIFIESTO, "w", encoding="utf-8") as f:
        json.dump(j, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return fila


def main():
    quiero = set(a for a in sys.argv[1:] if not a.startswith("-"))
    os.makedirs(os.path.join(RAIZ, "pajaros"), exist_ok=True)
    for inv in INVITADOS:
        if quiero and inv["id"] not in quiero:
            continue
        entrada = os.path.join(RAIZ, inv["origen"])
        salida = os.path.join(RAIZ, "pajaros", f"{inv['id']}.png")
        if not os.path.exists(entrada):
            print(f"[falta] {inv['id']}: no encuentro {inv['origen']}")
            continue
        tam = recorta_fiel(entrada, salida, caja=inv.get("caja"), lado=460)
        fila = apunta(inv, tam)
        print(f"[ok] {fila['nombre']} -> pajaros/{fila['archivo']} ({tam[0]}x{tam[1]}) poder={fila['poder']}")
    print("[fin] pajaros/pajaros.json actualizado")


if __name__ == "__main__":
    main()
