/*
 * historial.js
 * Lee el registro de altas, ediciones y bajas que guarda registrarHistorial()
 * en api-clientes.js (localStorage, clave "gestorClientes_historial"), y lo
 * muestra ordenado del más reciente al más antiguo. Permite buscar por
 * nombre de cliente y filtrar por tipo de movimiento y por fecha exacta.
 *
 * IMPORTANTE: este historial es del lado del navegador (localStorage), no
 * de la base de datos. Sirve para ver rápido qué se hizo en este equipo.
 * Si más adelante se necesita un historial "oficial" compartido entre
 * todos los que usan el sistema, hay que sumar una tabla nueva en MySQL
 * y un endpoint en el backend PHP que registre cada acción ahí.
 */

const HISTORIAL_KEY = "gestorClientes_historial";

const listEl = document.getElementById("historialList");
const emptyEl = document.getElementById("historialEmpty");
const searchInput = document.getElementById("historialSearch");
const searchClear = document.getElementById("historialSearchClear");
const filterNotice = document.getElementById("historialFilterNotice");

const filterToggle = document.getElementById("historialFilterToggle");
const filterPanel = document.getElementById("historialFilterPanel");
const filterTipo = document.getElementById("historialFilterTipo");
// Antes era una fecha exacta (historialFilterFecha); ahora es un rango
const filterFechaDesde = document.getElementById("historialFilterFechaDesde");
const filterFechaHasta = document.getElementById("historialFilterFechaHasta");
const filterClear = document.getElementById("historialFilterClear");

// Icono, etiqueta y clase de color según el tipo de acción registrada
const ICONOS = { alta: "person_add", edicion: "edit", baja: "person_remove" };
const ETIQUETAS = { alta: "Alta de cliente", edicion: "Edición de cliente", baja: "Baja de cliente" };
const CLASES = { alta: "historial-item--success", edicion: "historial-item--info", baja: "historial-item--error" };

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ------------------------------------------------------------------
// Panel flotante de filtro: abrir, cerrar y click afuera (igual que en
// el listado de clientes)
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
// Buscador con mini "x" para limpiar
// ------------------------------------------------------------------
searchInput.addEventListener("input", () => {
  searchClear.classList.toggle("hidden", searchInput.value.length === 0);
  renderHistorial();
});
searchClear.addEventListener("click", () => {
  searchInput.value = "";
  searchClear.classList.add("hidden");
  searchInput.focus();
  renderHistorial();
});
filterTipo.addEventListener("change", renderHistorial);
filterFechaDesde.addEventListener("change", renderHistorial);
filterFechaHasta.addEventListener("change", renderHistorial);
filterClear.addEventListener("click", () => {
  CustomSelect.setValueById("historialFilterTipo", "todos");
  filterFechaDesde.value = "";
  filterFechaHasta.value = "";
  renderHistorial();
});

function hayFiltrosActivos() {
  return (
    searchInput.value.trim().length > 0 ||
    filterTipo.value !== "todos" ||
    filterFechaDesde.value !== "" ||
    filterFechaHasta.value !== ""
  );
}

// ------------------------------------------------------------------
// Filtrado + render
// ------------------------------------------------------------------
function getHistorialFiltrado() {
  const historial = JSON.parse(localStorage.getItem(HISTORIAL_KEY) || "[]");
  const texto = searchInput.value.trim().toLowerCase();
  const tipo = filterTipo.value;
  const fechaDesde = filterFechaDesde.value; // formato YYYY-MM-DD
  const fechaHasta = filterFechaHasta.value;

  return historial.filter((item) => {
    const fechaItem = item.fecha.slice(0, 10);
    const coincideTexto = !texto || (item.nombreCliente || "").toLowerCase().includes(texto);
    const coincideTipo = tipo === "todos" || item.accion === tipo;
    const coincideDesde = !fechaDesde || fechaItem >= fechaDesde;
    const coincideHasta = !fechaHasta || fechaItem <= fechaHasta;
    return coincideTexto && coincideTipo && coincideDesde && coincideHasta;
  });
}

function renderHistorial() {
  const historialCompleto = JSON.parse(localStorage.getItem(HISTORIAL_KEY) || "[]");
  const lista = getHistorialFiltrado();

  filterNotice.classList.toggle("hidden", !hayFiltrosActivos());
  emptyEl.classList.toggle("hidden", lista.length > 0);
  emptyEl.lastChild.textContent = historialCompleto.length
    ? " No se encontraron movimientos con esos criterios."
    : " Todavía no se registraron movimientos en este navegador.";

  listEl.innerHTML = lista
    .map((item, i) => {
      const fechaTexto = new Date(item.fecha).toLocaleString("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
      });
      return `
        <li class="historial-item ${CLASES[item.accion] || ""}" style="animation-delay:${Math.min(i, 12) * 25}ms">
          <span class="material-symbols-outlined">${ICONOS[item.accion] || "history"}</span>
          <div class="historial-item__text">
            <span class="historial-item__title">
              ${ETIQUETAS[item.accion] || item.accion} — ${escapeHtml(item.nombreCliente || "Sin nombre")}
            </span>
            <span class="historial-item__date">${fechaTexto}</span>
          </div>
        </li>
      `;
    })
    .join("");
}

renderHistorial();
