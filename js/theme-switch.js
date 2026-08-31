/*
 * theme-switch.js
 * Lógica COMPARTIDA de la tuerca de ajustes (tema claro/oscuro), para que
 * esté disponible y se comporte igual en index.html, perfil.html e
 * historial.html: la tuerca es fija en la esquina superior derecha de la
 * pantalla y NUNCA desaparece, se entre a la página que se entre.
 *
 * Este archivo asume que el HTML de #settingsToggle / #settingsPanel /
 * #themeCheckbox (bloque ".settings-fixed") está presente en la página.
 */

const THEME_KEY = "gestorClientes_tema";

const settingsToggle = document.getElementById("settingsToggle");
const settingsPanel = document.getElementById("settingsPanel");
const themeCheckbox = document.getElementById("themeCheckbox");

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeCheckbox.checked = theme === "light"; // checked = derecha = claro/sol
  localStorage.setItem(THEME_KEY, theme);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  applyTheme(saved || (prefersLight ? "light" : "dark"));
}

themeCheckbox.addEventListener("change", () => {
  applyTheme(themeCheckbox.checked ? "light" : "dark");
});

settingsToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  settingsPanel.classList.toggle("hidden");
  settingsToggle.setAttribute("aria-expanded", String(!settingsPanel.classList.contains("hidden")));
});

document.addEventListener("click", (e) => {
  if (!settingsPanel.contains(e.target) && e.target !== settingsToggle) {
    settingsPanel.classList.add("hidden");
  }
});

initTheme();
