"""La página del proyecto (docs/) reutiliza archivos del programa: no deben quedar viejos."""
import importlib.util
import json
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location("generar_sitio", RAIZ / "scripts" / "generar_sitio.py")
generar_sitio = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(generar_sitio)


@pytest.mark.parametrize("origen, destino", generar_sitio.COPIAS.items(), ids=lambda v: getattr(v, "name", v))
def test_las_copias_de_la_pagina_son_iguales_al_programa(origen, destino):
    copia = generar_sitio.SITIO / destino
    assert copia.read_bytes() == origen.read_bytes(), f"{destino} está viejo: corre scripts/generar_sitio.py"


def test_la_demo_grabada_cumple_todo_el_guion():
    demo = json.loads((generar_sitio.SITIO / "demo.json").read_text(encoding="utf-8"))
    assert [p["paso"] for p in demo["pasos"]] == [1, 2, 3, 4, 5, 6, 7]
    tipos = {e["tipo"] for e in demo["eventos"]}
    assert {"ENTREGA_EXITOSA", "RECHAZO_CLIMA", "ENTREGA_FALLIDA", "MANTENIMIENTO", "DESPACHO_RECHAZADO"} <= tipos
