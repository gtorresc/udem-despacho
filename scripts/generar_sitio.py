"""Prepara la página del proyecto (docs/): graba la demo y copia lo que la página reutiliza del programa.

La demo no es un video: es una simulación real de CentroControl, con un reloj falso, grabada cuadro a cuadro.
La página la reproduce con los mismos mapas del programa (mapa3d.js y mapa2d.js), que se copian a docs/sitio/app.

    python scripts/generar_sitio.py

Volver a correrlo si cambian el programa, el guion de la demo o los mapas (tests/test_sitio.py avisa si las
copias quedaron viejas).
"""
import json
import shutil
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "src"))

from flota.presentacion.centro_control import crear_centro  # noqa: E402
from flota.web.puente import PuenteWeb  # noqa: E402

PAGINA = RAIZ / "src" / "flota" / "web" / "pagina"
RECURSOS = RAIZ / "src" / "flota" / "recursos"
SITIO = RAIZ / "docs" / "sitio"
COPIAS = {  # origen -> destino dentro de docs/sitio: la página usa estos archivos tal cual
    PAGINA / "mapa2d.js": "app/mapa2d.js", PAGINA / "mapa3d.js": "app/mapa3d.js", PAGINA / "clima.js": "app/clima.js",
    PAGINA / "vendor" / "three.module.min.js": "app/vendor/three.module.min.js",
    PAGINA / "vendor" / "OrbitControls.js": "app/vendor/OrbitControls.js",
    PAGINA / "vendor" / "LICENSE-three.txt": "app/vendor/LICENSE-three.txt",
    **{RECURSOS / "retratos" / f"{r}.png": f"retratos/{r}.png" for r in ("R-01", "R-02", "O-01", "D-01")},
    **{RECURSOS / "fuentes" / f: f"fuentes/{f}" for f in
       ("Oswald-SemiBold.ttf", "ShareTechMono-Regular.ttf", "OFL-oswald.txt", "OFL-sharetechmono.txt")},
}
CUADROS_POR_S = 5  # la página interpola entre cuadros

# (segundo de la demo, paso de la leyenda o None, acción sobre el centro)
GUION = [
    (0.5, 1, lambda c: c.despachar_auto(c.crear_solicitud("biblioteca", "derecho", "documento", 1))),
    (6.0, 2, lambda c: c.despachar_auto(c.crear_solicitud("cafeteria", "comunicacion", "alimento", 1.5))),
    (13.0, 3, lambda c: c.configurar_clima(12, 70, True, tormenta=True)),
    (14.0, None, lambda c: c.despachar_auto(c.crear_solicitud("biblioteca", "azotea_b11", "documento", 1))),
    (26.0, 4, lambda c: c.configurar_clima(10, 10, True)),
    (40.0, 5, lambda c: c.despachar_auto(c.crear_solicitud("laboratorios", "azotea_b12", "peligroso", 2))),
    (44.0, 6, lambda c: c.mantener("O-01")),
    (52.0, 7, lambda c: c.despachar(_llamada(c, "cafeteria", "biblioteca", "fragil", 2), "O-01")),  # rechazado
    (57.0, None, lambda c: c.despachar_auto(_ultima[0])),
]
DURACION_S = 80
_ultima = [None]  # la llamada del paso 7: el operador la intenta a mano y luego pulsa AUTO


def _llamada(centro, origen, destino, carga, peso):
    _ultima[0] = centro.crear_solicitud(origen, destino, carga, peso)
    return _ultima[0]


class Reloj:
    def __init__(self):
        self.ahora = 0.0

    def __call__(self):
        return self.ahora


def redondear(valor):
    """Un decimal basta para metros en pantalla y reduce el JSON a la mitad."""
    if isinstance(valor, float):
        return round(valor, 1)
    if isinstance(valor, list):
        return [redondear(v) for v in valor]
    if isinstance(valor, dict):
        return {k: redondear(v) for k, v in valor.items()}
    return valor


def grabar() -> dict:
    reloj = Reloj()
    centro = crear_centro(real=False)
    centro._reloj = reloj  # shortcut: crear_centro no recibe reloj; solo para grabar la demo
    centro._asignador._reloj = reloj
    geometria = redondear(PuenteWeb(centro).geometria())

    recorridos, indice_recorrido = [], {}
    tablas = {"clima": [], "ambiente": []}
    cuadros, pasos, pendientes = [], [], list(GUION)
    vistos = 0
    eventos = []
    radar = None
    for n in range(DURACION_S * CUADROS_POR_S + 1):
        reloj.ahora = n / CUADROS_POR_S
        while pendientes and pendientes[0][0] <= reloj.ahora:
            _, paso, accion = pendientes.pop(0)
            accion(centro)
            if paso:
                pasos.append({"paso": paso, "t": reloj.ahora})
        centro.tick()
        estado = redondear(centro.estado())
        radar = radar or {r["id"]: r["radar"] for r in estado["robots"]}
        robots = []
        for r in estado["robots"]:
            clave = json.dumps(r["recorrido"])
            if clave not in indice_recorrido:
                indice_recorrido[clave] = len(recorridos)
                recorridos.append(r["recorrido"])
            robots.append({k: v for k, v in r.items() if k not in ("recorrido", "radar")}
                          | {"rec": indice_recorrido[clave]})
        cuadro = {"robots": robots, "balizas": estado["balizas"], "resumen": estado["resumen"]}
        for nombre in tablas:
            if not tablas[nombre] or tablas[nombre][-1][1] != estado[nombre]:
                tablas[nombre].append([n, estado[nombre]])
        cuadros.append(cuadro)
        bitacora = centro._bitacora.eventos()
        for e in bitacora[vistos:]:
            eventos.append({"t": reloj.ahora, "tipo": e.tipo.name, "nombre": e.tipo.value,
                            "robot": e.robot_id, "mensaje": e.mensaje})
        vistos = len(bitacora)
    return {"geometria": geometria, "cuadros_por_s": CUADROS_POR_S, "cuadros": cuadros, "recorridos": recorridos,
            "radar": radar, "clima": tablas["clima"], "ambiente": tablas["ambiente"], "pasos": pasos,
            "eventos": eventos}


def main() -> None:
    for origen, destino in COPIAS.items():
        (SITIO / destino).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(origen, SITIO / destino)
    demo = grabar()
    salida = SITIO / "demo.json"
    salida.write_text(json.dumps(demo, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    pasos = ", ".join(f"{p['paso']}@{p['t']:.0f}s" for p in demo["pasos"])
    print(f"{salida.relative_to(RAIZ)}: {salida.stat().st_size / 1024:.0f} KB, {len(demo['cuadros'])} cuadros, "
          f"{len(demo['eventos'])} eventos, pasos {pasos}")


if __name__ == "__main__":
    main()
