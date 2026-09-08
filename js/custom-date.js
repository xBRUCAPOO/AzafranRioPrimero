/*
 * custom-date.js
 * Reemplaza los <input type="date"> nativos por un calendario propio
 * (bloque .custom-date, ver css/styles.css): el calendario emergente de
 * un <input type="date"> lo dibuja el sistema operativo/navegador y no
 * se le puede tocar el estilo, así que se arma un calendario a mano con
 * la estética de la página (mismos colores, tipografías e íconos).
 *
 * CAMBIO IMPORTANTE (pedido del cliente): antes, TODO el bloque (texto +
 * ícono) era un único <button>, así que tocar el texto también abría el
 * calendario y no se podía tipear la fecha a mano. Ahora:
 *   - El calendario emergente SOLO se abre/cierra tocando el ícono
 *     (.custom-date__icon-btn).
 *   - La fecha se puede escribir directamente con el teclado en el
 *     <input class="custom-date__input">, con el formato dd/mm/aaaa
 *     (se le van agregando las barras "/" solas mientras se escribe).
 *
 * El valor real sigue viviendo en un <input type="date"> oculto con el
 * mismo id que antes tenía el input visible, así el resto del código
 * (formularios, filtros) sigue leyendo/escribiendo ".value" exactamente
 * igual, ya sea leyendo el valor o escuchando el evento "change".
 *
 * Se carga en index.html, perfil.html e historial.html, ANTES que
 * app.js / perfil.js / historial.js (que usan CustomDate.setValueById /
 * CustomDate.syncById para completar o sincronizar el calendario a mano).
 */

const CustomDate = {
  MESES: [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ],
  DIAS_SEMANA: ["LU", "MA", "MI", "JU", "VI", "SA", "DO"],

  // Engancha los eventos de UN calendario puntual. Se puede volver a
  // llamar sobre el mismo contenedor sin problema.
  init(container) {
    const campo = container.querySelector(".custom-date__field");
    const input = container.querySelector(".custom-date__input");
    const iconBtn = container.querySelector(".custom-date__icon-btn");
    const panel = container.querySelector(".custom-date__panel");
    const nativeInput = container.querySelector("input[type='date']");
    if (!campo || !input || !iconBtn || !panel || !nativeInput) return;

    // Mes que se está mostrando en el calendario: arranca en la fecha ya
    // elegida, o en el mes actual si todavía no hay ninguna
    let vista = nativeInput.value ? new Date(nativeInput.value + "T00:00:00") : new Date();

    const pintarPanel = () => {
      panel.innerHTML = this._armarPanelHtml(vista, nativeInput.value);

      panel.querySelector('[data-nav="prev"]').onclick = (e) => {
        e.stopPropagation();
        vista.setMonth(vista.getMonth() - 1);
        pintarPanel();
      };
      panel.querySelector('[data-nav="next"]').onclick = (e) => {
        e.stopPropagation();
        vista.setMonth(vista.getMonth() + 1);
        pintarPanel();
      };
      panel.querySelectorAll(".custom-date__day[data-date]").forEach((celda) => {
        celda.onclick = (e) => {
          e.stopPropagation();
          this.setValue(container, celda.dataset.date);
          this._cerrarPanel(container);
        };
      });
      panel.querySelector('[data-action="hoy"]').onclick = (e) => {
        e.stopPropagation();
        const hoyIso = new Date().toISOString().slice(0, 10);
        vista = new Date();
        this.setValue(container, hoyIso);
        this._cerrarPanel(container);
      };
      panel.querySelector('[data-action="borrar"]').onclick = (e) => {
        e.stopPropagation();
        this.setValue(container, "");
        this._cerrarPanel(container);
      };
    };

    // Abre/cierra el calendario: SOLO el ícono hace esto (antes lo hacía
    // todo el bloque, texto incluido)
    iconBtn.onclick = (e) => {
      e.stopPropagation();
      const yaEstabaAbierto = iconBtn.getAttribute("aria-expanded") === "true";
      // Cierra cualquier otro calendario/desplegable que haya quedado abierto
      document.querySelectorAll(".custom-date__panel").forEach((p) => p.classList.add("hidden"));
      document.querySelectorAll(".custom-date__icon-btn").forEach((b) => b.setAttribute("aria-expanded", "false"));
      document.querySelectorAll(".custom-date__field--abierto").forEach((f) => f.classList.remove("custom-date__field--abierto"));
      if (!yaEstabaAbierto) {
        vista = nativeInput.value ? new Date(nativeInput.value + "T00:00:00") : new Date();
        pintarPanel();
        panel.classList.remove("hidden");
        iconBtn.setAttribute("aria-expanded", "true");
        campo.classList.add("custom-date__field--abierto");
      }
    };

    // Escribir la fecha a mano: se le agregan las barras "/" solas
    // (dd/mm/aaaa) y recién cuando están los 8 dígitos completos se valida
    // como fecha real y se actualiza el <input type="date"> oculto.
    input.oninput = () => {
      const textoFormateado = this._formatearMientrasEscribe(input.value);
      input.value = textoFormateado;
      const iso = this._textoAIso(textoFormateado);
      if (iso) {
        // Fecha completa y válida: se actualiza el valor real (dispara
        // "change" para que filtros/formularios reaccionen)
        nativeInput.value = iso;
        nativeInput.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (textoFormateado === "") {
        nativeInput.value = "";
        nativeInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };

    // Al salir del campo, si quedó una fecha a medio escribir (o inválida,
    // como 31/02), se descarta y se vuelve a mostrar el último valor válido
    input.onblur = () => this._actualizarTexto(container);

    // Enter también intenta confirmar la fecha tipeada (sin enviar el formulario)
    input.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      }
    };

    this._actualizarTexto(container);
  },

  _cerrarPanel(container) {
    const panel = container.querySelector(".custom-date__panel");
    const iconBtn = container.querySelector(".custom-date__icon-btn");
    const campo = container.querySelector(".custom-date__field");
    panel.classList.add("hidden");
    iconBtn.setAttribute("aria-expanded", "false");
    campo.classList.remove("custom-date__field--abierto");
  },

  // Mientras se escribe: deja solo dígitos y les inserta las barras "/"
  // en las posiciones dd/mm/aaaa, hasta un máximo de 8 dígitos
  _formatearMientrasEscribe(texto) {
    const digitos = texto.replace(/\D/g, "").slice(0, 8);
    let resultado = digitos;
    if (digitos.length > 4) resultado = `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
    else if (digitos.length > 2) resultado = `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
    return resultado;
  },

  // Convierte "dd/mm/aaaa" a "aaaa-mm-dd" SOLO si es una fecha real
  // (rechaza cosas como 31/02/2026, que "new Date" no siempre detecta sola)
  _textoAIso(texto) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
    if (!match) return null;
    const [, dd, mm, aaaa] = match;
    const dia = Number(dd), mes = Number(mm), anio = Number(aaaa);
    const fecha = new Date(anio, mes - 1, dia);
    const esValida = fecha.getFullYear() === anio && fecha.getMonth() === mes - 1 && fecha.getDate() === dia;
    return esValida ? `${aaaa}-${mm}-${dd}` : null;
  },

  // Arma el HTML interno del calendario (mes, días de la semana, grilla
  // de días y los botones "Borrar"/"Hoy")
  _armarPanelHtml(vista, valorElegido) {
    const anio = vista.getFullYear();
    const mes = vista.getMonth();
    // Lunes = primer día de la semana (getDay() da 0=domingo..6=sábado)
    const primerDiaSemana = (new Date(anio, mes, 1).getDay() + 6) % 7;
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();
    const hoyIso = new Date().toISOString().slice(0, 10);

    let celdas = "";
    for (let i = 0; i < primerDiaSemana; i++) {
      celdas += `<span class="custom-date__day custom-date__day--vacio"></span>`;
    }
    for (let dia = 1; dia <= diasEnMes; dia++) {
      const iso = `${anio}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
      const clases = ["custom-date__day"];
      if (iso === hoyIso) clases.push("is-today");
      if (iso === valorElegido) clases.push("is-selected");
      celdas += `<button type="button" class="${clases.join(" ")}" data-date="${iso}">${dia}</button>`;
    }

    return `
      <div class="custom-date__header">
        <span class="custom-date__month">${this.MESES[mes]} de ${anio}</span>
        <div class="custom-date__nav">
          <button type="button" class="icon-btn icon-btn--sm" data-nav="prev" aria-label="Mes anterior">
            <span class="material-symbols-outlined">chevron_left</span>
          </button>
          <button type="button" class="icon-btn icon-btn--sm" data-nav="next" aria-label="Mes siguiente">
            <span class="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>
      <div class="custom-date__weekdays">${this.DIAS_SEMANA.map((d) => `<span>${d}</span>`).join("")}</div>
      <div class="custom-date__grid">${celdas}</div>
      <div class="custom-date__footer">
        <button type="button" class="text-btn" data-action="borrar">Borrar</button>
        <button type="button" class="text-btn" data-action="hoy">Hoy</button>
      </div>
    `;
  },

  // Actualiza SOLO el texto del <input> tipeable según el valor actual
  // del <input type="date"> oculto (sin disparar "change")
  _actualizarTexto(container) {
    const nativeInput = container.querySelector("input[type='date']");
    const input = container.querySelector(".custom-date__input");
    if (!nativeInput.value) {
      input.value = "";
      return;
    }
    const [anio, mes, dia] = nativeInput.value.split("-");
    input.value = `${dia}/${mes}/${anio}`;
  },

  // Elige una fecha a mano (desde el calendario emergente): actualiza el
  // <input> oculto, el texto tipeable y dispara "change" para que el
  // resto del código (filtros, formularios) reaccione igual que con un
  // <input type="date"> nativo
  setValue(container, iso) {
    const nativeInput = container.querySelector("input[type='date']");
    nativeInput.value = iso || "";
    this._actualizarTexto(container);
    nativeInput.dispatchEvent(new Event("change", { bubbles: true }));
  },

  // Atajo para usar desde app.js/perfil.js/historial.js con el id del
  // <input> oculto (el mismo id que antes tenía el <input type="date">)
  setValueById(idInputOculto, iso) {
    const nativeInput = document.getElementById(idInputOculto);
    if (!nativeInput) return;
    const container = nativeInput.closest(".custom-date");
    if (container) this.setValue(container, iso);
    else nativeInput.value = iso || "";
  },

  // Sincroniza SOLO el texto tipeable con el valor actual, sin disparar
  // "change" (para usar después de un clientForm.reset(), que ya cambió
  // el <input> oculto por su cuenta)
  syncById(idInputOculto) {
    const nativeInput = document.getElementById(idInputOculto);
    if (!nativeInput) return;
    const container = nativeInput.closest(".custom-date");
    if (container) this._actualizarTexto(container);
  },
};

// Cierra cualquier calendario abierto si se hace clic en cualquier otro
// lugar de la página (los botones de DENTRO del calendario —ícono, días,
// "Hoy", "Borrar"— ya frenan la propagación con e.stopPropagation() en
// sus propios handlers, así que no hace falta nada más acá)
document.addEventListener("click", () => {
  document.querySelectorAll(".custom-date__panel").forEach((p) => p.classList.add("hidden"));
  document.querySelectorAll(".custom-date__icon-btn").forEach((b) => b.setAttribute("aria-expanded", "false"));
  document.querySelectorAll(".custom-date__field--abierto").forEach((f) => f.classList.remove("custom-date__field--abierto"));
});

// Engancha automáticamente todos los calendarios presentes al cargar la página
document.querySelectorAll(".custom-date").forEach((el) => CustomDate.init(el));
