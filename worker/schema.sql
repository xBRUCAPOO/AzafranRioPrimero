-- ============================================================
-- schema.sql
-- Base de datos para Cloudflare D1 (motor SQLite).
-- Se ejecuta UNA sola vez para crear la base, con:
--   wrangler d1 execute gestor-clientes-db --remote --file=./worker/schema.sql
-- (ver worker/README-DEPLOY.md para el paso a paso completo)
--
-- 3 TABLAS:
--   1) clientes       -> datos personales del cliente (antes "clientes")
--   2) bulbos         -> NUEVA. Un cliente puede tener varios registros,
--                        uno por cada ciclo/temporada (ej: "Ciclo 2025",
--                        "Ciclo 2026"), con los calibres de bulbos de esa
--                        temporada.
--   3) copropietarios -> hasta 3 por cliente (igual que antes)
--
-- NOTA DE NOMBRES: se pidieron los campos "Nombre y Apellido" (en
-- copropietarios) e "ID_Corpro" / "ID_bulbos" / "ID_Cliente". SQL no admite
-- espacios ni mayúsculas prolijamente, así que se usan los equivalentes en
-- snake_case (nombre_apellido, id_copro, id_bulbos, id_cliente): son
-- exactamente los mismos datos, solo el nombre de columna válido para SQL.
-- ============================================================

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------------
-- 1) CLIENTES
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre            TEXT NOT NULL,
  sexo              TEXT NOT NULL CHECK (sexo IN ('M','F')),
  dni               TEXT NOT NULL DEFAULT '',
  cuil              TEXT NOT NULL DEFAULT '',
  fecha_nacimiento  TEXT,                          -- 'YYYY-MM-DD' o NULL
  telefono          TEXT NOT NULL DEFAULT '',
  mail              TEXT NOT NULL DEFAULT '',
  fecha_alta        TEXT,                          -- 'YYYY-MM-DD' o NULL
  estado_civil      TEXT NOT NULL DEFAULT '',
  profesion         TEXT NOT NULL DEFAULT '',
  direccion         TEXT NOT NULL DEFAULT '',
  referente         TEXT NOT NULL DEFAULT '',
  -- Nuevo campo pedido: por ahora siempre es "Rio Primero", pero queda
  -- como columna editable por si en el futuro se suma otra sucursal.
  sucursal_nombre   TEXT NOT NULL DEFAULT 'Rio Primero',
  creado_en         TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------------
-- 2) BULBOS (nueva tabla, 1 fila por ciclo/temporada de un cliente)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bulbos (
  id_bulbos   INTEGER PRIMARY KEY AUTOINCREMENT,
  id_cliente  INTEGER NOT NULL,
  ciclo       TEXT NOT NULL,                       -- Ej: "Ciclo 2025"
  calibre1    INTEGER NOT NULL DEFAULT 0,
  calibre2    INTEGER NOT NULL DEFAULT 0,
  calibre3    INTEGER NOT NULL DEFAULT 0,
  calibre4    INTEGER NOT NULL DEFAULT 0,
  cornos      INTEGER NOT NULL DEFAULT 0,
  -- Columna calculada por la propia base de datos: se recalcula sola en
  -- cada INSERT/UPDATE, así nunca puede quedar desincronizada del resto.
  total       INTEGER GENERATED ALWAYS AS (calibre1 + calibre2 + calibre3 + calibre4 + cornos) STORED,
  creado_en   TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (id_cliente) REFERENCES clientes(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------------
-- 3) COPROPIETARIOS (máximo 3 por cliente, validado en el Worker)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS copropietarios (
  id_copro        INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre_apellido TEXT NOT NULL,
  dni             TEXT NOT NULL DEFAULT '',
  id_cliente      INTEGER NOT NULL,
  FOREIGN KEY (id_cliente) REFERENCES clientes(id) ON DELETE CASCADE
);

-- Índices para que los listados por cliente sean rápidos
CREATE INDEX IF NOT EXISTS idx_bulbos_cliente ON bulbos(id_cliente);
CREATE INDEX IF NOT EXISTS idx_copropietarios_cliente ON copropietarios(id_cliente);

-- ============================================================
-- Datos semilla: los mismos 19 clientes reales que ya estaban cargados
-- (ver CLIENTES.xlsx). El resto de los campos quedan vacíos hasta
-- completarse desde el formulario.
-- ============================================================
INSERT INTO clientes (nombre, sexo, telefono, fecha_alta) VALUES
('María Isabel Pisoni', 'F', '3515446543', '2025-11-12'),
('Paola Gabriela Cañarte', 'F', '3512062422', '2025-11-13'),
('Federico Adolfo Cañarte', 'M', '3514036554', '2025-11-13'),
('Eduardo Alberto Lizzul', 'M', '3541577961', '2025-11-13'),
('Laura Carolina Cañarte', 'F', '3518105514', '2025-12-23'),
('Hugo Benigno Arce', 'M', '3516256382', '2026-02-11'),
('Lucia Macarena Navarro Cañarte', 'F', '1157076772', '2026-03-04'),
('Agustín Novoa', 'M', '3543589447', '2026-03-02'),
('Fernando Marcelo Chávez', 'M', '3516716655', '2026-03-07'),
('Bernardo Oscar Arias', 'M', '3512232710', '2026-03-09'),
('Magdalena Brigo', 'F', '3515096181', '2026-03-09'),
('Matías Cañarte Kuseman', 'M', '3514036554', '2026-03-18'),
('Luciana Mulazzi', 'F', '3515495058', '2026-03-26'),
('Alina Cañarte', 'F', '3515311157', '2026-04-09'),
('Beatriz del Valle Arias', 'F', '', NULL),
('Carola Novoa', 'F', '3525537006', '2026-04-18'),
('Maria Laura Sanchez', 'F', '3513746500', '2026-05-02'),
('María Soledad Koljatic', 'F', '3516168303', '2026-05-19'),
('Daniel Mario Navarro Pérez', 'M', '1133088155', '2026-07-07');

-- Ejemplo real de copropietario tomado del Excel ("Agustin y Carola Novoa")
INSERT INTO copropietarios (id_cliente, nombre_apellido)
SELECT id, 'Carola Novoa' FROM clientes WHERE nombre = 'Agustín Novoa';
