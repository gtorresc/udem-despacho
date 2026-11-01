"""Retratos de RoboHash para la plantilla, sin internet (requests se reemplaza)."""
import pytest
import requests

from flota.presentacion import retratos


def test_retrato_guardado_se_usa_sin_red(tmp_path, monkeypatch):
    retratos.icono("Dron").save(tmp_path / "X-01.png")
    monkeypatch.setattr(retratos.requests, "get", lambda *a, **k: pytest.fail("no debía bajarlo"))
    assert retratos.retrato("X-01", "Dron", tmp_path).size == (200, 200)


@pytest.mark.parametrize("id_raro", ["../../fuera", "R-01/../x", "", "a b"])
def test_un_id_que_no_es_de_robot_no_toca_disco_ni_red(tmp_path, monkeypatch, id_raro):
    monkeypatch.setattr(retratos.requests, "get", lambda *a, **k: pytest.fail("no debía pedirlo"))
    carpeta = tmp_path / "a" / "b" / "retratos"  # un "../.." mal manejado escribiría dentro de tmp_path
    assert retratos.retrato(id_raro, "Dron", carpeta).size == (200, 200)
    assert not any(tmp_path.rglob("*.png"))


def test_sin_red_se_dibuja_un_icono_y_no_se_guarda(tmp_path, monkeypatch):
    def sin_red(*args, **kwargs):
        raise requests.ConnectionError("sin internet")
    monkeypatch.setattr(retratos.requests, "get", sin_red)
    assert retratos.retrato("X-02", "Orugas", tmp_path).size == (200, 200)
    assert not (tmp_path / "X-02.png").exists()  # se reintenta la próxima vez
