/*
 * perfil.js
 * Lógica de la página de perfil de un cliente (perfil.html).
 *
 * La tuerca de ajustes (tema) vive en theme-switch.js y las llamadas a la
 * API + el toast + el historial viven en api-clientes.js. Ambos se cargan
 * ANTES que este archivo.
 */

const MAX_COOWNERS = 3;

const params = new URLSearchParams(window.location.search);
const clienteId = params.get("id");

let clienteActual = null;
let coownerRowCount = 0;

// ------------------------------------------------------------------
// Referencias al DOM
// ------------------------------------------------------------------
const perfilNombre = document.getElementById("perfilNombre");
const perfilSexIcon = document.getElementById("perfilSexIcon");
const perfilGrid = document.getElementById("perfilGrid");
const perfilCoowners = document.getElementById("perfilCoowners");
const copyAllBtn = document.getElementById("copyAllBtn");
const editBtn = document.getElementById("editBtn");
const deleteBtn = document.getElementById("deleteBtn");

const clientModal = document.getElementById("clientModal");
const clientForm = document.getElementById("clientForm");
const coownersListEl = document.getElementById("coownersList");
const addCoownerBtn = document.getElementById("addCoownerBtn");

const sexoCheckbox = document.getElementById("f_sexoCheckbox");
const sexoHidden = document.getElementById("f_sexo");
const sexoIconM = document.getElementById("f_sexoIconM");
const sexoIconF = document.getElementById("f_sexoIconF");
const sexoLabel = document.getElementById("f_sexoLabel");

// Switch Hombre/Mujer del formulario de edición: sin marcar = Hombre,
// marcado = Mujer. Actualiza el input oculto #f_sexo y resalta el ícono
function actualizarSexoSwitch() {
  const esMujer = sexoCheckbox.checked;
  sexoHidden.value = esMujer ? "F" : "M";
  sexoLabel.textContent = esMujer ? "Mujer" : "Hombre";
  sexoIconM.classList.toggle("sex-switch__icon--active", !esMujer);
  sexoIconF.classList.toggle("sex-switch__icon--active", esMujer);
}
sexoCheckbox.addEventListener("change", actualizarSexoSwitch);

const confirmDeleteCard = document.getElementById("confirmDeleteCard");
const confirmDeleteNombre = document.getElementById("confirmDeleteNombre");
const confirmDeleteCancel = document.getElementById("confirmDeleteCancel");
const confirmDeleteAccept = document.getElementById("confirmDeleteAccept");

// ------------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------------
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function formatearFecha(fecha) {
  if (!fecha) return "Sin datos";
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}

// ------------------------------------------------------------------
// Carga y muestra del perfil (con botón de copiar en cada dato)
// ------------------------------------------------------------------
function campoVista(icono, etiqueta, valor) {
  return `
    <div class="view-item">
      <span class="material-symbols-outlined">${icono}</span>
      <div class="view-item__text">
        <span class="view-item__label">${etiqueta}</span>
        <span class="view-item__value">${escapeHtml(valor) || "Sin datos"}</span>
      </div>
      <button type="button" class="copy-btn" data-copy="${escapeHtml(valor || "")}" data-etiqueta="${etiqueta}" aria-label="Copiar ${etiqueta}">
        <span class="material-symbols-outlined">content_copy</span>
      </button>
    </div>
  `;
}

async function cargarPerfil() {
  if (!clienteId) {
    mostrarToast("Falta el id del cliente en la URL.", "error");
    return;
  }
  try {
    clienteActual = await apiObtenerUno(clienteId);
  } catch (err) {
    mostrarToast("No se pudo cargar el cliente.", "error");
    console.error(err);
    return;
  }
  renderPerfil();
}

function renderPerfil() {
  const c = clienteActual;
  perfilNombre.textContent = c.nombre;
  perfilSexIcon.textContent = c.sexo === "F" ? "face_3" : "face";

  perfilGrid.innerHTML = [
    campoVista(c.sexo === "F" ? "face_3" : "face", "Sexo", c.sexo === "F" ? "Mujer" : "Hombre"),
    campoVista("badge", "DNI", c.dni),
    campoVista("assignment_ind", "CUIL", c.cuil),
    campoVista("cake", "Fecha de nacimiento", formatearFecha(c.fecha_nacimiento)),
    campoVista("call", "Teléfono", c.telefono),
    campoVista("mail", "Mail", c.mail),
    campoVista("event_available", "Fecha de alta", formatearFecha(c.fecha_alta)),
    campoVista("favorite", "Estado civil", c.estado_civil),
    campoVista("work", "Profesión", c.profesion),
    campoVista("home", "Dirección", c.direccion),
    campoVista("groups", "Referente", c.referente),
  ].join("");

  const coprop = c.copropietarios || [];
  perfilCoowners.innerHTML = coprop.length
    ? `<p class="view-coowners__title">Copropietarios</p>` +
      coprop
        .map(
          (co) => `
        <div class="view-coowner">
          <span class="material-symbols-outlined">person</span>
          <span><strong>${escapeHtml(co.nombre)}</strong>${co.dni ? " · DNI " + escapeHtml(co.dni) : ""}</span>
        </div>`
        )
        .join("")
    : "";
}

// Copiar un solo dato: se delega el click en el contenedor de la grilla
perfilGrid.addEventListener("click", (e) => {
  const btn = e.target.closest(".copy-btn");
  if (!btn) return;
  const valor = btn.dataset.copy;
  if (!valor) {
    mostrarToast("Ese dato está vacío.", "warning");
    return;
  }
  navigator.clipboard.writeText(valor);
  mostrarToast(`${btn.dataset.etiqueta} copiado.`, "success");
});

// Copiar el perfil completo (todos los campos, con su etiqueta) de una vez
copyAllBtn.addEventListener("click", () => {
  const c = clienteActual;
  if (!c) return;
  const texto = [
    `Nombre y Apellido: ${c.nombre || ""}`,
    `Sexo: ${c.sexo === "F" ? "Mujer" : "Hombre"}`,
    `DNI: ${c.dni || ""}`,
    `CUIL: ${c.cuil || ""}`,
    `Fecha de nacimiento: ${formatearFecha(c.fecha_nacimiento)}`,
    `Teléfono: ${c.telefono || ""}`,
    `Mail: ${c.mail || ""}`,
    `Fecha de alta: ${formatearFecha(c.fecha_alta)}`,
    `Estado civil: ${c.estado_civil || ""}`,
    `Profesión: ${c.profesion || ""}`,
    `Dirección: ${c.direccion || ""}`,
    `Referente: ${c.referente || ""}`,
  ].join("\n");
  navigator.clipboard.writeText(texto);
  mostrarToast("Perfil completo copiado.", "success");
});

// ------------------------------------------------------------------
// Copropietarios dentro del formulario de edición (máximo 3)
// ------------------------------------------------------------------
function crearFilaCoowner(data = { nombre: "", dni: "" }) {
  coownerRowCount++;
  const row = document.createElement("div");
  row.className = "coowner-row";
  row.dataset.rowId = coownerRowCount;
  row.innerHTML = `
    <label class="field">
      <span>Nombre y Apellido</span>
      <input type="text" class="coowner-nombre" maxlength="150" value="${escapeHtml(data.nombre)}" />
    </label>
    <label class="field">
      <span>DNI</span>
      <input type="text" class="coowner-dni" inputmode="numeric" maxlength="8" value="${escapeHtml(data.dni)}" />
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
    .filter((c) => c.nombre || c.dni);
}

// ------------------------------------------------------------------
// Modal de edición: se abre siempre con los datos ya cargados
// ------------------------------------------------------------------
editBtn.addEventListener("click", () => {
  const c = clienteActual;
  document.getElementById("clientId").value = c.id;
  document.getElementById("f_nombre").value = c.nombre;
  // Se pone el switch en la posición correspondiente al sexo del cliente
  sexoCheckbox.checked = c.sexo === "F";
  actualizarSexoSwitch();
  document.getElementById("f_dni").value = c.dni;
  document.getElementById("f_cuil").value = c.cuil;
  document.getElementById("f_fechaNacimiento").value = c.fecha_nacimiento || "";
  document.getElementById("f_telefono").value = c.telefono;
  document.getElementById("f_mail").value = c.mail;
  document.getElementById("f_fechaAlta").value = c.fecha_alta || "";
  document.getElementById("f_estadoCivil").value = c.estado_civil || "";
  document.getElementById("f_profesion").value = c.profesion;
  document.getElementById("f_direccion").value = c.direccion;
  document.getElementById("f_referente").value = c.referente;

  coownersListEl.innerHTML = "";
  (c.copropietarios || []).forEach((co) => crearFilaCoowner(co));
  actualizarBotonAgregarCoowner();

  // Se limpia cualquier marca roja que haya quedado de un intento anterior
  clientForm.querySelectorAll(".field--invalid").forEach((f) => f.classList.remove("field--invalid"));

  clientModal.classList.remove("hidden");
});

clientModal.querySelectorAll("[data-close]").forEach((el) =>
  el.addEventListener("click", () => clientModal.classList.add("hidden"))
);

// ------------------------------------------------------------------
// Validación de campos obligatorios / con formato inválido (igual que
// en app.js): reborde rojo hasta que se corrija el dato
// ------------------------------------------------------------------
function marcarCampo(input, esValido) {
  const contenedor = input.closest(".field");
  if (esValido) {
    contenedor.classList.remove("field--invalid");
  } else {
    contenedor.classList.remove("field--invalid");
    void contenedor.offsetWidth; // reinicia la animación de "sacudida"
    contenedor.classList.add("field--invalid");
  }
  return esValido;
}

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
    const respuesta = await apiActualizar(clienteId, datosCliente);
    if (respuesta.error) {
      mostrarToast(respuesta.error, "error");
      return;
    }
    mostrarToast("Cliente actualizado correctamente.", "success");
    clientModal.classList.add("hidden");
    await cargarPerfil(); // refresca los datos ya guardados en pantalla
  } catch (err) {
    mostrarToast("Error al guardar en la base de datos.", "error");
    console.error(err);
  }
});

// ------------------------------------------------------------------
// Eliminar con DOBLE confirmación:
//   1) tarjeta flotante propia de la página (con el aviso de que la
//      acción es irreversible)
//   2) alert nativo del navegador (solo si en el paso 1 se confirmó)
// ------------------------------------------------------------------
deleteBtn.addEventListener("click", () => {
  confirmDeleteNombre.textContent = clienteActual.nombre;
  confirmDeleteCard.classList.remove("hidden");
});

confirmDeleteCancel.addEventListener("click", () => {
  confirmDeleteCard.classList.add("hidden");
});

confirmDeleteAccept.addEventListener("click", async () => {
  confirmDeleteCard.classList.add("hidden");

  // Segunda confirmación: el alert nativo del navegador
  const confirmado = confirm(
    `Esta acción no se puede deshacer. ¿Eliminar definitivamente a ${clienteActual.nombre}?`
  );
  if (!confirmado) return;

  try {
    await apiEliminar(clienteId, clienteActual.nombre);
    mostrarToast("Cliente eliminado.", "info");
    setTimeout(() => (window.location.href = "index.html"), 900);
  } catch (err) {
    mostrarToast("No se pudo eliminar el cliente.", "error");
    console.error(err);
  }
});

// ------------------------------------------------------------------
// Inicialización (el tema ya lo inicializa theme-switch.js por su cuenta)
// ------------------------------------------------------------------
cargarPerfil();
