# ÉLIX · v1.9.1

Chat web de **grupos temporales**: cada grupo tiene una duración que elige su creador y, al cumplirse,
**se limpia solo (y vuelve a empezar) o se elimina por completo**. Nadie necesita cuenta para chatear;
solo quien crea el grupo (el *Big Admin*) se registra.

> Estado actual: **frontend completo y funcional** (HTML + CSS + JavaScript, sin dependencias ni build)
> con una **capa de datos simulada en `localStorage`** (`js/core/datos.js`). El backend real
> (Node + Express + Socket.IO + MySQL) todavía **no está construido**; la sección
> [Camino al backend](#camino-al-backend) explica cómo se conecta sin tocar las pantallas.

---

## 1. Qué es y para qué sirve

ÉLIX resuelve un problema concreto: conversaciones que **no deben quedar para siempre**.
Una salida de un fin de semana, un evento, una clase, una guardia, un grupo de estudio de un parcial.
En vez de chats que se acumulan, el grupo nace con fecha de vencimiento:

| Al vencer… | Qué pasa |
|---|---|
| Grupo que **se repite** | Se borran todos los mensajes, salen los miembros sin *Persist*, se generan link, código y QR nuevos y empieza otro ciclo con el mismo grupo. |
| Grupo que **se elimina** | Desaparece todo: mensajes, miembros e invitaciones. |

### Objetivos de diseño

1. **Entrar sin fricción.** Un invitado entra con un link, un código de 6 dígitos o un QR, pone nombre y (opcional) una foto tomada con la cámara. Sin registro, sin contraseña. Si el organizador quiere más control, activa la **sala de espera**.
2. **Privacidad por caducidad.** Lo que se dice se borra solo. Hasta los mensajes pueden ser "de 1 vez" (con un visor protegido). Exportar el chat es **opcional, lo decide el Big Admin y siempre se avisa en el chat**.
3. **Moderación por rangos claros** y, además, **decisión comunitaria** (votación de expulsión).
4. **Se siente como WhatsApp** (formato de texto, respuestas, reacciones, menciones, encuestas, notas de voz, mensajes fijados, "escribiendo…") pero con una **identidad visual propia**: HUD oscuro/claro, morado neón, tipografías tipo consola.
5. **Móvil primero.** Todo probado desde 300 px hasta escritorio; se instala como app (PWA).

---

## 2. Conceptos y rangos

| Rango | Cómo se obtiene | Qué puede hacer |
|---|---|---|
| **Big Admin** | Crea el grupo (necesita cuenta). Uno por grupo. | Todo: invitar, **editar todo el grupo** (nombre, descripción, foto, duración, modo y **opciones**), **controlar el ingreso** (pausar, límite de usos, regenerar, sala de espera), eliminarlo, nombrar/quitar Admins, dar/quitar Persist, expulsar y advertir a cualquiera, borrar y fijar mensajes. Siempre tiene Persist. Para irse debe **traspasar** el rango a un Admin (o eliminar el grupo). |
| **Admin** | Lo nombra el Big Admin (un Admin también puede nombrar Admins entre invitados). | Invitar, **editar nombre, descripción y foto** (no duración, modo ni opciones), borrar y **fijar** mensajes, escribir en el **modo anuncios**, **exportar el chat** (si el Big Admin lo activó), expulsar y advertir a invitados, dar Admin/Persist a invitados. No puede tocar a otros Admins ni al Big Admin. Tiene Persist por defecto. |
| **Invitado** | Entra por link, código o QR. Sin cuenta. | Chatear, reaccionar, votar, **mencionar con @**, **proponer la expulsión de otro invitado**, editar y borrar sus mensajes, cambiar su foto, salir. En el modo anuncios solo lee, reacciona y vota. |

**Persist** = "permanencia". Cuando un grupo *que se repite* se limpia, quien tiene Persist **se queda** y el resto sale.
Persist **solo existe en grupos que se repiten**: en los que se eliminan al vencer no hay insignia, ni opción, ni sentido
(la capa de datos también lo rechaza).

**Traspaso de Big Admin:** el Big Admin elige a un Admin. Si ese Admin ya tiene cuenta, el cambio es inmediato; si no,
queda *pendiente* hasta que cree su cuenta y acepte (puede rechazar; el Big Admin puede cancelar).

---

## 3. Ciclo de vida de un grupo

```
crear (Big Admin) ──► invitar (link · código · QR) ──► [sala de espera] ──► chatear ──► vence
                                                                                          │
                                 ┌────────────────────────────────────────────────────────┴───┐
                                 ▼                                                             ▼
                        modo "repetir"                                                 modo "eliminar"
             borra mensajes · salen los sin Persist                        se borra el 100 % del grupo
             invitación nueva · nuevo ciclo                                (link/código/QR dejan de servir)
```

- **Duración:** de **1 hora a 3 meses** (chips 1 h · 6 h · 24 h · 3 d · 1 sem · 1 mes · 3 meses o personalizada; 1 mes = 30 días). Máximo 80 personas.
- **Invitación única por grupo:** el link, el código de 6 dígitos y el QR apuntan a la misma invitación. Se regenera en cada ciclo (sin pausa ni límite) o a mano cuando el Big Admin quiere.
- **Editar un grupo** (`crear-grupo.html?g=ID`): al cambiar la duración, el ciclo actual pasa a durar *inicio + nueva duración*;
  si eso ya pasó, arranca un ciclo nuevo desde ahora (la pantalla lo explica antes de guardar). Cambiar el modo `repetir ↔ eliminar` oculta/muestra Persist; las marcas de Persist no se pierden.
- **Al reiniciarse un grupo que se repite** también empiezan de cero las solicitudes de la sala de espera, los mensajes fijados, el "visto por" y las advertencias.
- El chat revisa vencimientos **cada segundo** (`Datos.revisarVencimientos()`), y esa misma revisión cierra votaciones vencidas. Desde v1.9.0 es casi gratis: recuerda el próximo instante en que algo puede vencer y un número de versión de los datos, y no relee nada si ninguno cambió.

---

## 4. Funciones del chat

### Mensajes y archivos
Texto (hasta 4000 caracteres), emojis (catálogo completo de ~1900 con selector propio), fotos (se reducen a 1000 px), videos, audios,
**notas de voz**, documentos (PDF/Office/ZIP…). Los reproductores de audio y video son propios (estética HUD de ÉLIX).
Fechas separadoras, hora, nombre y foto del autor (tocar la foto la abre en grande, con su estado y descripción). El cuadro de texto crece hasta 120 px y **solo muestra barra de scroll cuando el texto ya no entra**.

- **Previsualización de adjuntos:** al elegir fotos, videos, audios o documentos no se envían de inmediato: quedan sobre el cuadro de texto, cada uno con su X (hasta 10 a la vez).
- **Pie de foto:** cada archivo puede llevar un texto que se ve debajo, como en WhatsApp.
- **Recortar:** las fotos se pueden recortar antes de enviar (mover el recuadro, girar, elegir proporción).
- **Notas de voz estilo WhatsApp:** mantener presionado el micrófono para grabar y soltar para enviar; deslizar hacia arriba para **fijar** la grabación y a la izquierda para **cancelarla**.

### Formato de texto (`js/core/formato.js`)
Al **seleccionar** texto aparece una barra flotante (en celulares queda anclada bajo el cuadro para que no la tape el menú del sistema). También hay atajos: `Ctrl/Cmd + B`, `I`, `Shift+X`, `E`.

| Marca | Resultado |
|---|---|
| `*hola*` | **negrita** |
| `_hola_` | *cursiva* |
| `~hola~` | ~~tachado~~ |
| `` `hola` `` | `código` (fuente **Cutive Mono**; dentro no se interpreta nada más) |
| `{{rojo\|hola}}` | color — **solo en descripciones de grupo** (8 colores: morado, rojo, naranja, amarillo, verde, cian, azul, rosa) |

Reglas: la marca de apertura va pegada al texto y tras espacio/símbolo; una marca no cruza saltos de línea; no se activa en
`snake_case` ni en `2 * 3 * 4`. Todo se construye con nodos del DOM (**nunca `innerHTML`**): es seguro frente a XSS.
El formato viaja como **texto plano con marcas**, así que el backend no necesita entenderlo.

### Responder, reaccionar, editar, buscar
- **Responder:** desde el menú del mensaje o **deslizando la burbuja a la derecha** (celular). La burbuja lleva una cita; al tocarla se salta al mensaje original y se resalta.
- **Reacciones:** barra rápida (👍 ❤️ 😂 😮 😢 🙏 y **+** para el catálogo completo). Una reacción por persona; tocar una reacción muestra quién reaccionó.
- **Editar:** un mensaje de texto propio se puede editar hasta 15 minutos después; queda la marca "Editado".
- **Buscar:** la lupa de la cabecera resalta las coincidencias (sin distinguir mayúsculas ni tildes) y las flechas ↑ ↓ las recorren.
- **Eliminar:** para todos (el propio, o cualquiera si eres Admin/Big Admin). Si lo borra un moderador dice "Mensaje eliminado por un administrador".

### Mensajes fijados *(v1.9.0)*
Un **Admin o el Big Admin** deja arriba del chat lo que todos deben ver (una dirección, un horario, las reglas): menú del mensaje → **Fijar mensaje**.
- Hasta **3** a la vez. Una barra bajo la cabecera muestra el fijado (con "1/3" si hay varios); tocarla salta al mensaje y pasa al siguiente. Los Admins ven el botón para desfijar.
- El mensaje fijado lleva una marca 📌 y queda un aviso en el chat. Además hay una lista en la información del grupo.
- No se pueden fijar mensajes de 1 vez, avisos ni votaciones. Al eliminar un mensaje fijado deja de estarlo.

### Menciones con @ *(v1.9.0)*
Al escribir `@` se abre una lista con las personas del grupo (menos tú) que se filtra mientras escribes; se elige tocando o con `↑ ↓ Enter/Tab`. Se guardan en el mensaje (`menciones: [{id, nombre}]`), se resaltan y **a quien nombran le suena un aviso** (y le llega una notificación si ÉLIX no está a la vista); su burbuja se ve con un borde de color. Funciona también en pies de foto y al editar (se recalculan). Un correo (`a@b.com`) no cuenta como mención.

### "Visto por" *(v1.9.0)*
En vez de un "visto", **tus mensajes muestran un ojo gris con cuánta gente los vio** (`👁 3/5`: 3 de las 5 personas que pueden verlo). Cada persona tiene un **cursor de lectura** (`g.lecturas[miembroId]`); se mueve cuando abre el chat con ÉLIX a la vista y llega al final de la conversación (si lee más arriba, lo nuevo todavía no cuenta). Solo lo ve quien escribió y solo muestra la cantidad, no quiénes.

### Descargar fotos, videos y audios *(v1.9.0)*
Los archivos de cualquier persona se pueden **descargar** con el botón sobre la foto/video/audio, la opción "Descargar" del menú o los botones del visor de Multimedia. Se bajan con la extensión real (una foto enviada como PNG/HEIC se reduce a JPG al enviarla y se baja como `.jpg`). **Los mensajes de 1 vez nunca se pueden descargar.**

### Mensajes de 1 vez y visor protegido *(reforzado en v1.9.0)*
Se pueden enviar de 1 vez **textos, fotos, videos y audios** (no documentos): interruptor "1 vez" del clip, botón en la previsualización o junto al botón de enviar de las notas de voz. Cada persona **abre el mensaje una sola vez**; queda "Abierto · Ya no se puede volver a ver". El emisor ve "Abierto por N de M" y **no puede volver a verlo**.

El contenido solo se muestra en un **visor protegido** (`js/core/visor-seguro.js` + modo `seguro` de `reproductores.js`):

| Qué hace | Cómo |
|---|---|
| Sin descargar, ampliar ni pantalla completa | No hay botones; sin imagen en imagen ni transmisión a otra pantalla en los videos |
| Sin copiar ni guardar | Bloquea clic derecho, arrastrar, seleccionar, copiar y cortar; las imágenes no reciben toques (sin "Guardar imagen" en el celular) |
| **Marca de agua** | Tu nombre y la hora, repetidos en diagonal sobre todo el contenido (se lee sobre fondos claros y oscuros): si alguien lo filtra, se sabe de quién es |
| Se oculta al salir | Pantalla negra si la pestaña/ventana pierde el foco; vuelve al regresar |
| Detecta capturas | Se cierra con `Impr Pant` (y vacía el portapapeles), `Ctrl/Cmd+P`, `Ctrl/Cmd+S`, `Win+Shift+S`, `Cmd+Shift+3/4/5` o al imprimir (`@media print` lo oculta) |
| No se abre sin protección | Si el visor no cargó, el mensaje **no se abre** ni se gasta la única vez |

> **Límite (dicho sin adornos):** ninguna página web puede impedir una captura o una grabación de pantalla hecha por el sistema operativo o por otro dispositivo (botones de encendido + volumen del celular, fotografiar la pantalla con otro teléfono). Lo que sí hace ÉLIX es cerrar todas las puertas que la web controla y dejar la marca de agua. La protección real a nivel del sistema exige **video con DRM** (Widevine/FairPlay con servidor de licencias) o una **app nativa** (Android `FLAG_SECURE`): queda para la etapa del backend. En la demo, además, los datos viven en el navegador y las herramientas de desarrollo los muestran.

### Encuestas
Pregunta + 2 a 12 opciones, de respuesta única o múltiple. Se puede cambiar el voto; "Ver votos" lista quién votó cada opción.

### Votación de expulsión
Cualquier miembro puede proponerla **contra un invitado** (nunca contra Admins ni el Big Admin) y con **al menos 3 miembros**.

- Votan todos **menos el acusado**; quien propone ya vota "sí".
- Se **aprueba** con el **70 %** de "sí" (redondeo hacia arriba: en un grupo de 5 → 4 votantes → hacen falta 3) y la persona sale.
- Se **rechaza** en cuanto ya es matemáticamente imposible llegar al 70 %.
- **Vence a las 24 h**. Se **cancela** si el acusado ya no está.
- Solo una votación abierta a la vez contra la misma persona. Se puede cambiar el voto mientras esté abierta.
- En la computadora se vota con el teclado: `F1` = sí, `F2` = no.
- Aparece en el chat como una tarjeta con barra de progreso y marca del 70 %. **El voto elegido se marca en color: "Sí, expulsar" en rojo y "No" en verde** *(v1.9.0)*.

### Avisos del sistema con icono *(v1.9.0)*
Cada aviso del chat lleva su icono: 👤➕ *entra*, 🚪 *sale*, 👤➖ *expulsado*, 📌 *fijado*, 📢 *modo anuncios*, ⏳ *sala de espera*, ⬇️ *exportar / exportó el chat*. Los avisos de exportación se ven en **cursiva y gris**.

### Advertencias, "escribiendo…", sonidos y notificaciones
- **Advertir** (Admin/Big Admin, desde el menú del miembro o **de un mensaje concreto**): la persona ve una ventana roja privada con el mensaje por el que se le advierte y debe confirmarla presionando 5 veces.
- **"Escribiendo…"**: avatar(es), nombre(s) y tres puntos animados; se apaga solo a los 4,5 s.
- **Sonidos** (enviar, recibir, iniciar/mandar un audio) y **notificaciones del navegador** cuando llega algo con ÉLIX en segundo plano (Ajustes). Un mensaje de 1 vez nunca muestra su contenido en la notificación.

### Etiquetas con ayuda
Cada "tarjetita" informativa (rangos, Persist, *Se repite / Se elimina*, *Vence en*, *Tú*, *1 vez*, votación, *Sala de espera*, *Modo anuncios*, *Exportar chat*, *Fijado*, *Visto por*, *Mención*…) abre una explicación
al pasar el mouse, enfocar con teclado o tocar (`Comun.insigniaAyuda(tipo, {texto, clase, tono})`). Tocar una etiqueta dentro de una tarjeta de grupo **no abre el grupo**. También son clickeables en todo el Centro de ayuda.

### Ajustes
Perfil (si hay sesión), **Tema** (automático / claro / oscuro), **Animaciones**, **Sonidos**, **Notificaciones**, **Instalar app** y **Centro de ayuda**.

---

## 5. Opciones del grupo y control de ingreso *(v1.9.0)*

En **Crear grupo / Editar grupo** el Big Admin ve la sección **Opciones del grupo** con tres interruptores. **Todos vienen desactivados**; solo el Big Admin los cambia y cada cambio deja un aviso en el chat. En **Información del grupo** se muestran las opciones activas como etiquetas con ayuda.

| Opción (`g.opciones`) | Qué hace |
|---|---|
| **Sala de espera** (`salaEspera`) | Quien usa el link, el código o el QR **no entra al chat**: crea su perfil y pasa a `espera.html`, que se actualiza sola. El Big Admin ve la solicitud (barra azul en el chat + tarjeta "Solicitudes de ingreso" en Información) y la **acepta o rechaza**. Quien espera puede cancelar; si lo aceptan, entra al chat (y recibe una notificación si estaba en otra pestaña). Solo decide el Big Admin. |
| **Modo anuncios** (`soloAdmins`) | Solo escriben Admins y Big Admin. Los invitados ven un aviso en lugar de la barra de escribir y siguen pudiendo **reaccionar, votar (encuestas y expulsión), abrir mensajes de 1 vez, buscar y descargar**. No pueden escribir, adjuntar, grabar, crear encuestas, responder, editar ni proponer expulsiones. `datos.js` lo valida (no solo la pantalla). |
| **Exportar el chat** (`exportar`) | Los Admins (y el Big Admin) ven en Información el botón **Exportar chat**, que baja un `.txt` con mensajes, pies, encuestas con sus votos y avisos. **No incluye** archivos (solo su nombre), mensajes de 1 vez (figuran sin contenido) ni advertencias (privadas). Al exportar queda en el chat el aviso *"X exportó el chat"* (cursiva, gris) y mientras la opción esté activa **Información avisa que está habilitada**. Los invitados no ven el botón. |

**Control de ingreso** (solo el Big Admin, dentro de *Invitar gente*):
- **Pausar invitaciones:** el link, el código y el QR no dejan entrar a nadie hasta reactivarla. `unirse.html` avisa el motivo y `Datos.unirse()` lo vuelve a validar.
- **Límite de usos** (1 a 999): cuántas personas pueden entrar con la invitación (`invitacion.usos` cuenta a quienes entran; con sala de espera, a quienes se aceptan).
- **Regenerar** link, código y QR a mano: los anteriores dejan de servir al instante; se conservan la pausa y el límite y los usos vuelven a 0.
- Los Admins ven la invitación y su estado (pausada / agotada), pero no la controlan.

---

## 6. Información del grupo

Descripción con formato, tiempo restante (con segundos), reglas activas, mensajes fijados, **Multimedia**, "Mi perfil en el grupo" (foto, estado corto y descripción), lista de miembros con buscador y acciones según rango, salir / eliminar (eliminar pide el nombre del grupo y 5 pulsaciones).

**Multimedia** *(antes "Fotos"; v1.9.0)* — pestañas **Fotos y videos** (miniaturas, con marca de reproducir en los videos), **Audios** (con reproductor) y **Documentos**; cada elemento se puede **descargar** y **ver en el chat**; el visor pasa de un elemento a otro con flechas o `← →`. No incluye archivos eliminados ni mensajes de 1 vez.

---

## 7. Arquitectura del frontend

Sin frameworks ni build: cada página carga sus scripts con `<script>` y se comunican mediante **módulos globales**
(patrón IIFE). Funciona abriendo en cualquier hosting estático (GitHub Pages, Cloudflare Pages…).

```
index.html                     Portada (versión y fecha en el footer)
manifest.webmanifest · sw.js   App instalable (PWA) y service worker (lista de archivos + versión de caché)
paginas/
  login.html · registro.html   Cuenta del Big Admin
  mis-grupos.html              Lista de grupos del Big Admin
  crear-grupo.html             Crear (sin ?g=) y EDITAR (?g=ID) un grupo, con las opciones del grupo
  unirse.html                  Unirse por código de 6 dígitos, link (?t=) o QR
  perfil-invitado.html         Nombre + foto (cámara) + descripción del invitado
  espera.html                  Sala de espera: "Esperando aprobación" hasta que el Big Admin responde
  chat.html                    Chat del grupo
  info-grupo.html              Miembros, rangos, invitar y controlar el ingreso, solicitudes, fijados, multimedia, exportar
  perfil.html                  Perfil de la cuenta
  ayuda.html                   Centro de ayuda (~100 preguntas con buscador y etiquetas clickeables)
css/style.css                  Único CSS. TODOS los colores, fuentes y tamaños base son variables en :root
js/core/
  datos.js                     Capa de datos SIMULADA (localStorage). Reemplazable por el backend
  comun.js                     h(), iconos, avatares, modales, menús, selects, ayudas, Ajustes, descargas
  tema.js · pwa.js             Tema claro/oscuro, animaciones, sonidos, avisos · instalación como app
  formato.js                   Formato de texto (render seguro + barra flotante + paleta de colores)
  emojis.js · selector-emojis.js   Catálogo y selector de emojis (dibujo por tramos)
  selector-foto.js · recortador.js Cámara/galería y recorte de imágenes
  reproductores.js             Reproductores propios de audio y video (con descarga y modo seguro)
  visor-seguro.js              Visor protegido de los mensajes de 1 vez
  sonidos.js · notificaciones.js   Sonidos y notificaciones del navegador
js/paginas/*.js                Un archivo por página (chat.js es el más grande)
```

### Módulos globales
- **`Datos`** — única fuente de verdad. Cada función devuelve `{ok:true, …}` o `{ok:false, error}`.
- **`Comun`** — utilidades de UI compartidas.
- **`Formato`** — parseo/renderizado de marcas y barra de edición.
- **`Reproductores` · `VisorSeguro` · `SelectorEmojis`** — audio/video, visor protegido y selector de emojis.
- **`Movimiento` / `Tema` / `Sonido` / `Avisos`** — preferencias guardadas.

### Cómo se pinta el chat (`chat.js`)
`sincronizar()` relee `Datos`, actualiza cabecera, mensajes, barra de fijados, aviso de solicitudes y permisos de escritura. `pintarMensajes()` **agrega solo lo nuevo** y, si un mensaje
existente cambia (reacción, voto, "abierto", eliminado, "visto por", fijado…), **reemplaza solo su fila** usando una *firma* del
mensaje; así el scroll no salta. Se re-sincroniza con el evento `storage` (otra pestaña = otra persona en la demo) y cada segundo.

### Animaciones de carga *(v1.9.1)*
Cuando algo todavía no llegó se ve un **marcador con un brillo que lo recorre** en lugar de un hueco vacío:

| Dónde | Qué se ve |
|---|---|
| Fotos del chat y foto en grande | El envoltorio de la foto brilla hasta que la imagen carga y luego aparece con un fundido |
| Videos y audios | El reproductor brilla mientras se leen sus datos |
| Avatares y foto de perfil/grupo | El círculo brilla; si la foto no carga, vuelve a las iniciales (o al icono de grupo) |
| Miniaturas de Multimedia y visor | La casilla brilla hasta que llega la miniatura |
| Código QR | Un cuadro brilla mientras llega el generador (viene de internet); reintenta unos segundos antes de avisar del error |
| Selector de emojis | Las categorías que aún no se dibujaron muestran puntos que laten |
| Iconos | Mientras la fuente de iconos se descarga, cada icono es una cajita que late (en vez de ver escrito "person_add", "send"…) |

Reglas: `Comun.alCargar(medio, contenedor)` (en `comun.js`) pone y quita la clase `.cargando` **solo si la carga tarda más de 120 ms**, así lo que carga rápido (fotos pequeñas, imágenes ya guardadas) no parpadea al repintar el chat. Los colores y la velocidad salen de `--color-esqueleto`, `--color-esqueleto-brillo` y `--mov-esqueleto` (`:root`). Con **Animaciones: No** el brillo queda quieto. La detección de la fuente de iconos vive en `tema.js` (clase `iconos-cargando` en `<html>`; se rinde a los 5 s sin conexión).

### Rendimiento del selector de emojis (v1.9.0)
Antes se creaban de golpe ~1900 botones y todos seguían en pantalla. Ahora cada categoría **reserva su altura exacta** (filas × alto de cada emoji, variables `--emoji-ancho` y `--emoji-alto`) pero **solo dibuja sus botones cuando está cerca de lo que se ve** y los quita cuando queda lejos; cada emoji es un botón liviano (sin onda ni recorte) y con el panel abierto se pausan las animaciones decorativas infinitas.

### Convenciones del proyecto
- Colores, tipografías y tamaños: **variables en `:root`** (y su variante `:root[data-tema="claro"]`). No hay colores sueltos fuera de ahí.
- Tipografías de **Google Fonts** (Geist Pixel, Oxanium, Space Grotesk, JetBrains Mono, Share Tech Mono, **Cutive Mono** para código).
- Iconos de **Google Fonts Icons** (Material Symbols Rounded), siempre por nombre.
- Comentarios en el código explicando cada bloque y cambio. Sin `innerHTML` con datos de usuario.
- Cada cambio en `index.html` actualiza **versión y fecha del footer**.
- Al agregar o quitar archivos hay que actualizar la lista `ARCHIVOS` y la `VERSION` de `sw.js`.

---

## 8. Modelo de datos

Claves de `localStorage` (todas con prefijo `elix_`):

| Clave | Contenido |
|---|---|
| `elix_cuentas` | Cuentas de Big Admin `{id, correo, nombre, clave, foto, descripcion}` |
| `elix_grupos` | Todos los grupos (ver abajo) |
| `elix_grupos_ver` | Número de versión de los grupos: cambia en cada guardado (acelera la revisión de vencimientos) |
| `elix_sesion_cuenta` | Id de la cuenta con sesión iniciada |
| `elix_miembros_dispositivo` | `{grupoId: id}` — quién soy en cada grupo desde este dispositivo (miembro, o solicitud pendiente en la sala de espera: al aceptarla el mismo id pasa a ser el del perfil) |
| `elix_escribiendo` | `{grupoId: {miembroId: timestamp}}` — señal efímera de "escribiendo…" |
| `elix_tema` · `elix_movimiento` · … | Preferencias: tema, animaciones, sonidos, notificaciones |
| `elix_emojis_*` | Emojis recientes y tono de piel |
| `elix_semilla_v1` | Marca de que ya se cargaron los datos de ejemplo |

```jsonc
// Grupo
{ "id", "nombre", "descripcion",            // descripción con marcas de formato y color
  "foto",                                   // dataURL o null
  "duracionMs", "modo": "repetir|eliminar",
  "inicio", "fin",                          // ciclo actual
  "opciones": { "salaEspera": false, "soloAdmins": false, "exportar": false },     // v1.9.0 (todas desactivadas por defecto)
  "invitacion": { "token", "codigo", "creada", "pausada": false, "limite": null, "usos": 0 },   // v1.9.0: pausa, límite y usos
  "miembros": [ { "id", "nombre", "foto", "descripcion", "estado", "rol": "big_admin|admin|invitado", "persist", "cuentaId", "unido" } ],
  "pendientes": [ { "id", "nombre", "foto", "descripcion", "cuentaId", "fecha" } ], // v1.9.0: sala de espera
  "rechazados": [ "idSolicitud" ],                                                  // v1.9.0
  "fijados": [ { "id": "idMensaje", "por", "porNombre", "fecha" } ],                // v1.9.0 (máx. 3)
  "lecturas": { "miembroId": timestamp },                                           // v1.9.0: cursor de lectura ("visto por")
  "advertencias": [ /* privadas */ ],
  "traspaso": { "desdeId", "haciaId" },     // opcional
  "mensajes": [ /* ver abajo */ ] }

// Mensaje (campos comunes + opcionales según el tipo)
{ "id", "miembroId", "autorNombre", "tipo": "texto|imagen|video|audio|archivo|encuesta|expulsion|sistema",
  "texto", "archivo", "fecha", "eliminado",
  "respuestaA": "idMensaje",                          // responder
  "reacciones": { "miembroId": "👍" },                // una por persona
  "menciones": [ { "id", "nombre" } ],                // v1.9.0: personas nombradas con @
  "editado": true, "editadoFecha",                    // edición (15 min)
  "unaVez": true, "vistoPor": ["miembroId"],          // mensaje de 1 vez
  "encuesta": { "pregunta", "multiple", "opciones": [ { "id", "texto", "votos": ["miembroId"] } ] },
  "expulsion": { "objetivoId", "objetivoNombre", "votos": {"miembroId": true|false},
                 "estado": "abierta|aprobada|rechazada|vencida|cancelada", "vence", "final": {si,no,elegibles,necesarios} },
  "evento": "entra|sale|expulsado|fijado|anuncios|espera|exportar|exporta|info" }  // solo tipo "sistema" (cada uno con su icono)
```

### API de `Datos` (resumen)
Cuentas: `registrarCuenta · loginCuenta · cerrarSesion · cuentaActual · actualizarCuenta`.
Grupos: `crearGrupo · editarGrupo · eliminarGrupo · obtenerGrupo · buscarPorCodigo · buscarPorToken · gruposDeCuenta · opcionesDe`.
Miembros: `unirse · salir · cambiarFoto · actualizarMiPerfil · cambiarRol · alternarPersist · expulsar · iniciarTraspaso · cancelarTraspaso · aceptarTraspaso · rechazarTraspaso`.
Ingreso *(v1.9.0)*: `estadoInvitacion · configurarInvitacion · regenerarInvitacion · solicitudDelDispositivo · idDelDispositivo · estadoSolicitud · aprobarSolicitud · rechazarSolicitud · cancelarSolicitud`.
Mensajes: `enviarMensaje · editarMensaje · borrarMensaje · reaccionar · votarEncuesta · abrirUnaVez · proponerExpulsion · votarExpulsion · puedeAdvertir · advertir · confirmarAdvertencia`.
Fijados, lectura y exportación *(v1.9.0)*: `fijarMensaje · fijadosDe · marcarLeido · vistosDe · exportarChat`.
Presencia: `avisarEscribiendo · dejarDeEscribir · quienEscribe`.
Ciclo: `revisarVencimientos · forzarVencimiento · reiniciarDemo`.

Datos de ejemplo: cuenta **`demo@gmail.com` / `Demo1234`**, grupo "Sala de Estudio" (se repite, código **482913**, link `unirse.html?t=demo-sala-estudio`)
y "Cumple de Vale" (se elimina). Desde la consola: `Datos.reiniciarDemo()` y `Datos.forzarVencimiento('g1')`.

---

## Camino al backend

Cada función de `Datos` corresponde a una llamada de red; las pantallas no cambian (solo se reemplaza `datos.js`).
Propuesta (**aún no implementada**):

| Frontend | Backend sugerido |
|---|---|
| Cuentas, grupos, miembros, invitaciones | REST (Express) + MySQL: `cuentas`, `grupos`, `miembros`, `invitaciones` (con `pausada`, `limite`, `usos`), `solicitudes_ingreso` |
| Mensajes, reacciones, votos, encuestas, menciones, fijados | Tablas `mensajes`, `reacciones`, `menciones`, `fijados`, `encuesta_opciones`, `encuesta_votos`, `votaciones_expulsion`, `votos_expulsion`, `vistos_una_vez`, `lecturas` (cursor por miembro) |
| Tiempo real (mensajes nuevos, reacciones, votos, solicitudes) | **Socket.IO**: eventos `mensaje`, `mensaje:actualizado`, `miembro:sale`, `grupo:reinicio`, `solicitud:nueva`, `solicitud:resuelta` |
| "Escribiendo…" | Evento Socket.IO `escribiendo` (con *throttle* de 2 s, ya implementado en el cliente) |
| Vencimientos y votaciones | Tarea programada (cron / worker) que ejecuta la misma lógica que `revisarVencimientos()` y `evaluarVotaciones()` |
| Exportar el chat | Endpoint que arma el `.txt` en el servidor (solo Admins y solo si `opciones.exportar`) y registra el aviso en el chat |
| Archivos | Disco/objeto (hoy los pesados viven solo en memoria de la pestaña) |

Puntos que **deben pasar al servidor** porque el cliente no puede garantizarlos:
- **Mensajes de 1 vez:** el servidor debe entregar el contenido una sola vez a cada persona y borrarlo al ser visto por todos. Para bloquear capturas de verdad hace falta **DRM** en video (Widevine/FairPlay) o app nativa (`FLAG_SECURE`); el visor web actual es disuasión, no garantía.
- Permisos por rango, **modo anuncios**, **sala de espera** (solo el Big Admin aprueba), límite de usos y pausa de la invitación.
- El conteo del 70 %, el vencimiento de 24 h y el cursor de "visto por".
- **Expulsados:** hoy pueden volver a entrar con el mismo link o código (no hay lista de bloqueados); se necesita una regla en el servidor (por ejemplo, bloqueo por dispositivo/cuenta o pasar siempre por la sala de espera).
- La contraseña (hoy la demo guarda la clave en texto plano solo por ser una simulación).

---

## 9. Ejecutar y desplegar

No hay build. Basta servir la carpeta con cualquier servidor estático.

```bash
npx serve .            # o: python3 -m http.server 8080
```

- **GitHub Pages / Cloudflare Pages:** subir el contenido de esta carpeta (el `index.html` va en la raíz; se incluye `.nojekyll`).
  Los links se calculan desde la ubicación de `comun.js`, por lo que también funciona en una subcarpeta (`usuario.github.io/mi-repo/`).
- La cámara (foto de perfil y de grupo) y el micrófono (notas de voz) requieren **HTTPS o `localhost`**.
- Para simular **varias personas**, abre el mismo sitio en pestañas distintas: comparten `localStorage` y se sincronizan en vivo. Ojo: una persona con **sesión de Big Admin** en el navegador es siempre el Big Admin en ese grupo; para probar la sala de espera como invitado cierra la sesión o usa otro perfil de navegador para la parte del invitado.

## 10. Pruebas realizadas (v1.9.0)

Todo se verificó con **Chromium real** (Playwright), con emulación móvil/táctil. Más de 160 comprobaciones automáticas, entre otras:

- Carga de las pantallas sin errores de consola; auditoría de desborde horizontal en 300, 320, 360 y 390 px (incluida la pantalla de espera).
- **Emojis:** al abrir el selector hay ~550 botones en el DOM (antes 1898); las alturas reservadas coinciden exactamente con las reales (sin saltos al desplazar, también en táctil); saltar a la última categoría, buscar y elegir funcionan; con la CPU limitada ×4 el desplazamiento pasó de ~25 ms a ~21 ms por fotograma (p95: 50 → 33 ms).
- **Video vs. emojis:** el panel de emojis queda por encima de la duración del video (`isolation: isolate`).
- **Mensajes fijados** (fijar, máximo 3, permisos, desfijar al eliminar), **menciones** (lista, teclado, táctil, borde de mención, `a@b.com`), **"visto por"** (cursor de lectura entre dos personas).
- **Modo anuncios** (invitado sin barra de escribir, reacciones sí, Admin escribe, se activa mientras alguien escribe, validación en `Datos`), **votación** (rojo/verde), **descargas** (extensión real, sin descarga en mensajes de 1 vez), **visor protegido** (marca de agua, clic derecho, pérdida de foco, `Impr Pant`, no se abre dos veces, documentos no admiten "1 vez").
- **Sala de espera** (solicitud, aceptar, rechazar, redirección sola, solo el Big Admin), **control de ingreso** (pausa, límite, regenerar, Admin sin permiso), **exportar** (archivo, contenido, aviso en el chat, permisos), **crear grupo** (3 interruptores apagados por defecto).
- **Vencimientos:** con la caché siguen detectándose los ciclos y las votaciones vencidas; 100 revisiones con 2,9 MB de datos pasaron de 521 ms a 0,3 ms.
- Centro de ayuda: buscador, enlaces directos, etiquetas clickeables y enlaces internos sin romper.
- Lo anterior (v1.4.0 a v1.8.0): formato de texto, responder, reacciones, encuestas, 1 vez, votación al 70 %, edición de grupos, Persist, etiquetas con ayuda, "escribiendo…".

## 11. Limitaciones conocidas de la demo

- Los archivos de más de ~600 KB solo existen en memoria mientras la pestaña esté abierta.
- Los mensajes de 1 vez, los permisos, la sala de espera y el modo anuncios son **lógica de cliente**: sin backend no son seguros (las herramientas de desarrollo muestran todo `localStorage`).
- Ninguna página web puede bloquear capturas de pantalla del sistema: ver "Mensajes de 1 vez y visor protegido".
- Con varias pestañas escribiendo a la vez puede perderse un cambio (cada guardado reescribe los datos completos).
- Un expulsado puede volver a entrar con el mismo link o código.
- La contraseña se guarda sin cifrar (solo simulación).
- No hay notificaciones push ni persistencia de sesiones entre dispositivos.

## Historial

- **v1.9.1** — Animaciones de carga (fotos, videos, audios, avatares, miniaturas, QR, categorías de emojis e iconos).
- **v1.9.0** — **Mensajes fijados**, **control de ingreso** (pausar, límite de usos, regenerar, **sala de espera**), **modo anuncios**, **exportar el chat** (opcional, avisado en el chat y en Información), **menciones con @**, **"visto por"** con contador, **descargar** fotos, videos y audios, **visor protegido** para los mensajes de 1 vez, **Multimedia** en Información (fotos, videos, audios y documentos), iconos en los avisos de entra/sale/expulsado, votación con "Sí" en rojo y "No" en verde. Correcciones: la duración del video ya no tapa los emojis, el selector de emojis es mucho más liviano, la revisión de vencimientos ya no relee todo cada segundo, la cabecera del chat ya no reconstruye la foto cada segundo, los mensajes tienen tope de 4000 caracteres y el modo del grupo se valida. README y Centro de ayuda actualizados.
- **v1.8.0** — Pie de foto en archivos, recorte de imágenes, video con estética HUD, descripción y estado en los perfiles, advertir por un mensaje concreto, voto con F1/F2, sonidos y notificaciones, aviso al salir con cambios sin guardar, fotos en grande y barra de formato sin tapar en el celular.
- **v1.7.0** — Notas de voz estilo WhatsApp, previsualización de adjuntos con X, botón "1 vez" para audios, fotos y videos, y etiquetas clickeables en todo el Centro de ayuda.
- **v1.6.0** — App instalable (PWA): manifiesto, iconos, service worker y botón "Instalar app" en Ajustes.
- **v1.5.0** — Etiqueta Beta, foto de la cuenta en la barra, errores animados en formularios, duración máxima de 3 meses, advertencias, edición de mensajes, "eliminado por un administrador", eliminar grupo con nombre + 5 pulsaciones, segundos en el tiempo restante, búsqueda de mensajes, fotos en info-grupo y Centro de ayuda.
- **v1.4.0** — Formato de texto y colores en descripciones, respuestas (con deslizar), reacciones, encuestas, mensajes de 1 vez,
  votación de expulsión (70 %), edición de grupos, foto de grupo, "escribiendo…", Persist solo en grupos que se repiten,
  mensajes eliminados en rojo, etiquetas con ayuda en toda la app, animaciones Sí/No y arreglo de la barra de scroll del cuadro de texto.
- **v1.3.x** — Diseño adaptable, controles propios, emojis completos, cambio de foto, ayudas de rangos.
