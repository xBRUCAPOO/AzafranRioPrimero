# Gestor de Clientes — Azafrán Río Primero

> Sistema web de gestión de clientes y copropietarios, con exportación a Excel, hecho a medida en PHP/MySQL y JavaScript puro (sin frameworks).

Este documento está pensado para que **cualquier programador que no participó del desarrollo original** pueda entender, mantener y ampliar el proyecto sin tener que leer todo el código línea por línea primero.

---

## Índice

1. [¿Qué es este proyecto?](#qué-es-este-proyecto)
2. [Stack tecnológico](#stack-tecnológico)
3. [Estructura de carpetas](#estructura-de-carpetas)
4. [Cómo está armada la aplicación (arquitectura general)](#cómo-está-armada-la-aplicación-arquitectura-general)
5. [Las 4 páginas, una por una](#las-4-páginas-una-por-una)
6. [Componentes propios reutilizables](#componentes-propios-reutilizables)
7. [Base de datos](#base-de-datos)
8. [API REST (backend PHP)](#api-rest-backend-php)
9. [Modo demo (sin servidor)](#modo-demo-sin-servidor)
10. [Temas claro/oscuro](#temas-claro-oscuro)
11. [Historial de movimientos](#historial-de-movimientos)
12. [Exportar clientes a Excel](#exportar-clientes-a-excel)
13. [Sistema de diseño (colores, tipografías, íconos)](#sistema-de-diseño-colores-tipografías-íconos)
14. [Cómo correr el proyecto en local (XAMPP)](#cómo-correr-el-proyecto-en-local-xampp)
15. [Despliegue en producción](#despliegue-en-producción)
16. [Convenciones de código](#convenciones-de-código)
17. [Errores comunes / cosas para tener en cuenta](#errores-comunes--cosas-para-tener-en-cuenta)
18. [Limitaciones conocidas y posibles mejoras futuras](#limitaciones-conocidas-y-posibles-mejoras-futuras)

---

## ¿Qué es este proyecto?

**Gestor de Clientes** es una aplicación web interna para administrar la cartera de clientes de un estudio/inmobiliaria (los datos de ejemplo son de un contexto de Río Primero, Córdoba, Argentina). Permite:

- Dar de alta, editar, ver y eliminar clientes, cada uno con sus datos personales (nombre, sexo, DNI, CUIL, fecha de nacimiento, teléfono, mail, fecha de alta, estado civil, profesión, dirección y referente).
- Asociarle a cada cliente hasta **3 copropietarios**.
- Buscar y filtrar la lista de clientes por texto, sexo, estado civil, profesión, referente y rango de fecha de alta.
- Ver un **historial** de altas, ediciones y bajas hecho en ese navegador.
- Elegir varios clientes a la vez y **generar una planilla de Excel (.xlsx)** con sus datos, para compartir o imprimir.

El objetivo del proyecto es reemplazar una planilla de Excel manual (`CLIENTES.xlsx`, incluida en el repo como referencia histórica) por un sistema con base de datos real, validaciones, historial y una interfaz prolija, sin perder la posibilidad de exportar a Excel cuando hace falta.

No es un sistema multiusuario con login: no tiene autenticación. Está pensado para uso interno, de confianza, en una red controlada.

---

## Stack tecnológico

| Capa | Tecnología | Notas |
|---|---|---|
| Frontend | **HTML + CSS + JavaScript puro** | Sin frameworks (no usa React, Vue, jQuery, etc.), a propósito, para que cualquiera pueda tocarlo sin instalar nada ni compilar nada. |
| Tipografías | Google Fonts: **Raleway** (títulos) y **Nunito Sans** (texto) | Cargadas por `<link>`, no hay que instalar nada. |
| Íconos | Google Fonts: **Material Symbols Outlined** | Se usan por nombre, ej. `<span class="material-symbols-outlined">person</span>`. |
| Backend | **PHP + PDO** | Un único endpoint REST (`api/clientes.php`) para todo el CRUD de clientes. |
| Base de datos | **MySQL** | Ver [schema.sql](./schema.sql). |
| Exportar a Excel | **[ExcelJS](https://github.com/exceljs/exceljs)**, cargado desde CDN (cdnjs) | Solo en `exportar.html`, arma el `.xlsx` directo en el navegador. |
| Hosting (producción) | **Clever Cloud** (MySQL + FTP) | Alternativa documentada: **InfinityFree**. |
| Hosting (desarrollo local) | **XAMPP** | Apache + PHP + MySQL local. |

No hay `package.json`, ni `node_modules`, ni build step. Los archivos `.html`, `.css` y `.js` se sirven tal cual están.

---

## Estructura de carpetas

```
AzafranRioPrimero/
├── index.html            → Listado de clientes (pantalla principal)
├── perfil.html            → Ficha de un cliente (ver / editar / eliminar)
├── historial.html         → Historial de altas/ediciones/bajas
├── exportar.html          → Vista previa + descarga de la planilla .xlsx
├── config.php             → Credenciales de conexión a MySQL
├── schema.sql             → Script para crear la base de datos desde cero
├── README.md              → Este archivo
├── CLIENTES.xlsx          → Planilla original (referencia histórica, ya no se usa en la app)
├── api/
│   └── clientes.php       → API REST del CRUD de clientes + copropietarios
├── css/
│   └── styles.css         → TODO el CSS de la aplicación (un solo archivo)
└── js/
    ├── api-clientes.js    → Llamadas a la API, modo demo, toasts, historial
    ├── app.js             → Lógica de index.html
    ├── perfil.js           → Lógica de perfil.html
    ├── historial.js        → Lógica de historial.html
    ├── exportar.js         → Lógica de exportar.html
    ├── theme-switch.js     → Tema claro/oscuro (compartido en las 4 páginas)
    ├── db-status.js        → Indicador de conexión a la base de datos (footer)
    ├── custom-select.js    → Desplegables propios (con íconos), reemplaza <select>
    └── custom-date.js      → Calendario propio, reemplaza <input type="date">
```

**Regla importante:** cada página HTML carga sus `<script>` en un orden específico, porque unos dependen de otros. Por ejemplo, `app.js` usa funciones definidas en `api-clientes.js`, `custom-select.js` y `custom-date.js`, así que esos tres van SIEMPRE antes que `app.js` en el `<body>`. Si agregás un script nuevo, respetá ese orden o vas a tener errores de "función no definida" en la consola.

---

## Cómo está armada la aplicación (arquitectura general)

Es una **aplicación multi-página clásica** (no es una SPA): cada acción importante (ver un cliente, ver el historial, exportar) navega a un archivo `.html` distinto con `window.location.href`. No hay router de JavaScript.

El patrón que se repite en todo el proyecto es:

1. **El HTML** define la estructura y los `id` de cada elemento.
2. **Un archivo JS por página** (`app.js`, `perfil.js`, `historial.js`, `exportar.js`) hace `document.getElementById(...)` de todo lo que necesita, agrega los `addEventListener` y arranca pidiendo datos (a la API o a `localStorage`/`sessionStorage`).
3. **Archivos JS compartidos** (`api-clientes.js`, `theme-switch.js`, `db-status.js`, `custom-select.js`, `custom-date.js`) resuelven una sola cosa cada uno, y se cargan en varias páginas.

No hay ningún framework de componentes: "componente reutilizable" acá significa "un archivo JS + una convención de HTML" (ver la sección de [componentes propios](#componentes-propios-reutilizables) más abajo).

### Flujo de datos de un cliente

```
MySQL (tabla clientes + copropietarios)
   │
   ▼
api/clientes.php  (PHP + PDO, responde JSON)
   │
   ▼
js/api-clientes.js  →  apiListar() / apiObtenerUno() / apiCrear() / apiActualizar() / apiEliminar()
   │
   ▼
app.js (index.html) o perfil.js (perfil.html)
   │
   ▼
Se pinta en el DOM (renderLista() / renderPerfil())
```

Si en cualquier punto de esa cadena la API no responde (no hay servidor PHP corriendo, no hay conexión a MySQL, etc.), el sistema cae automáticamente al **modo demo** (ver más abajo) para que la interfaz se pueda seguir probando igual.

---

## Las 4 páginas, una por una

### `index.html` + `js/app.js`
Listado de todos los clientes. Desde acá se puede:
- Buscar por nombre, DNI o mail (`#searchInput`).
- Filtrar por sexo (control segmentado), estado civil, profesión, referente y rango de fecha de alta (panel `#filterPanel`).
- Dar de alta un cliente nuevo (botón "Registrar nuevo cliente" → modal `#clientModal`).
- Activar el **modo selección** ("Generar Planilla"): aparece un checkbox en cada tarjeta, se eligen uno o varios clientes, y "Continuar" guarda esa selección en `sessionStorage` (clave `gestorClientes_exportSeleccion`) y navega a `exportar.html`.
- Ir al historial (botón "Historial").
- Hacer clic en un cliente para ir a su ficha (`perfil.html?id=<id>`).

### `perfil.html` + `js/perfil.js`
Ficha de un cliente puntual, leído por `?id=` en la URL. Muestra todos sus datos (con ícono según el tipo de dato, edad calculada al lado de la fecha de nacimiento, y los campos vacíos pintados en gris), y sus copropietarios (o "Sin copropietarios" en rojo si no tiene ninguno). Desde acá se puede:
- Copiar un dato puntual o el perfil completo al portapapeles.
- Editar (mismo formulario que "Nuevo cliente", pero pre-cargado).
- Eliminar, con doble confirmación (una tarjeta propia de la página + el `confirm()` nativo del navegador).

### `historial.html` + `js/historial.js`
Lista de movimientos (altas, ediciones, bajas) guardada en **`localStorage`** del navegador (clave `gestorClientes_historial`, hasta 200 movimientos). **No es un historial de la base de datos**: es local a cada computadora/navegador. Se puede buscar por nombre de cliente y filtrar por tipo de movimiento y rango de fechas.

### `exportar.html` + `js/exportar.js`
Recibe los clientes elegidos en `index.html` (vía `sessionStorage`), muestra una vista previa en tabla, y genera el archivo `.xlsx` final con ExcelJS al tocar "Exportar a .xlsx" (encabezado con el morado de la marca, columnas anchas, fila de encabezado congelada). Si se entra a esta página sin haber elegido ningún cliente, muestra un aviso en vez de una tabla vacía.

---

## Componentes propios reutilizables

Como el proyecto no usa ningún framework, estos "componentes" son simplemente **un archivo JS + una convención de HTML**. Todos siguen el MISMO patrón de diseño, así que entendiendo uno se entienden los tres:

> **Patrón:** el control real (el que guarda el valor) es un `<input>` OCULTO con el mismo `id` que tendría un `<input>`/`<select>` nativo. Encima se dibuja una capa visual propia (botón + panel flotante). Cuando el usuario elige algo, se actualiza el input oculto Y se dispara un evento `"change"` a mano, para que el resto del código (que escucha `.addEventListener("change", ...)` o lee `.value`) siga funcionando exactamente igual que si fuera un control nativo.

### `custom-select.js` → reemplaza `<select>`
Se usa en "Estado civil" (formulario y filtro) y "Tipo de movimiento" (historial). Cada opción tiene su propio ícono y la elegida se resalta en el morado de la marca (los navegadores no dejan estilizar así un `<select>` nativo).

```html
<div class="custom-select">
  <button type="button" class="custom-select__trigger">...</button>
  <ul class="custom-select__options hidden">
    <li class="custom-select__option" data-value="Soltero/a">
      <span class="material-symbols-outlined">person</span> Soltero/a
    </li>
    ...
  </ul>
  <input type="hidden" id="f_estadoCivil" value="" />
</div>
```

Funciones clave (objeto global `CustomSelect`):
- `CustomSelect.init(container)`: engancha los clics de un desplegable puntual. Hay que volver a llamarla si se regeneran las opciones a mano (ver `refreshEstadoCivilOptions()` en `app.js`).
- `CustomSelect.setValueById(id, valor)`: elige un valor a mano (por ejemplo, al abrir el modal de edición con los datos ya cargados) y dispara `"change"`.

**Bug ya corregido, para tener en cuenta:** `.textContent` de un `<li>` trae también el nombre interno del ícono (ej. `"family_restroom"`), no solo la etiqueta visible. Por eso `setValue()` saca una copia del `<li>` sin el `<span class="material-symbols-outlined">` antes de leer el texto. Si se agrega lógica nueva que lea el texto de una opción, hay que tener el mismo cuidado.

### `custom-date.js` → reemplaza `<input type="date">`
El calendario emergente nativo de `<input type="date">` lo dibuja el sistema operativo y no se le puede cambiar el estilo. Este componente arma un calendario propio (mes/año, grilla de días en español, botones "Borrar"/"Hoy").

Funciones clave (objeto global `CustomDate`):
- `CustomDate.setValueById(id, "YYYY-MM-DD")`: pone una fecha a mano y dispara `"change"`.
- `CustomDate.syncById(id)`: solo actualiza el texto visible (dd/mm/aaaa) según el valor actual del input oculto, SIN disparar `"change"`. Se usa después de un `form.reset()`, que ya cambió el valor por su cuenta.

### `db-status.js` → indicador de conexión (footer)
Hace un `fetch` liviano a `api/clientes.php` al cargar cada página y pinta el ícono/texto del footer en verde ("Base de datos conectada") o rojo ("Sin conexión"). **Importante:** no alcanza con mirar si el `fetch` devolvió `200 OK`, porque si no hay ningún servidor PHP corriendo (por ejemplo, se abrió con un servidor estático), la petición puede devolver `200` igual con el código fuente del `.php` como texto plano. Por eso el chequeo real es que la respuesta se pueda parsear como JSON (`await res.json()`).

---

## Base de datos

Ver [`schema.sql`](./schema.sql) para el script completo. Dos tablas:

**`clientes`**

| Columna | Tipo | Notas |
|---|---|---|
| `id` | INT, autoincremental | |
| `nombre` | VARCHAR(150) | Obligatorio |
| `sexo` | ENUM('M','F') | Obligatorio |
| `dni`, `cuil` | VARCHAR | |
| `fecha_nacimiento`, `fecha_alta` | DATE | Pueden ser `NULL` |
| `telefono`, `mail` | VARCHAR | |
| `estado_civil` | VARCHAR(40) | Texto libre en la base, pero el frontend solo permite: `Soltero/a`, `Casado/a`, `Divorciado/a`, `Viudo/a`, `Unión convivencial` |
| `profesion`, `direccion`, `referente` | VARCHAR | |
| `creado_en`, `actualizado_en` | TIMESTAMP | Automáticos |

**`copropietarios`**

| Columna | Tipo | Notas |
|---|---|---|
| `id` | INT, autoincremental | |
| `cliente_id` | INT | `FOREIGN KEY` a `clientes.id`, `ON DELETE CASCADE` (si se borra un cliente, se borran solos sus copropietarios) |
| `nombre`, `dni` | VARCHAR | |

`schema.sql` incluye un **trigger** (`trg_max_copropietarios`) que impide insertar un 4to copropietario directamente en MySQL. **Ojo:** los triggers **no están permitidos en hosting compartido tipo InfinityFree**. Si el día de mañana se migra a un hosting sin triggers, el límite de 3 copropietarios queda dependiendo ÚNICAMENTE de la validación que ya existe en `api/clientes.php` (`guardarCliente()`, chequea `count($data['copropietarios']) > 3`) y en el frontend (`MAX_COOWNERS = 3` en `app.js`/`perfil.js`). Si se toca ese límite, hay que actualizarlo en los 3 lugares.

---

## API REST (backend PHP)

Un solo archivo, `api/clientes.php`, con estos endpoints (todo en JSON):

| Método | URL | Qué hace |
|---|---|---|
| `GET` | `api/clientes.php` | Lista todos los clientes (admite `?q=`, `?sexo=`, `?estadoCivil=` para filtrar del lado del servidor) |
| `GET` | `api/clientes.php?id=1` | Un cliente puntual, con sus copropietarios |
| `POST` | `api/clientes.php` (body JSON) | Crea un cliente nuevo |
| `PUT` | `api/clientes.php?id=1` (body JSON) | Actualiza un cliente existente |
| `DELETE` | `api/clientes.php?id=1` | Elimina un cliente (y sus copropietarios, por `ON DELETE CASCADE`) |

`config.php` arma la conexión PDO leyendo variables de entorno (`MYSQL_ADDON_*`, que inyecta Clever Cloud automáticamente), con valores de respaldo para XAMPP local (`localhost` / usuario `root` / sin contraseña / base `gestor_clientes`).

> **El frontend nunca filtra directo contra la base**: hoy en día `app.js` trae TODOS los clientes con `GET api/clientes.php` (sin parámetros) y filtra en el navegador (`getClientesFiltrados()`). Los parámetros `?q=`/`?sexo=`/`?estadoCivil=` del backend existen pero no se usan desde el frontend actual — quedaron ahí por si en el futuro la cantidad de clientes crece tanto que conviene filtrar del lado del servidor en vez de traer todo.

---

## Modo demo (sin servidor)

Si `apiListar()`/`apiObtenerUno()` no logran hablar con `api/clientes.php` (porque no hay servidor PHP corriendo, o la conexión a MySQL falla), el frontend activa automáticamente el **modo demo** (`modoDemo = true` en `js/api-clientes.js`):

- Se usan 2 clientes de prueba fijos (`MOCK_CLIENTES`: "Hombre Prueba" y "Mujer Prueba", ids `9001`/`9002`), guardados en `sessionStorage` (clave `gestorClientes_demoData`) para que los cambios (altas/ediciones/bajas de prueba) se mantengan mientras dure esa pestaña.
- Se muestra un toast avisando "Sin conexión al servidor: mostrando datos de prueba."
- El indicador del footer (`db-status.js`) se pone en rojo.

Esto permite tocar y mostrar TODA la interfaz (agregar, editar, filtrar, exportar) sin necesidad de tener MySQL corriendo, ideal para demos o para retocar el diseño sin depender del backend.

---

## Temas claro/oscuro

El tema elegido se guarda en `localStorage` (clave `gestorClientes_tema`, valores `"light"`/`"dark"`) y se aplica poniendo el atributo `data-theme` en el `<html>`. Todo el CSS de colores depende de variables (`--color-bg`, `--color-text-primary`, etc.) que cambian de valor según ese atributo (ver `:root` y `html[data-theme='dark']` en `css/styles.css`).

**Importante — anti-flash (FOUC):** cada página tiene un `<script>` bloqueante al principio del `<head>` (antes de cargar el CSS) que lee `localStorage` y aplica el `data-theme` correcto ANTES de que el navegador pinte la página. Si no estuviera eso, la página arrancaría siempre en claro (por el `data-theme="light"` que está hardcodeado en el `<html>` por si JavaScript estuviera desactivado) y recién pasaría a oscuro un instante después, generando un flash molesto. **Si agregás una página nueva, copiá ese mismo bloque de script al principio del `<head>`.**

El interruptor visual (switch de la tuerca de ajustes) lo maneja `theme-switch.js`, compartido en las 4 páginas. Ahí mismo, en el panel de ajustes, también vive el link **"Información del proyecto"**, que abre este mismo README en GitHub en una pestaña nueva.

---

## Historial de movimientos

Cada alta/edición/baja exitosa llama a `registrarHistorial(accion, nombreCliente)` (en `api-clientes.js`), que agrega una entrada a un array en `localStorage` (clave `gestorClientes_historial`, tope de 200 entradas, se van descartando las más viejas). `historial.js` lee esa misma clave y la pinta con búsqueda y filtros.

Como está aclarado en el propio código: esto es un historial **del navegador**, no de la base de datos. Si en el futuro se necesita un historial "oficial" compartido entre todos los que usan el sistema, hay que:
1. Agregar una tabla nueva en MySQL (por ejemplo `historial_movimientos`).
2. Sumar un endpoint en `api/clientes.php` (o uno nuevo) que inserte ahí cada vez que se crea/edita/borra un cliente.
3. Cambiar `historial.js` para que lea de esa API en vez de `localStorage`.

---

## Exportar clientes a Excel

1. En `index.html`, el botón **"Generar Planilla"** activa el modo selección (`iniciarModoSeleccion()` en `app.js`): aparece un checkbox en cada tarjeta y una barra flotante abajo con la cantidad elegida.
2. Al tocar "Continuar", se guardan los objetos COMPLETOS de los clientes elegidos (ya están en memoria, con sus copropietarios incluidos, tal como los devolvió la API) en `sessionStorage` (clave `gestorClientes_exportSeleccion`), y se navega a `exportar.html`.
3. `exportar.js` lee esa clave, arma una vista previa en tabla HTML, y al tocar "Exportar a .xlsx" genera el archivo real con **ExcelJS** (cargado desde `https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js`, ver el `<script>` en `exportar.html`).
4. Las columnas del archivo (`COLUMNAS`, definidas en `exportar.js`) son EXACTAMENTE las mismas que se ven en la vista previa: nombre, sexo, DNI, CUIL, fecha de nacimiento, teléfono, mail, fecha de alta, estado civil, profesión, dirección, referente, y hasta 3 columnas de copropietarios.
5. El archivo se genera 100% en el navegador (no hay ningún endpoint PHP involucrado) y se descarga con un link temporal (`URL.createObjectURL` + click programático).

Si se necesita agregar o sacar una columna de la planilla, el único lugar que hay que tocar es el array `COLUMNAS` en `js/exportar.js` (cada columna es `{ titulo, valor: (cliente) => ... }`).

---

## Sistema de diseño (colores, tipografías, íconos)

Reglas que se respetaron en TODO el proyecto y que hay que seguir respetando:

- **Todos los colores son variables CSS**, definidas en `:root` (tema claro) y sobreescritas en `html[data-theme='dark']`, en `css/styles.css`. Nunca se pone un color "a mano" (`#8a639a`, `rgb(...)`, etc.) fuera de esas dos secciones.
- **Todas las tipografías son de Google Fonts** (Raleway y Nunito Sans), cargadas por `<link>` en el `<head>` de cada página, y expuestas como variables (`--font-heading`, `--font-body`).
- **Todos los íconos son de Google Fonts (Material Symbols Outlined)**, cargados por `<link>` una sola vez y usados así: `<span class="material-symbols-outlined">nombre_del_icono</span>`. Se pueden buscar nombres de íconos en <https://fonts.google.com/icons>.
- El color de marca es el morado `--color-accent` (`#8a639a`). Los colores de estado (`--color-success`, `--color-warning`, `--color-error`, `--color-info`) se usan para toasts, historial, validaciones, etc.
- Las barras de desplazamiento (scrollbars) también siguen la estética de la página (ver el bloque `*::-webkit-scrollbar` al principio de `css/styles.css`).

---

## Cómo correr el proyecto en local (XAMPP)

1. Instalar [XAMPP](https://www.apachefriends.org/) y arrancar los módulos **Apache** y **MySQL** desde el panel de control.
2. Copiar la carpeta del proyecto dentro de `htdocs` (ej. `C:\xampp\htdocs\AzafranRioPrimero`).
3. Crear la base de datos: abrir phpMyAdmin (`http://localhost/phpmyadmin`), crear una base llamada `gestor_clientes`, entrar a ELLA (no quedarse en la raíz) e importar `schema.sql`.
4. `config.php` ya trae valores de respaldo para XAMPP (`localhost`, usuario `root`, sin contraseña, base `gestor_clientes`) — no hace falta tocar nada si se usó ese nombre de base.
5. Abrir `http://localhost/AzafranRioPrimero/index.html` en el navegador.

Si por algún motivo no hay servidor corriendo, la app va a caer sola al [modo demo](#modo-demo-sin-servidor) y se va a poder ver igual (sin persistencia real).

---

## Despliegue en producción

### Clever Cloud (opción principal, ya usada)
- MySQL como add-on (Percona Server + phpMyAdmin + acceso FTP-compatible).
- `config.php` ya está preparado para leer las variables `MYSQL_ADDON_*` que Clever Cloud inyecta solo al enlazar el add-on — **no hay que escribir ninguna credencial a mano**.
- Subida de archivos por FileZilla (FTP).
- **Ojo con phpMyAdmin:** el error "#1046 No database selected" al importar `schema.sql` se soluciona seleccionando la base específica de Clever Cloud (algo como `b_xxxxxxxxx`) en la columna izquierda de phpMyAdmin ANTES de importar, no desde la raíz.

### InfinityFree (alternativa documentada)
Hosting compartido gratuito. Diferencias importantes:
- **No permite `CREATE DATABASE` ni `CREATE TRIGGER`** en el SQL que se importa. Hay que sacar esas líneas de `schema.sql` antes de importarlo (crear la base a mano desde el panel de InfinityFree, y confiar el límite de 3 copropietarios ÚNICAMENTE a la validación de `api/clientes.php` y del frontend, ya que no va a haber trigger).

---

## Convenciones de código

Para que el proyecto se mantenga consistente si lo sigue tocando otra persona:

1. **Comentarios en español**, explicando el POR QUÉ de una decisión, no solo el qué (mirá cualquier archivo del proyecto como ejemplo). Cuando se corrige un bug importante, se deja un comentario explicando cuál era el problema, no solo la solución.
2. **Nombres de funciones y variables en español** (`renderLista`, `guardarCliente`, `clienteActual`), salvo los estándares de la plataforma (`addEventListener`, `fetch`, etc.).
3. **Un solo archivo CSS** (`css/styles.css`), organizado en bloques con comentarios tipo `/* ===== SECCIÓN ===== */`. No se crean archivos `.css` nuevos por página.
4. **JavaScript sin frameworks ni bundlers**: cada `<script src="...">` es un archivo tal cual, sin transpilar. Si hace falta compartir lógica entre páginas, se saca a un archivo nuevo en `js/` y se carga en las páginas que lo necesiten (como se hizo con `custom-select.js`, `custom-date.js`, `db-status.js`).
5. **Patrón de "control oculto + capa visual propia"** para cualquier control de formulario que se quiera rediseñar más allá de lo que permite el CSS de un `<select>`/`<input>` nativo (ver [Componentes propios reutilizables](#componentes-propios-reutilizables)). Esto evita romper la lectura/escritura de `.value` que ya usa el resto del código.
6. Antes de dar por terminado un cambio, conviene correr una pasada rápida de sanidad (no hay tests automatizados en el proyecto todavía):
   - `node --check archivo.js` por cada `.js` tocado, para pescar errores de sintaxis.
   - Repasar a mano que todos los `id` que un `.js` busca con `getElementById` existan en el `.html` correspondiente.
   - Contar que las etiquetas HTML abiertas y cerradas coincidan.

---

## Errores comunes / cosas para tener en cuenta

- **Orden de los `<script>`**: si movés o agregás un script y la consola tira `CustomSelect is not defined` (o `CustomDate`/`apiListar`/etc.), seguro es por el orden. Los componentes compartidos (`api-clientes.js`, `custom-select.js`, `custom-date.js`) siempre van ANTES que el script propio de la página (`app.js`/`perfil.js`/`historial.js`).
- **Los `<input>` de fecha/estado civil están OCULTOS**: si en algún momento hace falta leer o escribir esos valores desde código nuevo, se sigue usando `document.getElementById(id).value` con toda naturalidad (el input real sigue estando ahí, solo que no se ve) — pero si el cambio lo hace un USUARIO a través del componente propio, hay que usar `CustomSelect.setValueById(...)` / `CustomDate.setValueById(...)` para que la parte visual (texto, ícono, opción resaltada) se actualice también.
- **`z-index` y `opacity` en elementos con `position: fixed`**: un elemento hijo con `opacity: 1` NO puede "deshacer" la opacidad de un padre con `opacity` menor a 1 (el compositing de CSS es multiplicativo). Esto ya causó un bug real en el footer (el tooltip de conexión se veía transparente por culpa de la opacidad del `<footer>` completo). Si algo se ve más transparente o más tapado de lo esperado, revisar `opacity` y `z-index` de TODOS los ancestros, no solo del elemento en cuestión.
- **El historial es local al navegador**, no está en la base de datos (ver la sección correspondiente). No hay que asumir que es un registro compartido entre computadoras.
- **El límite de 3 copropietarios** está validado en 3 lugares distintos (frontend, backend PHP, y opcionalmente el trigger de MySQL). Si se cambia ese número, hay que tocar los 3.

---

## Limitaciones conocidas y posibles mejoras futuras

- No hay autenticación ni usuarios: cualquiera con acceso a la URL puede ver/editar/borrar clientes.
- El historial de movimientos es por navegador (`localStorage`), no centralizado (ver [Historial de movimientos](#historial-de-movimientos) para el camino a seguir si se quiere resolver esto).
- No hay paginación en el listado de clientes: si la cantidad crece mucho (miles), conviene mover el filtrado del navegador al backend (los parámetros `?q=`/`?sexo=`/`?estadoCivil=` de `api/clientes.php` ya existen para eso, solo falta que el frontend los use).
- No hay tests automatizados.
- La exportación a Excel arma un único archivo con columnas fijas; si se necesitan plantillas distintas (por tipo de trámite, por ejemplo) habría que sumar una selección de "plantilla" antes de generar el `.xlsx` en `exportar.js`.