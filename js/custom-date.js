/*
 * custom-date.js
 * Reemplaza los <input type="date"> nativos por un calendario propio
 * (bloque .custom-date, ver css/styles.css): el calendario emergente de
 * un <input type="date"> lo dibuja el sistema operativo/navegador y no
 * se le puede tocar el estilo, así que se arma un calendario a mano con
 * la estética de la página (mismos colores, tipografías e íconos).
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
  // llamar sobre el mismo contenedor sin problema (usa ".onclick =").
  init(container) {
    const trigger = container.querySelector(".custom-date__trigger");
    const panel = container.querySelector(".custom-date__panel");
    const nativeInput = container.querySelector("input[type='date']");
    if (!trigger || !panel || !nativeInput) return;

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
          panel.classList.add("hidden");
          trigger.setAttribute("aria-expanded", "false");
        };
      });
      panel.querySelector('[data-action="hoy"]').onclick = (e) => {
        e.stopPropagation();
        const hoyIso = new Date().toISOString().slice(0, 10);
        vista = new Date();
        this.setValue(container, hoyIso);
        panel.classList.add("hidden");
        trigger.setAttribute("aria-expanded", "false");
      };
      panel.querySelector('[data-action="borrar"]').onclick = (e) => {
        e.stopPropagation();
        this.setValue(container, "");
        panel.classList.add("hidden");
        trigger.setAttribute("aria-expanded", "false");
      };
    };

    trigger.onclick = (e) => {
      e.stopPropagation();
      const yaEstabaAbierto = trigger.getAttribute("aria-expanded") === "true";
      // Cierra cualquier otro calendario/desplegable que haya quedado abierto
      document.querySelectorAll(".custom-date__panel").forEach((p) => p.classList.add("hidden"));
      document.querySelectorAll(".custom-date__trigger").forEach((t) => t.setAttribute("aria-expanded", "false"));
      if (!yaEstabaAbierto) {
        vista = nativeInput.value ? new Date(nativeInput.value + "T00:00:00") : new Date();
        pintarPanel();
        panel.classList.remove("hidden");
        trigger.setAttribute("aria-expanded", "true");
      }
    };

    this._actualizarTexto(container);
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

  // Actualiza SOLO el texto/ícono visibles del disparador según el valor
  // actual del <input type="date"> oculto (sin disparar "change")
  _actualizarTexto(container) {
    const nativeInput = container.querySelector("input[type='date']");
    const textoEl = container.querySelector(".custom-date__trigger-text");
    if (!nativeInput.value) {
      textoEl.textContent = "dd/mm/aaaa";
      textoEl.classList.add("custom-date__trigger-text--vacio");
      return;
    }
    const [anio, mes, dia] = nativeInput.value.split("-");
    textoEl.textContent = `${dia}/${mes}/${anio}`;
    textoEl.classList.remove("custom-date__trigger-text--vacio");
  },

  // Elige una fecha a mano: actualiza el <input> oculto, el texto visible
  // y dispara "change" para que el resto del código (filtros, formularios)
  // reaccione igual que con un <input type="date"> nativo
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

  // Sincroniza SOLO el texto visible con el valor actual, sin disparar
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
// lugar de la página
document.addEventListener("click", () => {
  document.querySelectorAll(".custom-date__panel").forEach((p) => p.classList.add("hidden"));
  document.querySelectorAll(".custom-date__trigger").forEach((t) => t.setAttribute("aria-expanded", "false"));
});

// Engancha automáticamente todos los calendarios presentes al cargar la página
document.querySelectorAll(".custom-date").forEach((el) => CustomDate.init(el));
