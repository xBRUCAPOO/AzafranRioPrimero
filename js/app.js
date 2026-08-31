/*
 * app.js
 * Lógica de la página principal "Gestor de Clientes" (listado).
 * Las llamadas a la API, el modo demo (datos de prueba) y el registro de
 * historial viven en api-clientes.js, que se carga ANTES que este archivo.
 *
 * CAMBIO: al hacer clic en un cliente ya no se abre un modal de solo
 * lectura; ahora se navega de página completa a perfil.html?id=... con el
 * detalle de ese cliente (ahí también vive el botón "Editar").
 */

const THEME_KEY = "gestorClientes_tema"; // Esto sí queda local: es solo una preferencia visual del navegador
const MAX_COOWNERS = 3; // Un cliente puede tener hasta 3 copropietarios

// ------------------------------------------------------------------
// Estado en memoria (copia local de lo que hay en la base de datos)
// ------------------------------------------------------------------
let clientes = [];
let coownerRowCount = 0;

// ------------------------------------------------------------------
// Referencias al DOM
// ------------------------------------------------------------------
const clientListEl = document.getElementById("clientList");
const emptyStateEl = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const filterSexo = document.getElementById("filterSexo");
const filterEstadoCivil = document.getElementById("filterEstadoCivil");
const filterToggle = document.getElementById("filterToggle");
const filterPanel = document.getElementById("filterPanel");
const filterClear = document.getElementById("filterClear");
const settingsToggle = document.getElementById("settingsToggle");
const settingsPanel = document.getElementById("settingsPanel");
const themeCheckbox = document.getElementById("themeCheckbox");
const addClientBtn = document.getElementById("addClientBtn");
const historyBtn = document.getElementById("historyBtn");

const clientModal = document.getElementById("clientModal");
const clientForm = document.getElementById("clientForm");
const coownersListEl = document.getElementById("coownersList");
const addCoownerBtn = document.getElementById("addCoownerBtn");
const toastEl = document.getElementById("toast");

// Botón "Historial" (donde antes estaba el título): lleva a historial.html
historyBtn.addEventListener("click", () => {
  window.location.href = "historial.html";
});

// Vuelve a traer la lista completa desde MySQL y refresca la pantalla.
// Si la API no responde (por ejemplo, todavía no hay servidor PHP corriendo),
// se activa el MODO DEMO (definido en api-clientes.js) con 4 clientes de prueba.
async function recargarClientes() {
  try {
    clientes = await apiListar();
    modoDemo = false;
    refreshEstadoCivilOptions();
    renderLista();
  } catch (err) {
    if (!modoDemo) {
      modoDemo = true;
      mostrarToast("Sin conexión al servidor: mostrando datos de prueba.", "info");
    }
    // Se lee siempre de sessionStorage para no pisar cambios ya hechos
    // en esta sesión (por ejemplo, desde perfil.html)
    const guardados = leerDemoDeSession();
    clientes = guardados || JSON.parse(JSON.stringify(MOCK_CLIENTES));
    if (!guardados) guardarDemoEnSession(clientes);
    refreshEstadoCivilOptions();
    renderLista();
    console.error(err);
  }
}

// ------------------------------------------------------------------
// Tema claro / oscuro (esta preferencia sí vive en el navegador)
// ------------------------------------------------------------------
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeCheckbox.checked = theme === "light"; // checked = derecha = claro/sol
  localStorage.setItem(THEME_KEY, theme);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  applyTheme(saved || (prefersLight ? "light" : "dark"));
}

themeCheckbox.addEventListener("change", () => {
  applyTheme(themeCheckbox.checked ? "light" : "dark");
});

// ------------------------------------------------------------------
// Paneles flotantes (filtro / ajustes): abrir, cerrar y click afuera
// ------------------------------------------------------------------
function togglePanel(panel, button) {
  const willOpen = panel.classList.contains("hidden");
  [filterPanel, settingsPanel].forEach((p) => p.classList.add("hidden"));
  panel.classList.toggle("hidden", !willOpen);
  button.setAttribute("aria-expanded", String(willOpen));
}

filterToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  togglePanel(filterPanel, filterToggle);
});

settingsToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  togglePanel(settingsPanel, settingsToggle);
});

document.addEventListener("click", (e) => {
  if (!filterPanel.contains(e.target) && e.target !== filterToggle) filterPanel.classList.add("hidden");
  if (!settingsPanel.contains(e.target) && e.target !== settingsToggle) settingsPanel.classList.add("hidden");
});

// ------------------------------------------------------------------
// Filtro de Estado Civil dinámico (según lo cargado en los clientes)
// ------------------------------------------------------------------
function refreshEstadoCivilOptions() {
  const valoresUnicos = [...new Set(clientes.map((c) => c.estado_civil).filter(Boolean))];
  const seleccionActual = filterEstadoCivil.value;
  filterEstadoCivil.innerHTML = '<option value="todos">Todos</option>';
  valoresUnicos.forEach((valor) => {
    const opt = document.createElement("option");
    opt.value = valor;
    opt.textContent = valor;
    filterEstadoCivil.appendChild(opt);
  });
  filterEstadoCivil.value = valoresUnicos.includes(seleccionActual) ? seleccionActual : "todos";
}

// ------------------------------------------------------------------
// Búsqueda + filtro (se aplican sobre la copia ya traída de MySQL)
// ------------------------------------------------------------------
function getClientesFiltrados() {
  const texto = searchInput.value.trim().toLowerCase();
  const sexo = filterSexo.value;
  const estadoCivil = filterEstadoCivil.value;

  return clientes.filter((c) => {
    const coincideTexto =
      !texto ||
      c.nombre.toLowerCase().includes(texto) ||
      (c.dni || "").toLowerCase().includes(texto) ||
      (c.mail || "").toLowerCase().includes(texto);
    const coincideSexo = sexo === "todos" || c.sexo === sexo;
    const coincideEstado = estadoCivil === "todos" || c.estado_civil === estadoCivil;
    return coincideTexto && coincideSexo && coincideEstado;
  });
}

// ------------------------------------------------------------------
// Render de la lista de clientes
// ------------------------------------------------------------------
function renderLista() {
  const lista = getClientesFiltrados().sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  clientListEl.innerHTML = "";

  emptyStateEl.classList.toggle("hidden", lista.length > 0);

  lista.forEach((cliente, i) => {
    const li = document.createElement("li");
    li.className = "client-card";
    li.style.animationDelay = `${Math.min(i, 12) * 25}ms`;
    li.dataset.id = cliente.id;

    // Icono según sexo: "face" = hombre, "face_3" = mujer (Material Symbols)
    const icono = cliente.sexo === "F" ? "face_3" : "face";

    li.innerHTML = `
      <span class="client-card__sex-icon">
        <span class="material-symbols-outlined">${icono}</span>
      </span>
      <span class="client-card__name">${escapeHtml(cliente.nombre)}</span>
      <span class="client-card__meta">${escapeHtml(cliente.telefono || "")}</span>
    `;

    // Al hacer clic se navega de página completa al perfil del cliente
    li.addEventListener("click", () => {
      window.location.href = `perfil.html?id=${cliente.id}`;
    });
    clientListEl.appendChild(li);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

searchInput.addEventListener("input", renderLista);
filterSexo.addEventListener("change", renderLista);
filterEstadoCivil.addEventListener("change", renderLista);
filterClear.addEventListener("click", () => {
  filterSexo.value = "todos";
  filterEstadoCivil.value = "todos";
  renderLista();
});

// ------------------------------------------------------------------
// Copropietarios dentro del formulario de "Nuevo cliente" (máximo 3)
// ------------------------------------------------------------------
function crearFilaCoowner() {
  coownerRowCount++;
  const row = document.createElement("div");
  row.className = "coowner-row";
  row.dataset.rowId = coownerRowCount;
  row.innerHTML = `
    <label class="field">
      <span>Nombre y Apellido</span>
      <input type="text" class="coowner-nombre" maxlength="150" />
    </label>
    <label class="field">
      <span>DNI</span>
      <input type="text" class="coowner-dni" inputmode="numeric" maxlength="8" />
    </label>
    <button type="button" class="coowner-row__remove" aria-label="Quitar copropietario">
      <span class="material-symbols-outlined">close</span>
    </button>
  `;
  row.querySelector(".coowner-row__remove").addEventListener("click", () => {
    row.remove();
    actualizarBotonAgregarCoowner();
  });
  coownersListEl.appendChild(row);
  actualizarBotonAgregarCoowner();
}

function actualizarBotonAgregarCoowner() {
  const cantidad = coownersListEl.querySelectorAll(".coowner-row").length;
  addCoownerBtn.classList.toggle("hidden", cantidad >= MAX_COOWNERS);
}

addCoownerBtn.addEventListener("click", () => crearFilaCoowner());

function leerCoownersDelFormulario() {
  return [...coownersListEl.querySelectorAll(".coowner-row")]
    .map((row) => ({
      nombre: row.querySelector(".coowner-nombre").value.trim(),
      dni: row.querySelector(".coowner-dni").value.trim(),
    }))
    .filter((c) => c.nombre || c.dni); // se descartan filas vacías
}

// ------------------------------------------------------------------
// Modal de "Nuevo cliente" (la edición ahora vive en perfil.html)
// ------------------------------------------------------------------
function abrirModalNuevo() {
  clientForm.reset();
  coownersListEl.innerHTML = "";
  actualizarBotonAgregarCoowner();
  clientModal.classList.remove("hidden");
}

function cerrarModal() {
  clientModal.classList.add("hidden");
}

addClientBtn.addEventListener("click", abrirModalNuevo);
clientModal.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", cerrarModal));

clientForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const coownersForm = leerCoownersDelFormulario();
  if (coownersForm.length > MAX_COOWNERS) {
    mostrarToast(`Un cliente puede tener como máximo ${MAX_COOWNERS} copropietarios.`, "error");
    return;
  }

  const datosCliente = {
    nombre: document.getElementById("f_nombre").value.trim(),
    sexo: document.getElementById("f_sexo").value,
    dni: document.getElementById("f_dni").value.trim(),
    cuil: document.getElementById("f_cuil").value.trim(),
    fechaNacimiento: document.getElementById("f_fechaNacimiento").value,
    telefono: document.getElementById("f_telefono").value.trim(),
    mail: document.getElementById("f_mail").value.trim(),
    fechaAlta: document.getElementById("f_fechaAlta").value,
    estadoCivil: document.getElementById("f_estadoCivil").value,
    profesion: document.getElementById("f_profesion").value.trim(),
    direccion: document.getElementById("f_direccion").value.trim(),
    referente: document.getElementById("f_referente").value.trim(),
    copropietarios: coownersForm,
  };

  try {
    const respuesta = await apiCrear(datosCliente);
    if (respuesta.error) {
      mostrarToast(respuesta.error, "error");
      return;
    }
    mostrarToast("Cliente agregado correctamente.", "success");
    await recargarClientes();
    cerrarModal();
  } catch (err) {
    mostrarToast("Error al guardar en la base de datos.", "error");
    console.error(err);
  }
});

// ------------------------------------------------------------------
// Toast de confirmación
// ------------------------------------------------------------------
let toastTimeout;
function mostrarToast(mensaje, tipo = "info") {
  clearTimeout(toastTimeout);
  toastEl.textContent = mensaje;
  toastEl.style.borderLeft = `4px solid var(--color-${tipo})`;
  toastEl.classList.remove("hidden");
  toastTimeout = setTimeout(() => toastEl.classList.add("hidden"), 2600);
}

// ------------------------------------------------------------------
// Inicialización: primero el tema (instantáneo), después se pide
// la lista de clientes a la base de datos vía la API.
// ------------------------------------------------------------------
initTheme();
recargarClientes();