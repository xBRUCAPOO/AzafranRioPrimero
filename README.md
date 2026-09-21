# Gestor de Clientes — Azafrán Río Primero

> **Nota de esta versión (v2.0.0):** se reescribió por completo el backend,
> que pasó de PHP + MySQL (Clever Cloud) a un **Cloudflare Worker + D1**.
> También se sumó una tercera tabla (**Bulbos**) y se reorganizaron las
> carpetas para poder desplegar el frontend en Cloudflare Pages. Si venías
> de la versión anterior, este README reemplaza al que había antes.

## Índice

1. [¿Qué es este proyecto?](#qué-es-este-proyecto)
2. [Stack tecnológico](#stack-tecnológico)
3. [Estructura de carpetas](#estructura-de-carpetas)
4. [Arquitectura general](#arquitectura-general)
5. [Base de datos (3 tablas)](#base-de-datos-3-tablas)
6. [API (Cloudflare Worker)](#api-cloudflare-worker)
7. [Las páginas, una por una](#las-páginas-una-por-una)
8. [Componentes propios reutilizables](#componentes-propios-reutilizables)
9. [Modo demo (sin servidor)](#modo-demo-sin-servidor)
10. [Cómo correr el proyecto en local](#cómo-correr-el-proyecto-en-local)
11. [Despliegue en producción](#despliegue-en-producción)
12. [Convenciones de código](#convenciones-de-código)
13. [Historial de cambios de esta versión](#historial-de-cambios-de-esta-versión)
14. [Limitaciones conocidas y posibles mejoras futuras](#limitaciones-conocidas-y-posibles-mejoras-futuras)

## ¿Qué es este proyecto?

Un gestor de clientes a medida para Azafrán Río Primero: alta, edición,
baja, búsqueda y filtrado de clientes, con sus copropietarios (hasta 3 por
cliente) y ahora también sus **ciclos de Bulbos** por temporada. Permite
exportar una selección de clientes a una planilla Excel (`.xlsx`) y lleva
un historial local de movimientos.

## Stack tecnológico

- **Frontend**: HTML + CSS + JavaScript vanilla (sin frameworks), pensado
  para desplegarse como sitio estático en **Cloudflare Pages**.
- **Backend**: **Cloudflare Worker** (JavaScript, sin frameworks) en
  `worker/src/index.js`, expuesto como API REST.
- **Base de datos**: **Cloudflare D1** (SQLite serverless), definida en
  `worker/schema.sql`.
- **Exportación a Excel**: [ExcelJS](https://github.com/exceljs/exceljs)
  (cargado desde un CDN), 100% en el navegador.
- **Tipografías**: Google Fonts — Raleway (títulos) y Nunito Sans (texto).
- **Íconos**: Google Fonts — Material Symbols Outlined.

## Estructura de carpetas

```
AzafranRioPrimero/
├── index.html              ← página principal (listado). Tiene que
│                              quedar en la RAÍZ para que Cloudflare
│                              Pages / GitHub la detecten como inicio.
├── paginas/                ← el resto de las páginas HTML
│   ├── perfil.html
│   ├── historial.html
│   └── exportar.html
├── css/
│   └── styles.css
├── js/
│   ├── config.js            ← URL del Worker (único lugar a editar)
│   ├── api-clientes.js
│   ├── app.js
│   ├── bulbos.js             ← NUEVO: ciclos de Bulbos
│   ├── custom-date.js
│   ├── custom-select.js
│   ├── db-status.js
│   ├── exportar.js
│   ├── historial.js
│   ├── perfil.js
│   └── theme-switch.js
├── worker/                 ← backend, se despliega APARTE (no es parte
│   │                          del sitio estático)
│   ├── src/index.js
│   ├── wrangler.toml
│   ├── schema.sql
│   └── README-DEPLOY.md     ← paso a paso del backend
└── CLIENTES.xlsx            ← datos originales de referencia
```

**Por qué se movieron los HTML:** `index.html` tiene que estar en la raíz
del repositorio para que Cloudflare Pages (o GitHub Pages, si algún día
se usa) lo detecte automáticamente como punto de entrada. El resto de las
páginas se movió a `paginas/` para que la raíz quede prolija y sea
evidente cuál es el archivo principal.

## Arquitectura general

```
┌─────────────────────────┐        HTTPS         ┌──────────────────────────┐
│  Cloudflare Pages        │  ───────────────►    │  Cloudflare Worker        │
│  (index.html, paginas/,  │  ◄───────────────    │  worker/src/index.js      │
│  css/, js/)              │        JSON           │  (API REST)               │
└─────────────────────────┘                       └──────────┬───────────────┘
                                                              │
                                                              ▼
                                                   ┌──────────────────────────┐
                                                   │  Cloudflare D1 (SQLite)   │
                                                   │  clientes / bulbos /      │
                                                   │  copropietarios           │
                                                   └──────────────────────────┘
```

El frontend nunca toca la base de datos directamente: todo pasa por el
Worker, que es el único que tiene el binding a D1.

## Base de datos (3 tablas)

Ver el detalle completo en `worker/schema.sql`. Resumen:

### 1) `clientes`
Los datos personales de siempre (nombre, sexo, DNI, CUIL, fechas,
contacto, estado civil, profesión, dirección, referente) más el campo
nuevo **`sucursal_nombre`** (por ahora siempre `"Rio Primero"`, pero
editable por si en el futuro se suma otra sucursal).

### 2) `bulbos` (NUEVA)
Un cliente puede tener **varios registros**, uno por cada ciclo/temporada
(ej. "Ciclo 2025", "Ciclo 2026"). Cada uno tiene:

| Columna | Descripción |
|---|---|
| `id_bulbos` | ID autoincremental |
| `id_cliente` | A qué cliente pertenece |
| `ciclo` | Ej: "Ciclo 2026" |
| `calibre1` … `calibre4` | Los 4 calibres |
| `cornos` | Cantidad de cornos |
| `total` | **Se calcula solo** (columna generada por la base de datos: `calibre1+calibre2+calibre3+calibre4+cornos`), nunca se carga a mano |

Se gestionan desde la página de perfil de cada cliente (`js/bulbos.js`).

### 3) `copropietarios`
Hasta 3 por cliente (`id_copro`, `nombre_apellido`, `dni`, `id_cliente`).
De cara al frontend se siguen viendo como `{id, nombre, dni}` (el Worker
hace la traducción), así que no hubo que tocar el código que ya mostraba
copropietarios.

Las 3 tablas usan `AUTOINCREMENT` en su clave primaria y `FOREIGN KEY ...
ON DELETE CASCADE`: al borrar un cliente, se borran solos sus
copropietarios y sus ciclos de bulbos.

## API (Cloudflare Worker)

Base: la URL que imprime `wrangler deploy` (se configura en `js/config.js`).

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/clientes` | Lista todos los clientes (con copropietarios) |
| GET | `/api/clientes?id=5` | Un cliente, con copropietarios y bulbos |
| POST | `/api/clientes` | Crea un cliente |
| PUT | `/api/clientes?id=5` | Actualiza un cliente |
| DELETE | `/api/clientes?id=5` | Elimina un cliente (cascada) |
| GET | `/api/bulbos?clienteId=5` | Ciclos de bulbos de ese cliente |
| POST | `/api/bulbos` | Crea un ciclo |
| PUT | `/api/bulbos?id=3` | Actualiza un ciclo |
| DELETE | `/api/bulbos?id=3` | Elimina un ciclo |

Ver el paso a paso completo del despliegue en `worker/README-DEPLOY.md`.

## Las páginas, una por una

- **`index.html` + `js/app.js`**: listado, búsqueda, filtros, alta de
  clientes y el modo "Generar Planilla" (selección múltiple).
- **`paginas/perfil.html` + `js/perfil.js` + `js/bulbos.js`**: detalle de
  un cliente, edición, baja, y ahora también sus ciclos de Bulbos.
- **`paginas/historial.html` + `js/historial.js`**: registro local
  (`localStorage`) de altas/ediciones/bajas.
- **`paginas/exportar.html` + `js/exportar.js`**: vista previa y
  exportación a `.xlsx` de los clientes elegidos.

## Componentes propios reutilizables

### `custom-select.js` → reemplaza `<select>`
Desplegable propio con ícono por opción (estado civil, filtros, etc.).

### `custom-date.js` → reemplaza `<input type="date">`
Desde esta versión, el calendario emergente **solo se abre tocando el
ícono** (`.custom-date__icon-btn`); la fecha también se puede **escribir
directamente con el teclado** en formato `dd/mm/aaaa` (las barras "/" se
agregan solas). El valor real sigue viviendo en un `<input type="date">`
oculto, así el resto del código no cambió.

### `db-status.js` → indicador de conexión (footer)
Chequea que `${API_BASE}/api/clientes` devuelva JSON válido (no solo que
responda 200), para detectar bien cuándo se está en modo demo.

## Modo demo (sin servidor)

Si el Worker no responde, la app sigue funcionando con datos de prueba en
`sessionStorage` (ver `MOCK_CLIENTES` en `js/api-clientes.js`), para poder
probar toda la interfaz sin desplegar nada.

## Cómo correr el proyecto en local

El frontend es 100% estático: alcanza con abrirlo con cualquier servidor
liviano (por ejemplo `npx serve .` o la extensión "Live Server" de VS
Code) parado en la raíz del proyecto. Sin el Worker desplegado, la app
entra sola en modo demo.

Para probar contra el backend real, primero hay que desplegar el Worker
(ver siguiente sección) y pegar su URL en `js/config.js`.

## Despliegue en producción

### 1) Backend: Cloudflare Worker + D1
Ver el paso a paso completo en **`worker/README-DEPLOY.md`**. En resumen:
crear la base D1, cargar `worker/schema.sql`, desplegar con
`wrangler deploy`, y copiar la URL resultante en `js/config.js`.

### 2) Frontend: Cloudflare Pages
1. Subir este proyecto a un repositorio de GitHub (con `index.html` en la
   raíz, tal como está armado acá).
2. En el panel de Cloudflare, crear un proyecto de **Pages** conectado a
   ese repositorio.
3. Como es un sitio estático (sin build), dejar el "framework preset" en
   **None** y el "build output directory" en `/` (la raíz).
4. Desplegar. Cloudflare Pages sirve `index.html`, `css/`, `js/` y
   `paginas/` automáticamente; la carpeta `worker/` no forma parte del
   sitio (es el otro despliegue, aparte, con Wrangler).

## Convenciones de código

- Comentarios en español, explicando el "por qué" de cada decisión, no
  solo el "qué".
- Todos los colores son variables CSS (`:root` en `css/styles.css`).
- Todas las tipografías son variables CSS (`--font-heading`,
  `--font-body`), cargadas desde Google Fonts.
- Todos los íconos son Material Symbols Outlined (Google Fonts Icons).
- Sin frameworks ni librerías de build: JavaScript vanilla en el
  frontend, y el Worker también en JavaScript plano (sin Hono ni otro
  router).

## Historial de cambios de esta versión

- **Backend**: reescrito de PHP + MySQL (Clever Cloud) a Cloudflare
  Worker + D1.
- **Base de datos**: se agregó la tabla `bulbos` y el campo
  `sucursal_nombre` en `clientes`.
- **Bug corregido**: en modo demo, las fechas y el estado civil no se
  guardaban correctamente (quedaban con nombres de campo en camelCase en
  vez de snake_case). Ver el comentario en
  `mapearDatosClienteParaGuardar()` en `js/api-clientes.js`.
- **Selector de fecha**: ahora el calendario solo abre con el ícono; la
  fecha se puede tipear a mano.
- **Checkboxes de selección**: rediseñados con la estética de la página.
- **Tabla de exportación**: líneas divisorias entre columnas y texto
  "Sin datos" en gris para las celdas vacías.
- **Botón "Información del proyecto"**: ahora es un botón con fondo
  oscuro en vez de un link de texto suelto.
- **Barra de selección de clientes**: ahora mide lo mismo que la lista de
  clientes, y avisa con un error si se intenta continuar sin elegir a
  nadie.
- **Estructura de archivos**: `perfil.html`, `historial.html` y
  `exportar.html` se movieron a `paginas/`.

## Limitaciones conocidas y posibles mejoras futuras

- El historial de movimientos sigue siendo local (`localStorage`), no
  compartido entre computadoras. Para un historial "oficial" habría que
  sumar una tabla más en D1 y un endpoint en el Worker.
- El campo Sucursal es de texto libre: si en algún momento hay más de una
  sucursal, convendría pasarlo a un desplegable con una lista fija.
- El Worker no tiene autenticación: cualquiera con la URL puede leer o
  escribir clientes. Si esto pasa a ser un problema, se puede sumar un
  token simple (`Authorization` header) validado al principio de
  `worker/src/index.js`.
