/*
 * custom-select.js
 * Reemplaza los <select> nativos por un menú desplegable propio (bloque
 * .custom-select, ver css/styles.css): permite que cada opción tenga su
 * propio ícono y que la opción elegida se pinte del morado de la marca
 * en vez del celeste que pone el navegador por defecto.
 *
 * El valor real sigue viviendo en un <input type="hidden"> con el mismo
 * id que antes tenía el <select>, así el resto del código (filtros,
 * lectura/escritura de formularios) sigue funcionando exactamente igual,
 * ya sea leyendo ".value" o escuchando el evento "change".
 *
 * Se carga en index.html, perfil.html e historial.html, ANTES que
 * app.js / perfil.js / historial.js (que son quienes usan CustomSelect.setValueById
 * para completar el desplegable a mano, por ejemplo al abrir el modal de edición).
 */

const CustomSelect = {
  // Engancha los eventos de abrir/cerrar/elegir de UN desplegable puntual.
  // Se puede volver a llamar sobre el mismo contenedor después de
  // regenerar sus opciones a mano (ver app.js: refreshEstadoCivilOptions),
  // porque usa ".onclick =" en vez de "addEventListener" (no se acumulan
  // listeners repetidos si se inicializa más de una vez).
  init(container) {
    const trigger = container.querySelector(".custom-select__trigger");
    const optionsList = container.querySelector(".custom-select__options");
    if (!trigger || !optionsList) return;

    trigger.onclick = (e) => {
      e.stopPropagation();
      const yaEstabaAbierto = trigger.getAttribute("aria-expanded") === "true";
      // Cierra cualquier otro desplegable que haya quedado abierto
      document.querySelectorAll(".custom-select__options").forEach((el) => el.classList.add("hidden"));
      document
        .querySelectorAll(".custom-select__trigger")
        .forEach((t) => t.setAttribute("aria-expanded", "false"));
      if (!yaEstabaAbierto) {
        optionsList.classList.remove("hidden");
        trigger.setAttribute("aria-expanded", "true");
      }
    };

    optionsList.querySelectorAll(".custom-select__option").forEach((opcion) => {
      opcion.onclick = () => {
        this.setValue(container, opcion.dataset.value, opcion);
        optionsList.classList.add("hidden");
        trigger.setAttribute("aria-expanded", "false");
      };
    });
  },

  // Marca una opción como elegida a mano (por ejemplo, al completar el
  // formulario de edición con los datos ya guardados, o al limpiar
  // filtros) y dispara un evento "change" en el <input> oculto para que
  // el resto del código (que escucha ese evento) siga funcionando igual
  // que con un <select> nativo.
  setValue(container, valor, opcionEl = null) {
    const hiddenInput = container.querySelector("input[type='hidden']");
    const triggerTexto = container.querySelector(".custom-select__trigger-text");
    const triggerIcono = container.querySelector(".custom-select__trigger-icon");
    const opcion =
      opcionEl || container.querySelector(`.custom-select__option[data-value="${CSS.escape(valor ?? "")}"]`);

    hiddenInput.value = valor ?? "";

    if (opcion) {
      triggerTexto.textContent = opcion.textContent.trim();
      const iconoOpcion = opcion.querySelector(".material-symbols-outlined");
      if (iconoOpcion && triggerIcono) triggerIcono.textContent = iconoOpcion.textContent;
      container.querySelectorAll(".custom-select__option").forEach((o) => o.classList.remove("selected"));
      opcion.classList.add("selected");
    }

    hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
  },

  // Atajo para usar desde app.js/perfil.js/historial.js: en vez de tener
  // que buscar el contenedor .custom-select a mano, alcanza con el id
  // del <input> oculto (el mismo id que antes tenía el <select>).
  setValueById(idInputOculto, valor) {
    const hiddenInput = document.getElementById(idInputOculto);
    if (!hiddenInput) return;
    const container = hiddenInput.closest(".custom-select");
    if (container) this.setValue(container, valor);
    else hiddenInput.value = valor ?? ""; // por si acaso, para no romper nada
  },
};

// Cierra cualquier desplegable abierto si se hace clic en cualquier otro
// lugar de la página
document.addEventListener("click", () => {
  document.querySelectorAll(".custom-select__options").forEach((el) => el.classList.add("hidden"));
  document.querySelectorAll(".custom-select__trigger").forEach((t) => t.setAttribute("aria-expanded", "false"));
});

// Engancha automáticamente todos los desplegables presentes al cargar la página
document.querySelectorAll(".custom-select").forEach((el) => CustomSelect.init(el));
