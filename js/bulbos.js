/*
 * bulbos.js
 * Gestión de los ciclos de "Bulbos" de un cliente (tabla nueva: un
 * cliente puede tener varios ciclos/temporadas, ej. "Ciclo 2025",
 * "Ciclo 2026"), cada uno con sus 4 calibres, cornos y el total
 * (calculado solo, igual que en la base de datos).
 *
 * Se carga en perfil.html, DESPUÉS de perfil.js (usa "clienteId", que ya
 * declaró perfil.js) y de api-clientes.js (usa apiListarBulbos, etc.).
 */

const bulboListEl = document.getElementById("bulboList");
const addBulboBtn = document.getElementById("addBulboBtn");
const bulboModal = document.getElementById("bulboModal");
const bulboForm = document.getElementById("bulboForm");

const CAMPOS_BULBO = ["b_calibre1", "b_calibre2", "b_calibre3", "b_calibre4", "b_cornos"];

let bulbosActuales = []; // copia en memoria de los ciclos ya cargados, para editar/eliminar sin volver a pedirlos

// ------------------------------------------------------------------
// Total en vivo dentro del formulario: se recalcula solo mientras se
// escriben los calibres/cornos (el mismo cálculo que hace la base de
// datos al guardar, ver worker/schema.sql: columna GENERATED ALWAYS AS)
// ------------------------------------------------------------------
function recalcularTotalFormulario() {
  const total = CAMPOS_BULBO.reduce((acc, id) => acc + (Number(document.getElementById(id).value) || 0), 0);
  document.getElementById("b_total").value = total;
}
CAMPOS_BULBO.forEach((id) => document.getElementById(id).addEventListener("input", recalcularTotalFormulario));

// ------------------------------------------------------------------
// Abrir/cerrar el modal de alta o edición de un ciclo
// ------------------------------------------------------------------
function abrirModalBulboNuevo() {
  bulboForm.reset();
  document.getElementById("b_id").value = "";
  document.getElementById("bulboModalTitle").textContent = "Nuevo ciclo de Bulbos";
  CAMPOS_BULBO.forEach((id) => (document.getElementById(id).value = 0));
  recalcularTotalFormulario();
  bulboModal.classList.remove("hidden");
}

function abrirModalBulboEditar(bulbo) {
  document.getElementById("b_id").value = bulbo.id;
  document.getElementById("b_ciclo").value = bulbo.ciclo || "";
  document.getElementById("b_calibre1").value = bulbo.calibre1 || 0;
  document.getElementById("b_calibre2").value = bulbo.calibre2 || 0;
  document.getElementById("b_calibre3").value = bulbo.calibre3 || 0;
  document.getElementById("b_calibre4").value = bulbo.calibre4 || 0;
  document.getElementById("b_cornos").value = bulbo.cornos || 0;
  recalcularTotalFormulario();
  document.getElementById("bulboModalTitle").textContent = "Editar ciclo de Bulbos";
  bulboModal.classList.remove("hidden");
}

function cerrarModalBulbo() {
  bulboModal.classList.add("hidden");
}

addBulboBtn.addEventListener("click", abrirModalBulboNuevo);
bulboModal.querySelectorAll("[data-close-bulbo]").forEach((el) => el.addEventListener("click", cerrarModalBulbo));

// ------------------------------------------------------------------
// Render de la lista de ciclos ya cargados (tarjetas, ver .bulbo-card en el CSS)
// ------------------------------------------------------------------
function renderBulbos() {
  if (!bulbosActuales.length) {
    bulboListEl.innerHTML = `<p class="view-bulbos--empty">Todavía no se cargó ningún ciclo de bulbos para este cliente.</p>`;
    return;
  }
  bulboListEl.innerHTML = bulbosActuales
    .map(
      (b) => `
    <div class="bulbo-card" data-id="${b.id}">
      <div class="bulbo-card__header">
        <span class="material-symbols-outlined" style="color: var(--color-accent)">eco</span>
        <span class="bulbo-card__ciclo">${escapeHtml(b.ciclo)}</span>
        <div class="bulbo-card__actions">
          <button type="button" class="icon-btn icon-btn--sm bulbo-editar" aria-label="Editar ciclo">
            <span class="material-symbols-outlined">edit</span>
          </button>
          <button type="button" class="icon-btn icon-btn--sm bulbo-eliminar" aria-label="Eliminar ciclo">
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>
      </div>
      <div class="bulbo-card__grid">
        <div class="bulbo-card__item">
          <span class="bulbo-card__item-label">Calibre 1</span>
          <span class="bulbo-card__item-value">${b.calibre1 || 0}</span>
        </div>
        <div class="bulbo-card__item">
          <span class="bulbo-card__item-label">Calibre 2</span>
          <span class="bulbo-card__item-value">${b.calibre2 || 0}</span>
        </div>
        <div class="bulbo-card__item">
          <span class="bulbo-card__item-label">Calibre 3</span>
          <span class="bulbo-card__item-value">${b.calibre3 || 0}</span>
        </div>
        <div class="bulbo-card__item">
          <span class="bulbo-card__item-label">Calibre 4</span>
          <span class="bulbo-card__item-value">${b.calibre4 || 0}</span>
        </div>
        <div class="bulbo-card__item">
          <span class="bulbo-card__item-label">Cornos</span>
          <span class="bulbo-card__item-value">${b.cornos || 0}</span>
        </div>
        <div class="bulbo-card__item bulbo-card__item--total">
          <span class="bulbo-card__item-label">Total</span>
          <span class="bulbo-card__item-value">${b.total || 0}</span>
        </div>
      </div>
    </div>
  `
    )
    .join("");

  // Enganchar los botones de editar/eliminar de cada tarjeta recién pintada
  bulboListEl.querySelectorAll(".bulbo-card").forEach((card) => {
    const id = card.dataset.id;
    const bulbo = bulbosActuales.find((b) => String(b.id) === String(id));
    card.querySelector(".bulbo-editar").addEventListener("click", () => abrirModalBulboEditar(bulbo));
    card.querySelector(".bulbo-eliminar").addEventListener("click", () => eliminarBulbo(id));
  });
}

async function cargarBulbos() {
  try {
    bulbosActuales = await apiListarBulbos(clienteId);
    renderBulbos();
  } catch (err) {
    bulboListEl.innerHTML = `<p class="view-bulbos--empty">No se pudieron cargar los ciclos de bulbos.</p>`;
    console.error(err);
  }
}

async function eliminarBulbo(id) {
  if (!confirm("¿Eliminar este ciclo de bulbos? Esta acción no se puede deshacer.")) return;
  try {
    await apiEliminarBulbo(id, clienteId);
    mostrarToast("Ciclo de bulbos eliminado.", "info");
    await cargarBulbos();
  } catch (err) {
    mostrarToast("No se pudo eliminar el ciclo.", "error");
    console.error(err);
  }
}

bulboForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const ciclo = document.getElementById("b_ciclo").value.trim();
  if (!ciclo) {
    mostrarToast("Completá el nombre del ciclo (ej: Ciclo 2026).", "error");
    return;
  }

  const datos = {
    idCliente: clienteId,
    ciclo,
    calibre1: Number(document.getElementById("b_calibre1").value) || 0,
    calibre2: Number(document.getElementById("b_calibre2").value) || 0,
    calibre3: Number(document.getElementById("b_calibre3").value) || 0,
    calibre4: Number(document.getElementById("b_calibre4").value) || 0,
    cornos: Number(document.getElementById("b_cornos").value) || 0,
  };
  const idExistente = document.getElementById("b_id").value;

  try {
    if (idExistente) {
      await apiActualizarBulbo(idExistente, clienteId, datos);
      mostrarToast("Ciclo actualizado correctamente.", "success");
    } else {
      await apiCrearBulbo(datos);
      mostrarToast("Ciclo agregado correctamente.", "success");
    }
    cerrarModalBulbo();
    await cargarBulbos();
  } catch (err) {
    mostrarToast("Error al guardar el ciclo de bulbos.", "error");
    console.error(err);
  }
});

// ------------------------------------------------------------------
// Inicialización
// ------------------------------------------------------------------
cargarBulbos();
