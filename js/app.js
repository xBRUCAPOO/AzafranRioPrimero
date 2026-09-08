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

// Modo selección: se activa con el botón "Generar Planilla" y permite
// tildar varios clientes para mandarlos a exportar.html. clientesSeleccionados
// guarda los ids como texto (Set), para no depender de si vienen como
// número o como string según la fuente (API real vs modo demo).
let modoSeleccion = false;
let clientesSeleccionados = new Set();

// ------------------------------------------------------------------
// Referencias al DOM
// ------------------------------------------------------------------
const appEl = document.querySelector(".app");
const clientListEl = document.getElementById("clientList");
const emptyStateEl = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const searchClear = document.getElementById("searchClear");
const filterNotice = document.getElementById("filterNotice");
const filterSexo = document.getElementById("filterSexo");
const filterEstadoCivil = document.getElementById("filterEstadoCivil");
const filterEstadoCivilWrap = document.getElementById("filterEstadoCivilWrap");
// NUEVOS filtros: profesión, referente y rango de fecha de alta
const filterProfesion = document.getElementById("filterProfesion");
const filterReferente = document.getElementById("filterReferente");
const filterFechaAltaDesde = document.getElementById("filterFechaAltaDesde");
const filterFechaAltaHasta = document.getElementById("filterFechaAltaHasta");
const filterToggle = document.getElementById("filterToggle");
const filterPanel = document.getElementById("filterPanel");
const filterClear = document.getElementById("filterClear");
const addClientBtn = document.getElementById("addClientBtn");
const historyBtn = document.getElementById("historyBtn");

// Modo selección ("Generar Planilla")
const planillaBtn = document.getElementById("planillaBtn");
const selectionBar = document.getElementById("selectionBar");
const selectionCount = document.getElementById("selectionCount");
const selectionCancel = document.getElementById("selectionCancel");
const selectionContinue = document.getElementById("selectionContinue");

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
  window.location.href = "paginas/historial.html";
});

// Vuelve a traer la lista completa desde MySQL y refresca la pantalla.
// Si la API no responde (por ejemplo, todavía no hay servidor PHP corriendo),
// se activa el MODO DEMO (definido en api-clientes.js) con 4 clientes de prueba.
async function recargarClientes() {
  // Pantalla de carga: se muestra mientras se espera la respuesta del
  // servidor (o mientras se resuelve que hay que pasar a modo demo)
  filterNotice.classList.add("hidden");
  emptyStateEl.classList.add("hidden");
  clientListEl.innerHTML = `<li class="loading-state"><span class="spinner"></span>Cargando clientes...</li>`;

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
// ------------------------------------------------------------------
// Opciones del filtro de Estado Civil: siempre se muestran los 5 estados
// civiles posibles (la misma lista fija de ICONOS_ESTADO_CIVIL, en
// api-clientes.js), no solo los que ya tengan algún cliente cargado.
// Antes se armaban dinámicamente según los clientes existentes, y si
// todavía no había ningún cliente "Divorciado/a" (por ejemplo), esa
// opción directamente no aparecía en el filtro.
// ------------------------------------------------------------------
function refreshEstadoCivilOptions() {
  const seleccionActual = filterEstadoCivil.value;
  const listaOpciones = filterEstadoCivilWrap.querySelector(".custom-select__options");

  listaOpciones.innerHTML =
    `<li class="custom-select__option" data-value="todos" role="option">
      <span class="material-symbols-outlined">checklist</span> Todos
    </li>` +
    Object.keys(ICONOS_ESTADO_CIVIL)
      .map(
        (valor) => `
      <li class="custom-select__option" data-value="${escapeHtml(valor)}" role="option">
        <span class="material-symbols-outlined">${iconoEstadoCivil(valor)}</span> ${escapeHtml(valor)}
      </li>`
      )
      .join("");

  // Al recrear las opciones a mano hay que volver a engancharles los
  // eventos de clic (custom-select.js no las conocía todavía)
  CustomSelect.init(filterEstadoCivilWrap);
  // Se mantiene la selección anterior (siempre existe, ya que ahora la
  // lista de opciones es fija)
  CustomSelect.setValueById("filterEstadoCivil", seleccionActual || "todos");
}

// ------------------------------------------------------------------
// Búsqueda + filtro (se aplican sobre la copia ya traída de MySQL)
// ------------------------------------------------------------------
function getClientesFiltrados() {
  const texto = searchInput.value.trim().toLowerCase();
  const sexo = filterSexo.value;
  const estadoCivil = filterEstadoCivil.value;
  // NUEVOS filtros: profesión y referente (coincidencia parcial, sin
  // importar mayúsculas/minúsculas) y rango de fecha de alta
  const profesion = filterProfesion.value.trim().toLowerCase();
  const referente = filterReferente.value.trim().toLowerCase();
  const fechaDesde = filterFechaAltaDesde.value; // "YYYY-MM-DD" o vacío
  const fechaHasta = filterFechaAltaHasta.value;

  return clientes.filter((c) => {
    const coincideTexto =
      !texto ||
      c.nombre.toLowerCase().includes(texto) ||
      (c.dni || "").toLowerCase().includes(texto) ||
      (c.mail || "").toLowerCase().includes(texto);
    const coincideSexo = sexo === "todos" || c.sexo === sexo;
    const coincideEstado = estadoCivil === "todos" || c.estado_civil === estadoCivil;
    const coincideProfesion = !profesion || (c.profesion || "").toLowerCase().includes(profesion);
    const coincideReferente = !referente || (c.referente || "").toLowerCase().includes(referente);
    const coincideFechaDesde = !fechaDesde || (c.fecha_alta && c.fecha_alta >= fechaDesde);
    const coincideFechaHasta = !fechaHasta || (c.fecha_alta && c.fecha_alta <= fechaHasta);
    return (
      coincideTexto &&
      coincideSexo &&
      coincideEstado &&
      coincideProfesion &&
      coincideReferente &&
      coincideFechaDesde &&
      coincideFechaHasta
    );
  });
}

// ------------------------------------------------------------------
// Render de la lista de clientes
// ------------------------------------------------------------------
function hayFiltrosActivos() {
  return (
    searchInput.value.trim().length > 0 ||
    filterSexo.value !== "todos" ||
    filterEstadoCivil.value !== "todos" ||
    filterProfesion.value.trim().length > 0 ||
    filterReferente.value.trim().length > 0 ||
    filterFechaAltaDesde.value !== "" ||
    filterFechaAltaHasta.value !== ""
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
    const estaSeleccionado = clientesSeleccionados.has(String(cliente.id));
    const li = document.createElement("li");
    li.className = "client-card" + (estaSeleccionado ? " is-selected" : "");
    li.style.animationDelay = `${Math.min(i, 12) * 25}ms`;
    li.dataset.id = cliente.id;

    // Icono según sexo: "face" = hombre, "face_3" = mujer (Material Symbols)
    const icono = cliente.sexo === "F" ? "face_3" : "face";

    li.innerHTML = `
      <input type="checkbox" class="client-card__checkbox" data-id="${cliente.id}" ${estaSeleccionado ? "checked" : ""} aria-label="Elegir a ${escapeHtml(cliente.nombre)} para la planilla" />
      <span class="client-card__sex-icon">
        <span class="material-symbols-outlined">${icono}</span>
      </span>
      <span class="client-card__name">${escapeHtml(cliente.nombre)}</span>
      <span class="client-card__meta">${escapeHtml(cliente.telefono || "")}</span>
    `;

    const checkbox = li.querySelector(".client-card__checkbox");
    // El clic en el propio checkbox no debe "burbujear" hacia el clic de
    // la tarjeta (si no, se tildaría y destildaría dos veces seguidas)
    checkbox.addEventListener("click", (e) => e.stopPropagation());
    checkbox.addEventListener("change", () => actualizarSeleccionCliente(li, checkbox));

    li.addEventListener("click", () => {
      if (modoSeleccion) {
        // En modo selección, tocar cualquier parte de la tarjeta tilda/destilda
        checkbox.checked = !checkbox.checked;
        actualizarSeleccionCliente(li, checkbox);
        return;
      }
      // Fuera del modo selección, se navega de página completa al perfil
      window.location.href = `paginas/perfil.html?id=${cliente.id}`;
    });
    clientListEl.appendChild(li);
  });
}

// ------------------------------------------------------------------
// Modo selección de clientes, para "Generar Planilla": arranca con el
// botón #planillaBtn, agrega un checkbox a cada tarjeta y muestra una
// barra flotante con la cantidad elegida (#selectionBar). Al confirmar,
// los datos completos de los clientes elegidos (ya están en memoria en
// "clientes", con sus copropietarios incluidos) se guardan en
// sessionStorage y se navega a exportar.html para la vista previa.
// ------------------------------------------------------------------
function actualizarSeleccionCliente(li, checkbox) {
  const id = String(checkbox.dataset.id);
  if (checkbox.checked) clientesSeleccionados.add(id);
  else clientesSeleccionados.delete(id);
  li.classList.toggle("is-selected", checkbox.checked);
  selectionCount.textContent = clientesSeleccionados.size;
}

function iniciarModoSeleccion() {
  modoSeleccion = true;
  clientesSeleccionados.clear();
  appEl.classList.add("selection-mode");
  selectionBar.classList.remove("hidden");
  selectionCount.textContent = "0";
  renderLista(); // vuelve a pintar la lista para que aparezcan los checkboxes
}

function salirModoSeleccion() {
  modoSeleccion = false;
  clientesSeleccionados.clear();
  appEl.classList.remove("selection-mode");
  selectionBar.classList.add("hidden");
  renderLista();
}

planillaBtn.addEventListener("click", iniciarModoSeleccion);
selectionCancel.addEventListener("click", salirModoSeleccion);

// "Continuar": guarda los clientes elegidos y navega a la vista previa.
// Antes el botón quedaba "disabled" sin ningún aviso; ahora siempre se
// puede tocar, y si no hay nadie elegido se muestra un error explícito.
selectionContinue.addEventListener("click", () => {
  if (clientesSeleccionados.size === 0) {
    mostrarToast("Elegí al menos un cliente antes de continuar.", "error");
    // Vibración + destello rojo de medio segundo en la barra, para que se
    // note de un vistazo qué elemento tiene el problema
    selectionBar.classList.remove("selection-bar--error");
    void selectionBar.offsetWidth; // fuerza a reiniciar la animación si se hace doble clic rápido
    selectionBar.classList.add("selection-bar--error");
    setTimeout(() => selectionBar.classList.remove("selection-bar--error"), 500);
    return;
  }
  const elegidos = clientes.filter((c) => clientesSeleccionados.has(String(c.id)));
  sessionStorage.setItem("gestorClientes_exportSeleccion", JSON.stringify(elegidos));
  window.location.href = "paginas/exportar.html";
});

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
// NUEVOS filtros: profesión, referente (mientras se escribe) y fecha de
// alta desde/hasta (al elegir una fecha)
filterProfesion.addEventListener("input", renderLista);
filterReferente.addEventListener("input", renderLista);
filterFechaAltaDesde.addEventListener("change", renderLista);
filterFechaAltaHasta.addEventListener("change", renderLista);

filterClear.addEventListener("click", () => {
  filterSexo.value = "todos";
  CustomSelect.setValueById("filterEstadoCivil", "todos");
  filterProfesion.value = "";
  filterReferente.value = "";
  filterFechaAltaDesde.value = "";
  filterFechaAltaHasta.value = "";
  CustomDate.syncById("filterFechaAltaDesde");
  CustomDate.syncById("filterFechaAltaHasta");
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
  // Nuevo campo Sucursal: siempre arranca en "Rio Primero"
  document.getElementById("f_sucursal").value = "Rio Primero";
  // clientForm.reset() ya vació los <input> ocultos de fecha, pero no
  // actualiza el texto visible de los calendarios propios: se sincroniza a mano
  CustomDate.syncById("f_fechaNacimiento");
  CustomDate.syncById("f_fechaAlta");
  // clientForm.reset() ya vació el <input> oculto de Estado civil, pero no
  // actualiza el texto/ícono visibles del desplegable propio: se sincroniza a mano
  CustomSelect.setValueById("f_estadoCivil", "");
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
    sucursalNombre: document.getElementById("f_sucursal").value.trim() || "Rio Primero",
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
