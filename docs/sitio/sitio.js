// Página de UdeM·DESPACHO: animaciones de la página y el reproductor de la demo grabada.
// La demo usa los mismos mapas del programa (app/mapa3d.js y app/mapa2d.js, copiados por scripts/generar_sitio.py).
import { Mapa2D, FRANJA, cargarTema } from "./app/mapa2d.js";

const $ = id => document.getElementById(id);
const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
const ETIQUETA = { libre: "DISPONIBLE", ocupado: "EN RUTA", falla: "MANTENIM." };
const COLOR_EVENTO = { ENTREGA_EXITOSA: "#46f0b4", ENTREGA_FALLIDA: "#d2453b", RECHAZO_CLIMA: "#f08a2c",
                       SOLICITUD_PENDIENTE: "#f08a2c", MANTENIMIENTO: "#6fb6ff", DESPACHO_RECHAZADO: "#d2453b" };

// --- Aparición al hacer scroll ---------------------------------------------------------------------------
const alVer = new IntersectionObserver(entradas => entradas.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.classList.add("visible");
  alVer.unobserve(e.target);
}), { threshold: 0.15 });
document.querySelectorAll("[data-revelar]").forEach(el => alVer.observe(el));

// --- Titular letra por letra -----------------------------------------------------------------------------
const titular = $("titular");
titular.setAttribute("aria-label", titular.textContent);
titular.innerHTML = [...titular.textContent]
  .map((c, i) => `<span class="letra" aria-hidden="true" style="animation-delay:${i * 45}ms">${c}</span>`).join("");

// --- Contadores que suben --------------------------------------------------------------------------------
const contar = new IntersectionObserver(entradas => entradas.forEach(e => {
  if (!e.isIntersecting || reducido) return;
  const fin = Number(e.target.dataset.contar), inicio = performance.now();
  const paso = ahora => {
    const t = Math.min(1, Math.max(0, (ahora - inicio) / 1400));  // el primer cuadro puede llegar antes de `inicio`
    e.target.textContent = Math.round(fin * (1 - (1 - t) ** 3));
    if (t < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
  contar.unobserve(e.target);
}), { threshold: 0.6 });
document.querySelectorAll("[data-contar]").forEach(el => contar.observe(el));

// --- Barra de progreso de lectura y menú del celular ------------------------------------------------------
addEventListener("scroll", () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  $("progreso").style.width = `${(scrollY / max) * 100}%`;
}, { passive: true });
const menu = $("menu"), menuMovil = $("menu-movil");
menu.addEventListener("click", () => {
  const abrir = menuMovil.hidden;
  menuMovil.hidden = !abrir;
  menu.setAttribute("aria-expanded", abrir);
});
menuMovil.addEventListener("click", e => { if (e.target.tagName === "A") { menuMovil.hidden = true; menu.setAttribute("aria-expanded", false); } });

// --- La cinta mostaza da la vuelta sin saltos: el contenido va dos veces -----------------------------------
const pista = document.querySelector(".cinta-pista");
pista.innerHTML += pista.innerHTML.replaceAll("<span>", '<span aria-hidden="true">');

// --- Fichas que se inclinan hacia el cursor ----------------------------------------------------------------
if (!reducido && matchMedia("(hover: hover)").matches) {
  document.querySelectorAll(".inclinable").forEach(ficha => {
    ficha.addEventListener("pointermove", e => {
      const caja = ficha.getBoundingClientRect();
      const dx = (e.clientX - caja.left) / caja.width - 0.5, dy = (e.clientY - caja.top) / caja.height - 0.5;
      ficha.style.transform = `perspective(700px) translateY(calc(var(--y, 0px) - 6px)) rotate(calc(var(--giro, 0deg) * .4)) ` +
                              `rotateX(${-dy * 10}deg) rotateY(${dx * 10}deg)`;
    });
    ficha.addEventListener("pointerleave", () => { ficha.style.transform = ""; });
  });
}

// --- Botones Copiar ------------------------------------------------------------------------------------------
document.querySelectorAll(".copiar").forEach(boton => boton.addEventListener("click", async () => {
  const texto = boton.previousElementSibling.textContent;
  try {
    await navigator.clipboard.writeText(texto);
  } catch {  // sin permiso de portapapeles: se selecciona para copiar a mano
    getSelection().selectAllChildren(boton.previousElementSibling);
  }
  boton.textContent = "¡Copiado!";
  boton.classList.add("listo");
  setTimeout(() => { boton.textContent = "Copiar"; boton.classList.remove("listo"); }, 1600);
}));

// --- Las teclas de la guía se hunden al pulsarlas ------------------------------------------------------------
addEventListener("keydown", e => {
  if (e.target.matches("input, textarea, select") || e.ctrlKey || e.metaKey || e.altKey) return;
  const tecla = e.key === "Escape" ? "Esc" : e.key.toUpperCase();
  document.querySelectorAll(".teclas kbd").forEach(k => {
    if (k.textContent !== tecla) return;
    k.classList.add("pulsada");
    setTimeout(() => k.classList.remove("pulsada"), 180);
  });
});

// --- Sustituir el proveedor de clima: el asignador no se mueve ------------------------------------------------
const PROVEEDORES = [
  { nombre: "ServicioClimaOpenMeteo", detalle: "HTTP · timeout 5 s · caché 5 min", boton: "Cambiar a simulado",
    codigo: "asignador.cambiar_proveedor_clima(ServicioClimaOpenMeteo())" },
  { nombre: "ServicioClimaSimulado", detalle: "deslizadores del panel · sin red", boton: "Cambiar a Open-Meteo",
    codigo: "asignador.cambiar_proveedor_clima(ServicioClimaSimulado(viento_kmh=45))" },
];
let proveedor = 0;
$("boton-intercambio").addEventListener("click", () => {
  const pieza = $("pieza-clima");
  pieza.classList.add("saliendo");
  setTimeout(() => {
    proveedor = 1 - proveedor;
    const p = PROVEEDORES[proveedor];
    $("pieza-nombre").textContent = p.nombre;
    $("pieza-detalle").textContent = p.detalle;
    $("boton-intercambio").firstChild.textContent = p.boton + " ";
    $("boton-intercambio").setAttribute("aria-pressed", proveedor === 1);
    document.querySelector("#intercambio .codigo code").textContent = p.codigo;
    pieza.classList.toggle("simulado", proveedor === 1);
    pieza.classList.remove("saliendo");
  }, reducido ? 0 : 280);
});

// --- La demo: reproduce una simulación real grabada de CentroControl -----------------------------------------
async function iniciarDemo() {
  const datos = await (await fetch("sitio/demo.json")).json();
  const geo = datos.geometria;
  cargarTema(geo.tema);
  const lienzo = $("demo-lienzo"), avisos = { baliza() {}, robot() {}, sobre() {} };
  let mapa;
  try {
    const { Mapa3D } = await import("./app/mapa3d.js");
    mapa = new Mapa3D(lienzo, geo, avisos);
    mapa.controles.enableZoom = false;  // la rueda del mouse sigue bajando por la página
  } catch (error) {  // sin WebGL: el mapa 2D del programa, como en la aplicación
    console.warn("Vista 3D no disponible, se usa el mapa 2D:", error);
    mapa = new Mapa2D(lienzo, geo, avisos);
    $("demo-modo").hidden = true;
  }
  for (const id of Object.keys(datos.radar)) {
    const imagen = new Image();
    imagen.src = `sitio/retratos/${id}.png`;
    mapa.retratos[id] = imagen;
  }

  const fps = datos.cuadros_por_s, ultimo = datos.cuadros.length - 1, total = ultimo / fps;
  const guion = [...document.querySelectorAll("#guion li")];
  const tarjetas = crearPlantilla(Object.keys(datos.radar));
  let seg = 0, velocidad = 1, reproduciendo = false, pausaManual = reducido, antes = null;
  let eventosMostrados = 0, climaMostrado = "", pasoMostrado = 0;

  const enTabla = (tabla, n) => { let v = tabla[0][1]; for (const [i, x] of tabla) { if (i > n) break; v = x; } return v; };

  function estadoEn(s) {
    const f = Math.min(s * fps, ultimo), i = Math.floor(f), k = f - i;
    const a = datos.cuadros[i], b = datos.cuadros[Math.min(i + 1, ultimo)];
    const robots = a.robots.map((r, j) => {
      const s2 = b.robots[j], seguido = s2.id === r.id && s2.rec === r.rec;  // no se interpola un salto de recorrido
      const mezcla = (p, q) => (seguido ? p + (q - p) * k : p);
      return { ...r, x: mezcla(r.x, s2.x), y: mezcla(r.y, s2.y), z: mezcla(r.z, s2.z),
               recorrido: datos.recorridos[r.rec], radar: datos.radar[r.id],
               mision: r.mision && { ...r.mision, progreso: s2.mision && seguido ? mezcla(r.mision.progreso, s2.mision.progreso) : r.mision.progreso } };
    });
    return { robots, balizas: a.balizas, resumen: a.resumen, clima: enTabla(datos.clima, i), ambiente: enTabla(datos.ambiente, i) };
  }

  function pintar() {
    const estado = estadoEn(seg);
    mapa.dibujar(estado);
    const r = estado.resumen, reloj = `${String(Math.floor(seg / 60)).padStart(2, "0")}:${String(Math.floor(seg % 60)).padStart(2, "0")}`;
    $("demo-barra").textContent = `UdeM·DESPACHO   |   ${r.robots} robots   |   ${r.en_ruta} en ruta   |   ` +
                                  `${r.esperando} en espera   |   mantenimiento: ${r.mantenimiento}   |   turno ${reloj}`;
    $("demo-reloj").textContent = reloj;
    $("demo-avance").style.width = `${(seg / total) * 100}%`;
    pintarClima(estado.clima);
    for (const robot of estado.robots) {
      const t = tarjetas[robot.id];
      t.franja.textContent = ETIQUETA[robot.franja];
      t.franja.style.background = FRANJA[robot.franja];
      t.bateria.style.width = `${robot.bateria}%`;
      t.bateria.style.background = robot.bateria > 50 ? FRANJA.libre : robot.bateria > 25 ? "#f08a2c" : FRANJA.falla;
    }
    pintarRadio();
    pintarGuion();
  }

  function pintarClima(c) {
    const texto = c.drones_autorizados ? "DRONES AUTORIZADOS" : `DRONES EN TIERRA: ${c.motivo}`;
    const clave = `${c.viento}|${c.lluvia}|${texto}`;
    if (clave === climaMostrado) return;
    climaMostrado = clave;
    const pildora = $("demo-clima");
    pildora.innerHTML = `viento ${Math.round(c.viento)} km/h | lluvia ${Math.round(c.lluvia)}%<b></b>`;
    pildora.querySelector("b").textContent = texto;
    pildora.querySelector("b").style.color = c.drones_autorizados ? "#46f0b4" : "#f08a2c";
  }

  function pintarRadio() {
    const vistos = datos.eventos.filter(e => e.t <= seg).length;
    if (vistos === eventosMostrados) return;
    const registro = $("demo-registro");
    if (vistos < eventosMostrados) { registro.textContent = ""; eventosMostrados = 0; }  // se volvió atrás
    for (const e of datos.eventos.slice(eventosMostrados, vistos)) {
      const linea = document.createElement("div"), tipo = document.createElement("span");
      tipo.className = "tipo";
      tipo.style.color = COLOR_EVENTO[e.tipo] || "inherit";
      tipo.textContent = `00:${String(Math.floor(e.t)).padStart(2, "0")}${e.robot ? " " + e.robot : ""} ${e.nombre.toUpperCase()}`;
      linea.append(tipo, e.mensaje);
      registro.append(linea);
    }
    registro.scrollTop = registro.scrollHeight;
    eventosMostrados = vistos;
  }

  function pintarGuion() {
    const actual = datos.pasos.filter(p => p.t <= seg).at(-1)?.paso ?? 0;
    if (actual === pasoMostrado) return;
    pasoMostrado = actual;
    guion.forEach(li => {
      const n = Number(li.dataset.paso);
      li.classList.toggle("activo", n === actual);
      li.classList.toggle("hecho", n < actual);
    });
    const aviso = $("demo-aviso"), li = guion[actual - 1];
    if (!li) { aviso.hidden = true; return; }
    aviso.textContent = li.querySelector("h3").textContent.toUpperCase();
    aviso.hidden = false;
    clearTimeout(pintarGuion.temporizador);
    pintarGuion.temporizador = setTimeout(() => { aviso.hidden = true; }, 3500);
  }

  function cuadro(ahora) {
    if (reproduciendo && antes !== null) {
      seg += ((ahora - antes) / 1000) * velocidad;
      if (seg >= total) seg = 0;  // vuelve a empezar el turno
    }
    antes = ahora;
    pintar();
    requestAnimationFrame(cuadro);
  }

  function reproducir(si) {
    reproduciendo = si;
    $("demo-play").textContent = si ? "❚❚" : "▶";
    $("demo-play").setAttribute("aria-label", si ? "Pausar" : "Reproducir");
  }
  const ir = s => { seg = Math.max(0, Math.min(total, s)); };

  $("demo-play").addEventListener("click", () => { pausaManual = reproduciendo; reproducir(!reproduciendo); });
  $("demo-reiniciar").addEventListener("click", () => { ir(0); pausaManual = false; reproducir(true); });
  $("demo-velocidad").addEventListener("click", e => {
    velocidad = velocidad === 1 ? 2 : velocidad === 2 ? 4 : 1;
    e.target.textContent = `×${velocidad}`;
  });
  $("demo-modo").addEventListener("click", () => mapa.alternar?.());
  document.querySelector(".linea-tiempo").addEventListener("click", e => {
    const caja = e.currentTarget.getBoundingClientRect();
    ir(((e.clientX - caja.left) / caja.width) * total);
  });
  guion.forEach(li => {
    li.tabIndex = 0;
    const saltar = () => {
      ir(datos.pasos.find(p => p.paso === Number(li.dataset.paso)).t - 0.2);
      pausaManual = false;
      reproducir(true);
    };
    li.addEventListener("click", saltar);
    li.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); saltar(); } });
  });

  // arranca sola al verse y se pausa al salir (con movimiento reducido, solo si el visitante la inicia)
  new IntersectionObserver(([e]) => { if (!pausaManual) reproducir(e.isIntersecting); }, { threshold: 0.3 }).observe($("consola"));
  reproducir(false);
  if (reducido) ir(datos.pasos[3].t + 2);  // un cuadro con el dron en vuelo
  requestAnimationFrame(cuadro);
}

function crearPlantilla(ids) {
  const plantilla = $("demo-plantilla"), tarjetas = {};
  for (const id of ids) {
    const t = document.createElement("div");
    t.className = "tarjeta";
    t.innerHTML = `<div class="franja"></div><img alt="" src="sitio/retratos/${id}.png"><div class="nombre">${id}</div>` +
                  `<div class="bateria"><div></div></div>`;
    plantilla.append(t);
    tarjetas[id] = { franja: t.querySelector(".franja"), bateria: t.querySelector(".bateria div") };
  }
  return tarjetas;
}

iniciarDemo().catch(error => {
  console.error(error);
  $("demo-clima").textContent = "no se pudo cargar la demo";
});
