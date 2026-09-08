/*
 * api-clientes.js
 * Lógica COMPARTIDA entre index.html (listado) y perfil.html (detalle):
 *   - Llamadas a la API REST (ahora un Cloudflare Worker sobre D1, ver
 *     worker/src/index.js; antes era api/clientes.php sobre MySQL).
 *   - "Modo demo": si la API no responde, se usan clientes de prueba en
 *     memoria/sessionStorage, para poder probar toda la página sin backend.
 *   - Un historial simple de acciones (alta/edición/baja) guardado en
 *     localStorage, que lee la página historial.html.
 *
 * Este archivo debe cargarse ANTES que app.js o perfil.js, y DESPUÉS de
 * config.js (que define la constante API_BASE con la URL del Worker).
 */

const API_URL = `${API_BASE}/api/clientes`; // Endpoint del Worker
const BULBOS_URL = `${API_BASE}/api/bulbos`; // Endpoint del Worker (ciclos de Bulbos)
const DEMO_KEY = "gestorClientes_demoData"; // sessionStorage: copia de los datos de prueba durante esta sesión del navegador
const HISTORIAL_KEY = "gestorClientes_historial"; // localStorage: registro de movimientos para historial.html

// 3 clientes inventados para probar la página (agregar, ver, editar,
// filtrar, eliminar) mientras no hay Worker/D1 disponible. El nombre deja
// en claro que son datos de prueba. Los ids empiezan en 9001 para no
// chocar nunca con ids reales.
const MOCK_CLIENTES = [
  {
    id: 9001,
    nombre: "Hombre Prueba",
    sexo: "M",
    dni: "30111222",
    cuil: "20301112223",
    fecha_nacimiento: "1985-04-12",
    telefono: "3511234567",
    mail: "hombre.prueba@example.com",
    fecha_alta: "2026-01-15",
    estado_civil: "Casado/a",
    profesion: "Ingeniero Civil",
    direccion: "Av. Colón 1234, Córdoba",
    referente: "Estudio Jurídico Pérez",
    sucursal_nombre: "Rio Primero",
    copropietarios: [{ id: 1, nombre: "Copropietario Prueba", dni: "30555666" }],
    bulbos: [],
  },
  {
    id: 9002,
    nombre: "Mujer Prueba",
    sexo: "F",
    dni: "32444555",
    cuil: "27324445551",
    fecha_nacimiento: "1990-09-03",
    telefono: "3517654321",
    mail: "mujer.prueba@example.com",
    fecha_alta: "2026-02-20",
    estado_civil: "Soltero/a",
    profesion: "Diseñadora Gráfica",
    direccion: "Calle San Martín 567, Córdoba",
    referente: "Inmobiliaria Del Sur",
    sucursal_nombre: "Rio Primero",
    copropietarios: [],
    bulbos: [],
  },
  {
    id: 9003,
    nombre: "Malany Anahi Almada ",
    sexo: "F",
    dni: "32444555",
    cuil: "27324445551",
    fecha_nacimiento: "2009-02-18",
    telefono: "No se pero la amo",
    mail: "MelyElAmorDeMiVida@gmail.com",
    fecha_alta: "2026-02-20",
    estado_civil: "Casado/a",
    profesion: "Marketing",
    direccion: "Calle San Martín 567, Córdoba",
    referente: "A",
    sucursal_nombre: "Rio Primero",
    copropietarios: [{ id: 1, nombre: "Bruno Maximiliano Valarolo", dni: "6767676767" }],
    bulbos: [],
  },
];

// ------------------------------------------------------------------
// Ícono de Material Symbols según el estado civil, COMPARTIDO por
// app.js (filtro de estado civil), perfil.js (dato del cliente) y
// exportar.js. Si el valor no está en el mapa (o está vacío) se usa un
// ícono neutro ("help"), y ese campo además queda marcado como vacío
// para pintarse en gris oscuro (ver .view-item--empty en el CSS).
// ------------------------------------------------------------------
const ICONOS_ESTADO_CIVIL = {
  "Soltero/a": "person",
  "Casado/a": "favorite",
  "Divorciado/a": "heart_broken",
  "Viudo/a": "local_florist",
  "Unión convivencial": "family_restroom",
};
function iconoEstadoCivil(valor) {
  return ICONOS_ESTADO_CIVIL[valor] || "help";
}

let modoDemo = false; // true cuando no se pudo conectar con la API

// ------------------------------------------------------------------
// Toast de confirmación, COMPARTIDO por index.html y perfil.html.
// Muestra un ícono a la derecha según el tipo de alerta:
//   success -> tilde verde | error -> cruz roja | info/warning -> "i"/"!"
// ------------------------------------------------------------------
const toastEl = document.getElementById("toast");
const ICONOS_TOAST = {
  success: "check_circle",
  error: "cancel",
  info: "info",
  warning: "warning",
};
let toastTimeout;
function mostrarToast(mensaje, tipo = "info") {
  clearTimeout(toastTimeout);
  const icono = ICONOS_TOAST[tipo] || ICONOS_TOAST.info;
  const color = `var(--color-${tipo})`;
  toastEl.innerHTML = `
    <span class="toast__text">${mensaje}</span>
    <span class="material-symbols-outlined toast__icon" style="color: ${color}">${icono}</span>
  `;
  toastEl.style.borderLeftColor = color;
  toastEl.classList.remove("hidden");
  toastTimeout = setTimeout(() => toastEl.classList.add("hidden"), 2600);
}

// ------------------------------------------------------------------
// Modo demo: guarda/lee la copia de trabajo en sessionStorage para que
// index.html y perfil.html vean los mismos cambios durante una sesión
// ------------------------------------------------------------------
function guardarDemoEnSession(listaClientes) {
  sessionStorage.setItem(DEMO_KEY, JSON.stringify(listaClientes));
}

function leerDemoDeSession() {
  const raw = sessionStorage.getItem(DEMO_KEY);
  return raw ? JSON.parse(raw) : null;
}

// ------------------------------------------------------------------
// FIX DE BUG (reportado): "al crear y modificar, las fechas y el estado
// civil no se guardan". La causa era que en MODO DEMO se guardaba el
// objeto del formulario tal cual llegaba (con claves en camelCase:
// fechaNacimiento, fechaAlta, estadoCivil, sucursalNombre), pero el
// resto de la app (perfil.js, app.js, exportar.js) siempre lee esos
// mismos datos en snake_case (fecha_nacimiento, fecha_alta, estado_civil,
// sucursal_nombre). El dato SÍ se guardaba, pero bajo una clave que
// ningún otro archivo leía, así que en pantalla aparecía vacío.
//
// Esta función hace la misma conversión camelCase -> snake_case que ya
// hacía el backend real (antes clientes.php, ahora el Worker), para que
// el modo demo se comporte exactamente igual que con conexión real.
// ------------------------------------------------------------------
function mapearDatosClienteParaGuardar(datos) {
  return {
    nombre: datos.nombre || "",
    sexo: datos.sexo || "M",
    dni: datos.dni || "",
    cuil: datos.cuil || "",
    fecha_nacimiento: datos.fechaNacimiento || null,
    telefono: datos.telefono || "",
    mail: datos.mail || "",
    fecha_alta: datos.fechaAlta || null,
    estado_civil: datos.estadoCivil || "",
    profesion: datos.profesion || "",
    direccion: datos.direccion || "",
    referente: datos.referente || "",
    sucursal_nombre: datos.sucursalNombre || "Rio Primero",
    copropietarios: (datos.copropietarios || []).map((co) => ({ nombre: co.nombre || "", dni: co.dni || "" })),
  };
}

// ------------------------------------------------------------------
// Historial: registra cada alta/edición/baja para mostrarla en historial.html
// ------------------------------------------------------------------
function registrarHistorial(accion, nombreCliente) {
  const historial = JSON.parse(localStorage.getItem(HISTORIAL_KEY) || "[]");
  historial.unshift({ fecha: new Date().toISOString(), accion, nombreCliente });
  // Se guardan como máximo los últimos 200 movimientos, para no llenar el navegador
  localStorage.setItem(HISTORIAL_KEY, JSON.stringify(historial.slice(0, 200)));
}

// ------------------------------------------------------------------
// Comunicación con la API (fetch al Worker), con respaldo en modo demo
// ------------------------------------------------------------------
async function apiListar() {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error("No se pudo obtener la lista de clientes");
  return res.json();
}

async function apiObtenerUno(id) {
  if (modoDemo) {
    const lista = leerDemoDeSession() || MOCK_CLIENTES;
    const encontrado = lista.find((c) => String(c.id) === String(id));
    if (!encontrado) throw new Error("Cliente de prueba no encontrado");
    return encontrado;
  }
  try {
    const res = await fetch(`${API_URL}?id=${id}`);
    if (!res.ok) throw new Error("No se pudo obtener el cliente");
    return await res.json();
  } catch (err) {
    // Si veníamos de index.html en modo demo, esto permite que perfil.html
    // también encuentre al cliente de prueba aunque no haya servidor
    const lista = leerDemoDeSession() || MOCK_CLIENTES;
    const encontrado = lista.find((c) => String(c.id) === String(id));
    if (encontrado) {
      modoDemo = true;
      return encontrado;
    }
    throw err;
  }
}

async function apiCrear(datos) {
  if (modoDemo) {
    const lista = leerDemoDeSession() || JSON.parse(JSON.stringify(MOCK_CLIENTES));
    const nuevoId = Math.max(0, ...lista.map((c) => c.id)) + 1;
    // FIX: se convierte camelCase -> snake_case antes de guardar (ver
    // mapearDatosClienteParaGuardar más arriba)
    lista.push({ id: nuevoId, bulbos: [], ...mapearDatosClienteParaGuardar(datos) });
    guardarDemoEnSession(lista);
    registrarHistorial("alta", datos.nombre);
    return { ok: true, id: nuevoId };
  }
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  const data = await res.json();
  if (!data.error) registrarHistorial("alta", datos.nombre);
  return data;
}

async function apiActualizar(id, datos) {
  if (modoDemo) {
    const lista = leerDemoDeSession() || JSON.parse(JSON.stringify(MOCK_CLIENTES));
    const idx = lista.findIndex((c) => String(c.id) === String(id));
    // FIX: misma conversión camelCase -> snake_case que en apiCrear
    if (idx !== -1) lista[idx] = { ...lista[idx], ...mapearDatosClienteParaGuardar(datos), id: lista[idx].id };
    guardarDemoEnSession(lista);
    registrarHistorial("edicion", datos.nombre);
    return { ok: true, id };
  }
  const res = await fetch(`${API_URL}?id=${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  const data = await res.json();
  if (!data.error) registrarHistorial("edicion", datos.nombre);
  return data;
}

async function apiEliminar(id, nombreCliente = "") {
  if (modoDemo) {
    const lista = (leerDemoDeSession() || JSON.parse(JSON.stringify(MOCK_CLIENTES))).filter(
      (c) => String(c.id) !== String(id)
    );
    guardarDemoEnSession(lista);
    registrarHistorial("baja", nombreCliente);
    return { ok: true };
  }
  const res = await fetch(`${API_URL}?id=${id}`, { method: "DELETE" });
  const data = await res.json();
  registrarHistorial("baja", nombreCliente);
  return data;
}

// ------------------------------------------------------------------
// Bulbos (NUEVO): ciclos/temporadas de bulbos de un cliente. Solo se usan
// desde perfil.html (ver js/bulbos.js). En modo demo, se guardan dentro
// del mismo cliente en sessionStorage (cliente.bulbos).
// ------------------------------------------------------------------
async function apiListarBulbos(idCliente) {
  if (modoDemo) {
    const lista = leerDemoDeSession() || MOCK_CLIENTES;
    const cliente = lista.find((c) => String(c.id) === String(idCliente));
    return (cliente && cliente.bulbos) || [];
  }
  const res = await fetch(`${BULBOS_URL}?clienteId=${idCliente}`);
  if (!res.ok) throw new Error("No se pudieron obtener los ciclos de Bulbos");
  return res.json();
}

// Recalcula el total igual que lo haría la base de datos (columna
// generada), para que el modo demo se vea idéntico al modo real.
function calcularTotalBulbo(d) {
  return (
    Number(d.calibre1 || 0) +
    Number(d.calibre2 || 0) +
    Number(d.calibre3 || 0) +
    Number(d.calibre4 || 0) +
    Number(d.cornos || 0)
  );
}

async function apiCrearBulbo(datos) {
  if (modoDemo) {
    const lista = leerDemoDeSession() || JSON.parse(JSON.stringify(MOCK_CLIENTES));
    const cliente = lista.find((c) => String(c.id) === String(datos.idCliente));
    if (!cliente) throw new Error("Cliente de prueba no encontrado");
    if (!cliente.bulbos) cliente.bulbos = [];
    const nuevoId = Math.max(0, ...cliente.bulbos.map((b) => b.id)) + 1;
    cliente.bulbos.unshift({ id: nuevoId, ...datos, total: calcularTotalBulbo(datos) });
    guardarDemoEnSession(lista);
    return { ok: true, id: nuevoId };
  }
  const res = await fetch(BULBOS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  return res.json();
}

async function apiActualizarBulbo(id, idCliente, datos) {
  if (modoDemo) {
    const lista = leerDemoDeSession() || JSON.parse(JSON.stringify(MOCK_CLIENTES));
    const cliente = lista.find((c) => String(c.id) === String(idCliente));
    if (cliente && cliente.bulbos) {
      const idx = cliente.bulbos.findIndex((b) => String(b.id) === String(id));
      if (idx !== -1) cliente.bulbos[idx] = { ...cliente.bulbos[idx], ...datos, id, total: calcularTotalBulbo(datos) };
    }
    guardarDemoEnSession(lista);
    return { ok: true };
  }
  const res = await fetch(`${BULBOS_URL}?id=${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  return res.json();
}

async function apiEliminarBulbo(id, idCliente) {
  if (modoDemo) {
    const lista = leerDemoDeSession() || JSON.parse(JSON.stringify(MOCK_CLIENTES));
    const cliente = lista.find((c) => String(c.id) === String(idCliente));
    if (cliente && cliente.bulbos) cliente.bulbos = cliente.bulbos.filter((b) => String(b.id) !== String(id));
    guardarDemoEnSession(lista);
    return { ok: true };
  }
  const res = await fetch(`${BULBOS_URL}?id=${id}`, { method: "DELETE" });
  return res.json();
}
