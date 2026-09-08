/**
 * worker/src/index.js
 * Reemplaza por completo a api/clientes.php + config.php: es la API REST
 * del Gestor de Clientes, corriendo como Cloudflare Worker sobre una base
 * D1 (SQLite serverless). Se despliega con:
 *   wrangler deploy
 * (ver worker/README-DEPLOY.md para el paso a paso completo)
 *
 * Endpoints:
 *   GET    /api/clientes            -> lista de clientes (con copropietarios)
 *   GET    /api/clientes?id=5       -> un cliente (con copropietarios y bulbos)
 *   POST   /api/clientes            -> crea un cliente nuevo
 *   PUT    /api/clientes?id=5       -> actualiza un cliente existente
 *   DELETE /api/clientes?id=5       -> elimina un cliente (cascada)
 *
 *   GET    /api/bulbos?clienteId=5  -> ciclos de bulbos de ese cliente
 *   POST   /api/bulbos              -> crea un ciclo nuevo
 *   PUT    /api/bulbos?id=3         -> actualiza un ciclo
 *   DELETE /api/bulbos?id=3         -> elimina un ciclo
 *
 * La base D1 se conecta sola vía "binding": ver worker/wrangler.toml,
 * donde el binding se llama "DB" (por eso acá abajo se usa env.DB).
 */

const MAX_COPROPIETARIOS = 3; // Un cliente puede tener como máximo 3 copropietarios

// ------------------------------------------------------------------
// CORS: el frontend vive en un dominio distinto (Cloudflare Pages), así
// que TODAS las respuestas necesitan estos encabezados. Se centraliza acá
// para no repetirlos en cada función.
// ------------------------------------------------------------------
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS },
  });
}

// ------------------------------------------------------------------
// Copropietarios: SELECT/DELETE/INSERT asociados a un cliente puntual.
// La columna real es "nombre_apellido" pero de cara al frontend (que ya
// esperaba {id, nombre, dni} desde la época de PHP) se expone como "nombre".
// ------------------------------------------------------------------
async function obtenerCopropietarios(env, clienteId) {
  const { results } = await env.DB.prepare(
    "SELECT id_copro AS id, nombre_apellido AS nombre, dni FROM copropietarios WHERE id_cliente = ?"
  )
    .bind(clienteId)
    .all();
  return results;
}

async function obtenerBulbos(env, clienteId) {
  const { results } = await env.DB.prepare(
    `SELECT id_bulbos AS id, ciclo, calibre1, calibre2, calibre3, calibre4, cornos, total
     FROM bulbos WHERE id_cliente = ? ORDER BY ciclo DESC`
  )
    .bind(clienteId)
    .all();
  return results;
}

// ------------------------------------------------------------------
// Crea o actualiza un cliente + reemplaza sus copropietarios (misma
// estrategia que tenía clientes.php: se borran todos y se insertan de
// nuevo, así no quedan duplicados al editar).
// ------------------------------------------------------------------
async function guardarCliente(env, datos, id) {
  const copropietarios = Array.isArray(datos.copropietarios) ? datos.copropietarios : [];
  if (copropietarios.length > MAX_COPROPIETARIOS) {
    return jsonResponse({ error: `Un cliente puede tener como máximo ${MAX_COPROPIETARIOS} copropietarios` }, 400);
  }

  const campos = {
    nombre: datos.nombre || "",
    sexo: datos.sexo || "M",
    dni: datos.dni || "",
    cuil: datos.cuil || "",
    fecha_nacimiento: datos.fechaNacimiento || null,
    telefono: datos.telefono || "",
    mail: datos.mail || "",
    fecha_alta: datos.fechaAlta || null,
    estado_civil: datos.estadoCivil || "",
    profesion: datos.profesion || "",
    direccion: datos.direccion || "",
    referente: datos.referente || "",
    // Nuevo campo: si no llega nada, siempre cae en "Rio Primero"
    sucursal_nombre: datos.sucursalNombre || "Rio Primero",
  };

  let clienteId = id;
  if (id) {
    await env.DB.prepare(
      `UPDATE clientes SET nombre=?, sexo=?, dni=?, cuil=?, fecha_nacimiento=?, telefono=?, mail=?,
       fecha_alta=?, estado_civil=?, profesion=?, direccion=?, referente=?, sucursal_nombre=?,
       actualizado_en=datetime('now') WHERE id=?`
    )
      .bind(
        campos.nombre, campos.sexo, campos.dni, campos.cuil, campos.fecha_nacimiento,
        campos.telefono, campos.mail, campos.fecha_alta, campos.estado_civil, campos.profesion,
        campos.direccion, campos.referente, campos.sucursal_nombre, id
      )
      .run();
  } else {
    const resultado = await env.DB.prepare(
      `INSERT INTO clientes (nombre, sexo, dni, cuil, fecha_nacimiento, telefono, mail, fecha_alta,
       estado_civil, profesion, direccion, referente, sucursal_nombre)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        campos.nombre, campos.sexo, campos.dni, campos.cuil, campos.fecha_nacimiento,
        campos.telefono, campos.mail, campos.fecha_alta, campos.estado_civil, campos.profesion,
        campos.direccion, campos.referente, campos.sucursal_nombre
      )
      .run();
    clienteId = resultado.meta.last_row_id;
  }

  // Se reemplazan los copropietarios existentes por los recibidos
  await env.DB.prepare("DELETE FROM copropietarios WHERE id_cliente = ?").bind(clienteId).run();
  for (const co of copropietarios) {
    if (co.nombre || co.dni) {
      await env.DB.prepare("INSERT INTO copropietarios (id_cliente, nombre_apellido, dni) VALUES (?, ?, ?)")
        .bind(clienteId, co.nombre || "", co.dni || "")
        .run();
    }
  }

  return jsonResponse({ ok: true, id: clienteId });
}

// ------------------------------------------------------------------
// Router de /api/clientes
// ------------------------------------------------------------------
async function manejarClientes(request, env, url) {
  const method = request.method;
  const idParam = url.searchParams.get("id");
  const id = idParam ? Number(idParam) : null;

  if (method === "GET") {
    if (id) {
      const cliente = await env.DB.prepare("SELECT * FROM clientes WHERE id = ?").bind(id).first();
      if (!cliente) return jsonResponse({ error: "Cliente no encontrado" }, 404);
      cliente.copropietarios = await obtenerCopropietarios(env, id);
      cliente.bulbos = await obtenerBulbos(env, id);
      return jsonResponse(cliente);
    }
    // Lista completa (el filtrado por texto/sexo/estado civil ya lo hace
    // el frontend en memoria, ver js/app.js:getClientesFiltrados)
    const { results } = await env.DB.prepare("SELECT * FROM clientes ORDER BY nombre ASC").all();

    // OPTIMIZACIÓN DE VELOCIDAD: antes acá había un "for" que hacía una
    // consulta a la base POR CADA cliente para traerle sus copropietarios
    // (si había 50 clientes, eran 50 consultas seguidas, una por una: el
    // clásico problema "N+1"). Eso era lo que hacía que la lista tardara
    // muchísimo. Ahora se trae TODOS los copropietarios en una única
    // consulta y se agrupan acá mismo en memoria por id_cliente, así
    // siempre son 2 consultas en total a la base, sin importar cuántos
    // clientes haya.
    const { results: todosCopropietarios } = await env.DB.prepare(
      "SELECT id_copro AS id, nombre_apellido AS nombre, dni, id_cliente FROM copropietarios"
    ).all();

    const copropietariosPorCliente = {};
    for (const co of todosCopropietarios) {
      if (!copropietariosPorCliente[co.id_cliente]) copropietariosPorCliente[co.id_cliente] = [];
      copropietariosPorCliente[co.id_cliente].push({ id: co.id, nombre: co.nombre, dni: co.dni });
    }
    for (const c of results) {
      c.copropietarios = copropietariosPorCliente[c.id] || [];
    }

    return jsonResponse(results);
  }

  if (method === "POST") {
    const datos = await request.json();
    return guardarCliente(env, datos, null);
  }

  if (method === "PUT") {
    if (!id) return jsonResponse({ error: "Falta el id" }, 400);
    const datos = await request.json();
    return guardarCliente(env, datos, id);
  }

  if (method === "DELETE") {
    if (!id) return jsonResponse({ error: "Falta el id" }, 400);
    await env.DB.prepare("DELETE FROM clientes WHERE id = ?").bind(id).run();
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: "Método no permitido" }, 405);
}

// ------------------------------------------------------------------
// Router de /api/bulbos (gestión de ciclos de bulbos de un cliente)
// ------------------------------------------------------------------
async function manejarBulbos(request, env, url) {
  const method = request.method;
  const idParam = url.searchParams.get("id");
  const id = idParam ? Number(idParam) : null;

  if (method === "GET") {
    const clienteIdParam = url.searchParams.get("clienteId");
    if (!clienteIdParam) return jsonResponse({ error: "Falta clienteId" }, 400);
    return jsonResponse(await obtenerBulbos(env, Number(clienteIdParam)));
  }

  if (method === "POST") {
    const d = await request.json();
    if (!d.idCliente || !d.ciclo) return jsonResponse({ error: "Faltan idCliente o ciclo" }, 400);
    const resultado = await env.DB.prepare(
      `INSERT INTO bulbos (id_cliente, ciclo, calibre1, calibre2, calibre3, calibre4, cornos)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(d.idCliente, d.ciclo, d.calibre1 || 0, d.calibre2 || 0, d.calibre3 || 0, d.calibre4 || 0, d.cornos || 0)
      .run();
    return jsonResponse({ ok: true, id: resultado.meta.last_row_id });
  }

  if (method === "PUT") {
    if (!id) return jsonResponse({ error: "Falta el id" }, 400);
    const d = await request.json();
    await env.DB.prepare(
      `UPDATE bulbos SET ciclo=?, calibre1=?, calibre2=?, calibre3=?, calibre4=?, cornos=? WHERE id_bulbos=?`
    )
      .bind(d.ciclo || "", d.calibre1 || 0, d.calibre2 || 0, d.calibre3 || 0, d.calibre4 || 0, d.cornos || 0, id)
      .run();
    return jsonResponse({ ok: true });
  }

  if (method === "DELETE") {
    if (!id) return jsonResponse({ error: "Falta el id" }, 400);
    await env.DB.prepare("DELETE FROM bulbos WHERE id_bulbos = ?").bind(id).run();
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: "Método no permitido" }, 405);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      // Preflight CORS: no necesita cuerpo, solo los encabezados
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/clientes") return await manejarClientes(request, env, url);
      if (url.pathname === "/api/bulbos") return await manejarBulbos(request, env, url);
      return jsonResponse({ error: "Ruta no encontrada" }, 404);
    } catch (err) {
      return jsonResponse({ error: err.message || "Error interno del servidor" }, 500);
    }
  },
};