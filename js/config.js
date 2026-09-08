/*
 * config.js
 * ÚNICO lugar donde vive la URL del backend (antes era "api/clientes.php"
 * en el mismo servidor; ahora el backend es un Cloudflare Worker en OTRO
 * dominio). Se carga PRIMERO en las 4 páginas (index, perfil, historial,
 * exportar), antes que api-clientes.js y db-status.js, que lo usan.
 *
 * Después de desplegar el Worker (ver worker/README-DEPLOY.md), pegar acá
 * la URL que imprime "wrangler deploy".
 */
const API_BASE = "https://gestor-clientes-api.TU-USUARIO.workers.dev";
