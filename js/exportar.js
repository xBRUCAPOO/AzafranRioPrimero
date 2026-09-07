/*
 * exportar.js
 * Lógica de la página de exportación (exportar.html):
 *   1) Lee los clientes que se eligieron en index.html con el botón
 *      "Generar Planilla" (guardados en sessionStorage, con sus
 *      copropietarios ya incluidos, tal cual los devuelve la API).
 *   2) Arma una vista previa en tabla, igual a las columnas que va a
 *      tener el archivo final.
 *   3) Al tocar "Exportar a .xlsx", genera el archivo con ExcelJS
 *      (cargado desde un CDN en exportar.html) y lo descarga.
 *
 * Esta página no carga api-clientes.js (no hace falta: los datos ya
 * vienen completos desde index.html), así que tiene su propio toast
 * simple y su propio escapeHtml/formatearFecha.
 */

const EXPORT_KEY = "gestorClientes_exportSeleccion"; // sessionStorage: clientes elegidos en index.html

const introEl = document.getElementById("exportarIntro");
const emptyEl = document.getElementById("exportarEmpty");
const tableWrap = document.getElementById("exportarTableWrap");
const actionsBar = document.getElementById("exportarActionsBar");
const exportBtn = document.getElementById("exportarBtn");

let clientesElegidos = [];

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function formatearFecha(fecha) {
  if (!fecha) return "";
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}

// Arma el texto de un copropietario puntual ("Nombre (DNI 12345678)")
function textoCopropietario(co) {
  if (!co || !co.nombre) return "";
  return co.dni ? `${co.nombre} (DNI ${co.dni})` : co.nombre;
}

// Columnas de la planilla: EXACTAMENTE el mismo orden se usa en la vista
// previa (tabla HTML) y en el archivo .xlsx final, para que no haya
// sorpresas entre lo que se ve en pantalla y lo que se descarga.
const COLUMNAS = [
  { titulo: "Nombre y Apellido", valor: (c) => c.nombre || "" },
  { titulo: "Sexo", valor: (c) => (c.sexo === "F" ? "Mujer" : "Hombre") },
  { titulo: "DNI", valor: (c) => c.dni || "" },
  { titulo: "CUIL", valor: (c) => c.cuil || "" },
  { titulo: "Fecha de nacimiento", valor: (c) => formatearFecha(c.fecha_nacimiento) },
  { titulo: "Teléfono", valor: (c) => c.telefono || "" },
  { titulo: "Mail", valor: (c) => c.mail || "" },
  { titulo: "Fecha de alta", valor: (c) => formatearFecha(c.fecha_alta) },
  { titulo: "Estado civil", valor: (c) => c.estado_civil || "" },
  { titulo: "Profesión", valor: (c) => c.profesion || "" },
  { titulo: "Dirección", valor: (c) => c.direccion || "" },
  { titulo: "Referente", valor: (c) => c.referente || "" },
  { titulo: "Copropietario 1", valor: (c) => textoCopropietario((c.copropietarios || [])[0]) },
  { titulo: "Copropietario 2", valor: (c) => textoCopropietario((c.copropietarios || [])[1]) },
  { titulo: "Copropietario 3", valor: (c) => textoCopropietario((c.copropietarios || [])[2]) },
];

// ------------------------------------------------------------------
// Toast simple y propio de esta página (no carga api-clientes.js)
// ------------------------------------------------------------------
function mostrarToast(mensaje, tipo = "info") {
  const toastEl = document.getElementById("toast");
  if (!toastEl) return;
  const iconos = { success: "check_circle", error: "cancel", info: "info", warning: "warning" };
  const color = `var(--color-${tipo})`;
  toastEl.innerHTML = `
    <span class="toast__text">${mensaje}</span>
    <span class="material-symbols-outlined toast__icon" style="color:${color}">${iconos[tipo] || iconos.info}</span>
  `;
  toastEl.style.borderLeftColor = color;
  toastEl.classList.remove("hidden");
  setTimeout(() => toastEl.classList.add("hidden"), 2600);
}

// ------------------------------------------------------------------
// Carga la selección hecha en index.html y arma la vista previa
// ------------------------------------------------------------------
function cargarSeleccion() {
  try {
    clientesElegidos = JSON.parse(sessionStorage.getItem(EXPORT_KEY) || "[]");
  } catch (err) {
    clientesElegidos = [];
  }

  if (!clientesElegidos.length) {
    emptyEl.classList.remove("hidden");
    tableWrap.classList.add("hidden");
    introEl.classList.add("hidden");
    actionsBar.classList.add("hidden");
    return;
  }

  introEl.innerHTML = `Vista previa de la planilla con <strong>${clientesElegidos.length}</strong> cliente${
    clientesElegidos.length === 1 ? "" : "s"
  }. Revisá los datos y, cuando esté todo bien, exportalos a Excel.`;
  renderTabla();
}

function renderTabla() {
  const encabezado = COLUMNAS.map((col) => `<th>${col.titulo}</th>`).join("");
  const filas = clientesElegidos
    .map((c) => `<tr>${COLUMNAS.map((col) => `<td>${escapeHtml(col.valor(c))}</td>`).join("")}</tr>`)
    .join("");

  tableWrap.innerHTML = `
    <table class="exportar-table">
      <thead><tr>${encabezado}</tr></thead>
      <tbody>${filas}</tbody>
    </table>
  `;
}

// ------------------------------------------------------------------
// Genera el archivo .xlsx con ExcelJS: encabezado con el morado de la
// marca y texto blanco en negrita, ancho de columna automático, bordes
// finos y la fila de encabezado congelada, para que se vea prolijo al
// abrirlo en Excel.
// ------------------------------------------------------------------
async function exportarAExcel() {
  if (!clientesElegidos.length) return;

  const contenidoOriginal = exportBtn.innerHTML;
  exportBtn.disabled = true;
  exportBtn.innerHTML = `<span class="spinner spinner--sm"></span> Generando archivo...`;

  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Gestor de Clientes";
    workbook.created = new Date();

    const hoja = workbook.addWorksheet("Clientes");

    // Una columna por cada dato, con un ancho cómodo según el largo del título
    hoja.columns = COLUMNAS.map((col) => ({
      header: col.titulo,
      key: col.titulo,
      width: Math.max(col.titulo.length + 4, 16),
    }));

    clientesElegidos.forEach((c) => {
      const fila = {};
      COLUMNAS.forEach((col) => (fila[col.titulo] = col.valor(c)));
      hoja.addRow(fila);
    });

    // Encabezado: fondo morado de la marca (#8a639a) y texto blanco en negrita
    hoja.getRow(1).eachCell((celda) => {
      celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8A639A" } };
      celda.font = { color: { argb: "FFFFFFFF" }, bold: true };
      celda.alignment = { vertical: "middle", horizontal: "left" };
    });
    // La fila de encabezado queda siempre visible aunque se scrollee la planilla
    hoja.views = [{ state: "frozen", ySplit: 1 }];

    // Bordes finos y grises en todas las celdas con datos
    hoja.eachRow((fila) => {
      fila.eachCell((celda) => {
        celda.border = {
          top: { style: "thin", color: { argb: "FFE0E0E0" } },
          bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
          left: { style: "thin", color: { argb: "FFE0E0E0" } },
          right: { style: "thin", color: { argb: "FFE0E0E0" } },
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const fecha = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes_${fecha}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    mostrarToast("Planilla descargada correctamente.", "success");
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo generar el archivo Excel.", "error");
  } finally {
    exportBtn.disabled = false;
    exportBtn.innerHTML = contenidoOriginal;
  }
}

exportBtn.addEventListener("click", exportarAExcel);

cargarSeleccion();
