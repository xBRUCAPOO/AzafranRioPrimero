/*
 * api-clientes.js
 * Lógica COMPARTIDA entre index.html (listado) y perfil.html (detalle):
 *   - Llamadas a la API REST en PHP (api/clientes.php).
 *   - "Modo demo": si la API no responde (todavía no hay servidor PHP/MySQL
 *     corriendo), se usan 4 clientes de prueba en memoria/sessionStorage,
 *     para poder probar toda la página sin backend.
 *   - Un historial simple de acciones (alta/edición/baja) guardado en
 *     localStorage, que lee la página historial.html.
 *
 * Este archivo debe cargarse ANTES que app.js o perfil.js en el <script>.
 */

const API_URL = "api/clientes.php"; // Endpoint del backend PHP
const DEMO_KEY = "gestorClientes_demoData"; // sessionStorage: copia de los datos de prueba durante esta sesión del navegador
const HISTORIAL_KEY = "gestorClientes_historial"; // localStorage: registro de movimientos para historial.html

// 2 clientes inventados (1 hombre, 1 mujer) para probar la página
// (agregar, ver, editar, filtrar, eliminar) mientras no hay servidor PHP/MySQL
// disponible. El nombre deja en claro que son datos de prueba, para que
// nunca se confundan con un cliente real. Los ids empiezan en 9001 para
// no chocar nunca con ids reales.
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
    copropietarios: [{ id: 1, nombre: "Copropietario Prueba", dni: "30555666" }],
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
    copropietarios: [],
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
  copropietarios: [{ id: 1, nombre: "Bruno Maximiliano Valarolo", dni: "6767676767" }],
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
// Historial: registra cada alta/edición/baja para mostrarla en historial.html
// ------------------------------------------------------------------
function registrarHistorial(accion, nombreCliente) {
  const historial = JSON.parse(localStorage.getItem(HISTORIAL_KEY) || "[]");
  historial.unshift({ fecha: new Date().toISOString(), accion, nombreCliente });
  // Se guardan como máximo los últimos 200 movimientos, para no llenar el navegador
  localStorage.setItem(HISTORIAL_KEY, JSON.stringify(historial.slice(0, 200)));
}

// ------------------------------------------------------------------
// Comunicación con la API (fetch a clientes.php), con respaldo en modo demo
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
    lista.push({ id: nuevoId, ...datos });
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
    if (idx !== -1) lista[idx] = { ...lista[idx], ...datos, id: lista[idx].id };
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
