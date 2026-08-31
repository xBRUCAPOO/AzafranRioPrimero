/*
 * app.js
 * Lógica de la página principal "Gestor de Clientes" (listado).
 *
 * La tuerca de ajustes (tema claro/oscuro) vive en theme-switch.js, y las
 * llamadas a la API + el modo demo + el toast + el historial viven en
 * api-clientes.js. Ambos se cargan ANTES que este archivo.
 */

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
const searchClear = document.getElementById("searchClear");
const filterNotice = document.getElementById("filterNotice");
const filterSexo = document.getElementById("filterSexo");
const filterEstadoCivil = document.getElementById("filterEstadoCivil");
const filterToggle = document.getElementById("filterToggle");
const filterPanel = document.getElementById("filterPanel");
const filterClear = document.getElementById("filterClear");
const addClientBtn = document.getElementById("addClientBtn");
const historyBtn = document.getElementById("historyBtn");

const clientModal = document.getElementById("clientModal");
const clientForm = document.getElementById("clientForm");
const coownersListEl = document.getElementById("coownersList");
const addCoownerBtn = document.getElementById("addCoownerBtn");

const filterSexoSegmented = document.getElementById("filterSexoSegmented");
const sexoCheckbox = document.getElementById("f_sexoCheckbox");
const sexoHidden = document.getElementById("f_sexo");
const sexoIconM = document.getElementById("f_sexoIconM");
const sexoIconF = document.getElementById("f_sexoIconF");
const sexoLabel = document.getElementById("f_sexoLabel");

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
// Panel flotante de filtro: abrir, cerrar y click afuera
// (el panel de ajustes/tema ya se maneja solo en theme-switch.js)
// ------------------------------------------------------------------
filterToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  filterPanel.classList.toggle("hidden");
  filterToggle.setAttribute("aria-expanded", String(!filterPanel.classList.contains("hidden")));
});

document.addEventListener("click", (e) => {
  if (!filterPanel.contains(e.target) && e.target !== filterToggle) filterPanel.classList.add("hidden");
});

// ------------------------------------------------------------------
// Control segmentado del filtro por sexo (Todos / Hombre / Mujer):
// al tocar un botón se marca como activo y se guarda su valor en el
// input oculto #filterSexo, que ya usa getClientesFiltrados()
// ------------------------------------------------------------------
filterSexoSegmented.querySelectorAll(".segmented__btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    filterSexoSegmented.querySelectorAll(".segmented__btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    filterSexo.value = btn.dataset.value;
    renderLista();
  });
});

// ------------------------------------------------------------------
// Switch Hombre/Mujer del formulario "Nuevo cliente": sin marcar =
// Hombre, marcado = Mujer. Actualiza el input oculto #f_sexo y resalta
// el ícono correspondiente
// ------------------------------------------------------------------
function actualizarSexoSwitch() {
  const esMujer = sexoCheckbox.checked;
  sexoHidden.value = esMujer ? "F" : "M";
  sexoLabel.textContent = esMujer ? "Mujer" : "Hombre";
  sexoIconM.classList.toggle("sex-switch__icon--active", !esMujer);
  sexoIconF.classList.toggle("sex-switch__icon--active", esMujer);
}
sexoCheckbox.addEventListener("change", actualizarSexoSwitch);

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
function hayFiltrosActivos() {
  return (
    searchInput.value.trim().length > 0 || filterSexo.value !== "todos" || filterEstadoCivil.value !== "todos"
  );
}

function renderLista() {
  const lista = getClientesFiltrados().sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  clientListEl.innerHTML = "";

  emptyStateEl.classList.toggle("hidden", lista.length > 0);
  // Aviso de "resultados filtrados": solo aparece si hay texto buscado o
  // algún filtro de sexo/estado civil distinto de "todos"
  filterNotice.classList.toggle("hidden", !hayFiltrosActivos());

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

searchInput.addEventListener("input", () => {
  searchClear.classList.toggle("hidden", searchInput.value.length === 0);
  renderLista();
});
searchClear.addEventListener("click", () => {
  searchInput.value = "";
  searchClear.classList.add("hidden");
  searchInput.focus();
  renderLista();
});
filterEstadoCivil.addEventListener("change", renderLista);
filterClear.addEventListener("click", () => {
  filterSexo.value = "todos";
  filterEstadoCivil.value = "todos";
  // Se vuelve a marcar "Todos" como activo en el control segmentado
  filterSexoSegmented.querySelectorAll(".segmented__btn").forEach((b) => b.classList.remove("active"));
  filterSexoSegmented.querySelector('[data-value="todos"]').classList.add("active");
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
  // El switch de sexo vuelve a "Hombre" (estado por defecto)
  sexoCheckbox.checked = false;
  actualizarSexoSwitch();
  // Al abrir de nuevo, se limpia cualquier marca roja que haya quedado
  // de un intento anterior
  clientForm.querySelectorAll(".field--invalid").forEach((f) => f.classList.remove("field--invalid"));
  clientModal.classList.remove("hidden");
}

function cerrarModal() {
  clientModal.classList.add("hidden");
}

addClientBtn.addEventListener("click", abrirModalNuevo);
clientModal.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", cerrarModal));

// ------------------------------------------------------------------
// Validación de campos obligatorios / con formato inválido.
// Si al guardar un campo está vacío o mal cargado, se le pone un
// reborde rojo (clase .field--invalid) que queda hasta que se corrija.
// ------------------------------------------------------------------
function marcarCampo(input, esValido) {
  const contenedor = input.closest(".field");
  if (esValido) {
    contenedor.classList.remove("field--invalid");
  } else {
    // Se saca y se vuelve a poner la clase para que la animación de
    // "sacudida" se vea de nuevo aunque ya estuviera marcado en rojo
    contenedor.classList.remove("field--invalid");
    void contenedor.offsetWidth; // fuerza al navegador a "reiniciar" la animación
    contenedor.classList.add("field--invalid");
  }
  return esValido;
}

// Se limpia la marca roja apenas el usuario empieza a corregir el campo
function limpiarAlEscribir(input) {
  input.addEventListener("input", () => input.closest(".field").classList.remove("field--invalid"));
  input.addEventListener("change", () => input.closest(".field").classList.remove("field--invalid"));
}
["f_nombre", "f_dni", "f_cuil", "f_mail"].forEach((id) => limpiarAlEscribir(document.getElementById(id)));

function validarFormularioCliente() {
  const nombreInput = document.getElementById("f_nombre");
  const dniInput = document.getElementById("f_dni");
  const cuilInput = document.getElementById("f_cuil");
  const mailInput = document.getElementById("f_mail");

  // Se evalúan TODOS los campos (sin cortar en el primero) para que se
  // marquen en rojo todos los que estén mal de una sola vez.
  // El Sexo ya no se valida acá: al ser un switch (no un <select> vacío)
  // siempre tiene un valor válido.
  const nombreOk = marcarCampo(nombreInput, nombreInput.value.trim().length > 0);
  const dniOk = marcarCampo(dniInput, dniInput.value.trim() === "" || /^\d+$/.test(dniInput.value.trim()));
  const cuilOk = marcarCampo(cuilInput, cuilInput.value.trim() === "" || /^\d+$/.test(cuilInput.value.trim()));
  const mailOk = marcarCampo(
    mailInput,
    mailInput.value.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailInput.value.trim())
  );

  return nombreOk && dniOk && cuilOk && mailOk;
}

clientForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!validarFormularioCliente()) {
    mostrarToast("Revisá los campos marcados en rojo.", "error");
    return;
  }

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
// Inicialización: se pide la lista de clientes a la base de datos vía
// la API (el tema ya lo inicializa theme-switch.js por su cuenta)
// ------------------------------------------------------------------
recargarClientes();
