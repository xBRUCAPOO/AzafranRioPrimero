# Desplegar el backend (Cloudflare Worker + D1)

Esto reemplaza por completo a Clever Cloud + MySQL + PHP. Se hace UNA sola
vez (o cada vez que cambie `worker/src/index.js`).

## 0) Instalar Wrangler (la herramienta de línea de comandos de Cloudflare)

```bash
npm install -g wrangler
wrangler login
```

Se abre el navegador para iniciar sesión con tu cuenta de Cloudflare.

## 1) Crear la base de datos D1

Parado en la carpeta `worker/`:

```bash
cd worker
wrangler d1 create gestor-clientes-db
```

Esto imprime algo como:

```
[[d1_databases]]
binding = "DB"
database_name = "gestor-clientes-db"
database_id = "1a2b3c4d-....-....-....-............"
```

Copiá ese `database_id` y pegalo en `worker/wrangler.toml`, reemplazando
`PEGAR_ACA_EL_ID_QUE_IMPRIME_WRANGLER_D1_CREATE`.

## 2) Cargar las 3 tablas + los datos de ejemplo

```bash
wrangler d1 execute gestor-clientes-db --remote --file=./schema.sql
```

(`--remote` es importante: sin eso, Wrangler crea una base LOCAL de prueba
que no es la que usa la app en producción.)

## 3) Desplegar el Worker

```bash
wrangler deploy
```

Al terminar, Wrangler imprime la URL pública del Worker, algo como:

```
https://gestor-clientes-api.TU-USUARIO.workers.dev
```

**Copiá esa URL**: hace falta en el paso siguiente.

## 4) Conectar el frontend con esta URL

Abrí `js/config.js` (en la raíz del proyecto, NO en `worker/`) y pegá la URL
del paso anterior en `API_BASE`:

```js
const API_BASE = "https://gestor-clientes-api.TU-USUARIO.workers.dev";
```

Después de guardar ese cambio, ya podés desplegar el frontend a Cloudflare
Pages (ver el `README.md` de la raíz del proyecto).

## Cada vez que cambies worker/src/index.js

Solo hace falta repetir el paso 3 (`wrangler deploy`) desde la carpeta
`worker/`. No hace falta volver a crear la base ni recargar el schema.

## Si necesitás modificar la estructura de las tablas más adelante

Escribí el `ALTER TABLE`/`CREATE TABLE` que necesites en un archivo nuevo
(por ejemplo `worker/migracion_2026-10.sql`) y ejecutalo igual que en el
paso 2, con `--remote`. Nunca vuelvas a correr `schema.sql` sobre una base
que ya tiene datos: las 3 tablas usan `CREATE TABLE IF NOT EXISTS`, así que
no se rompen, pero el `INSERT` de datos semilla sí duplicaría los clientes.
