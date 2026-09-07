/*
 * db-status.js
 * Indicador de conexión a la base de datos, anclado abajo a la derecha
 * del footer (ver .footer-db en css/styles.css), presente en las 4
 * páginas (index.html, perfil.html, historial.html y exportar.html).
 *
 * Hace una petición liviana a la API (api/clientes.php) para saber si
 * el servidor PHP/MySQL está respondiendo:
 *   - Responde bien  -> ícono "database" y texto en VERDE.
 *   - No responde    -> ícono "database_off" (tachado) y texto en ROJO,
 *                       y el tooltip avisa que se están viendo datos de prueba.
 *
 * Es independiente del "modo demo" que ya maneja api-clientes.js para
 * el listado/perfil (cada uno hace su propia verificación), así que
 * funciona igual en historial.html y exportar.html, que no cargan todo
 * api-clientes.js.
 */

const DB_STATUS_URL = "api/clientes.php";

async function verificarConexionDB() {
  const contenedor = document.getElementById("footerDb");
  const icono = document.getElementById("footerDbIcon");
  const texto = document.getElementById("footerDbText");
  const tooltip = document.getElementById("footerDbTooltip");
  if (!contenedor) return; // esta página no tiene el indicador

  try {
    const res = await fetch(DB_STATUS_URL, { method: "GET" });
    if (!res.ok) throw new Error("La API respondió con error");
    // OJO: si no hay un servidor PHP corriendo (por ejemplo, se abrió el
    // proyecto con un servidor estático), la petición puede devolver 200
    // igual, pero con el CÓDIGO FUENTE de clientes.php como texto plano
    // en vez de JSON real. Por eso no alcanza con mirar res.ok: hay que
    // confirmar que la respuesta sea JSON válido, igual que hace
    // apiListar() en api-clientes.js.
    await res.json();

    contenedor.className = "footer-db footer-db--ok";
    icono.textContent = "database";
    texto.textContent = "Base de datos conectada";
    tooltip.textContent = "La conexión con la base de datos funciona correctamente.";
  } catch (err) {
    contenedor.className = "footer-db footer-db--error";
    icono.textContent = "database_off";
    texto.textContent = "Sin conexión";
    tooltip.textContent = "Sin conexión con el servidor: estás viendo datos de prueba (modo demo).";
  }
}

verificarConexionDB();
