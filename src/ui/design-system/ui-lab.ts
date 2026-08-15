import "./tokens.css";
import "./primitives.css";
import "./ui-lab.css";
import {
  normalizeUiQuantity,
  renderUiBadge,
  renderUiButton,
  renderUiEmptyState,
  renderUiField,
  renderUiIconButton,
  renderUiMessage,
  renderUiMeter,
  renderUiQuantityStepper,
  renderUiSelect,
  renderUiSegmentedControl,
  renderUiTextarea,
} from "./primitives";
import {
  deriveUiAccentTheme,
  normalizeUiHexColor,
  UI_ACCENT_PRESETS,
  uiAccentStyle,
  uiContrastRatio,
  type UiThemeMode,
} from "./theme";

const rootElement = document.querySelector<HTMLElement>("#ui-lab");
if (!rootElement) throw new Error("UI Lab root not found.");
const root: HTMLElement = rootElement;

let mode: UiThemeMode = "dark";
let accent = "#c5ad6a";
let segment = "buy";
let quantity = 2;

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function render(): void {
  const theme = deriveUiAccentTheme(accent, mode);
  const variants = [
    ["Acento", theme.accent, theme.onAccent],
    ["Hover", theme.accentHover, theme.onAccent],
    ["Activo", theme.accentActive, theme.onAccent],
    ["Secundario", theme.accentSecondary, theme.onAccentSecondary],
    ["Borde", theme.accentBorder, mode === "dark" ? "#f8faf6" : "#101410"],
    ["Sutil", theme.accentSubtle, mode === "dark" ? "#f8faf6" : "#101410"],
  ] as const;
  root.dataset.uiTheme = mode;
  root.setAttribute("style", uiAccentStyle(accent, mode));
  root.innerHTML = `<div class="ui-lab-shell">
    <header class="ui-lab-header"><div><small>Sistema de diseño</small><h1>TaleSpire UI Lab</h1><p>Referencia aislada de tokens, controles, estados y contraste.</p></div><div class="ui-lab-theme-actions">${renderUiButton({ label: "Oscuro", variant: mode === "dark" ? "primary" : "secondary", pressed: mode === "dark", attributes: { "data-lab-theme": "dark" } })}${renderUiButton({ label: "Claro", variant: mode === "light" ? "primary" : "secondary", pressed: mode === "light", attributes: { "data-lab-theme": "light" } })}</div></header>

    <section class="ui-lab-panel"><div class="ui-lab-heading"><div><small>Fundación</small><h2>Color configurable</h2></div><code>${escapeHtml(theme.accent)}</code></div>
      <div class="ui-lab-color-controls"><div class="ui-lab-presets">${UI_ACCENT_PRESETS.map((color) => `<button type="button" data-lab-accent="${color}" aria-label="Usar ${color}" aria-pressed="${color === theme.accent}" style="--lab-swatch:${color}"></button>`).join("")}</div><form data-lab-accent-form>${renderUiField({ id: "lab-accent", label: "Color hexadecimal", value: theme.accent, size: "compact", hint: "Se acepta #RRGGBB o #RGB." })}${renderUiButton({ label: "Aplicar", variant: "primary", size: "compact", type: "submit" })}</form></div>
      <div class="ui-lab-swatches">${variants.map(([label, color, foreground]) => `<article style="--lab-color:${color};--lab-foreground:${foreground}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(color)}</strong><small>Contraste ${uiContrastRatio(color, foreground).toFixed(2)}:1</small></article>`).join("")}</div>
    </section>

    <div class="ui-lab-grid">
      <section class="ui-lab-panel"><div class="ui-lab-heading"><div><small>Primitiva</small><h2>Botones</h2></div></div><div class="ui-lab-control-row">${renderUiButton({ label: "Confirmar", variant: "primary" })}${renderUiButton({ label: "Secundario" })}${renderUiButton({ label: "Baja prominencia", variant: "ghost" })}${renderUiButton({ label: "Eliminar", variant: "danger" })}${renderUiButton({ label: "Deshabilitado", disabled: true })}</div><div class="ui-lab-control-row">${renderUiButton({ label: "Compacto", variant: "primary", size: "compact" })}${renderUiButton({ label: "Alternativa", size: "compact" })}</div></section>

      <section class="ui-lab-panel"><div class="ui-lab-heading"><div><small>Primitiva</small><h2>Campos</h2></div></div><div class="ui-lab-fields">${renderUiField({ id: "lab-name", label: "Nombre", value: "Daga ceremonial", hint: "Texto de ayuda breve." })}${renderUiField({ id: "lab-search", label: "Buscar", type: "search", value: "", attributes: { placeholder: "Nombre, tipo, propiedad…" } })}${renderUiField({ id: "lab-error", label: "Cantidad", type: "number", value: -1, error: "La cantidad debe ser positiva." })}${renderUiField({ id: "lab-disabled", label: "No editable", value: "Bloqueado", disabled: true })}</div></section>

      <section class="ui-lab-panel"><div class="ui-lab-heading"><div><small>Composición</small><h2>Selección y cantidad</h2></div></div>${renderUiSegmentedControl({ label: "Tipo de intercambio", value: segment, options: [{ value: "buy", label: "Comprar", meta: "2 en carrito" }, { value: "sell", label: "Vender", meta: "1 en carrito" }] })}<div class="ui-lab-quantity-row">${renderUiQuantityStepper({ id: "lab-quantity", label: "Cantidad a intercambiar", value: quantity, maximum: 5 })}<p>El control representa min, max y disabled; la pantalla consumidora determina esos valores.</p></div></section>

      <section class="ui-lab-panel"><div class="ui-lab-heading"><div><small>Primitiva</small><h2>Medidores</h2></div></div><div class="ui-lab-meters">${renderUiMeter({ label: "Dinero personaje", value: 640, maximum: 1_000, displayValue: "6 PO · 4 PP", meta: "+2 PO", tone: "accent" })}${renderUiMeter({ label: "Dinero comerciante", value: 820, maximum: 1_000, displayValue: "8 PO · 2 PP", meta: "−2 PO", tone: "secondary" })}${renderUiMeter({ label: "Peso", value: 37.5, maximum: 150, displayValue: "37.5/150 lb", meta: "25%", segments: [{ label: "Armas", value: 12, tone: "secondary" }, { label: "Armadura", value: 18, tone: "info" }, { label: "Equipo", value: 7.5, tone: "success" }] })}${renderUiMeter({ label: "Sobrecarga", value: 165, maximum: 150, displayValue: "165/150 lb", meta: "110%", tone: "danger" })}</div></section>

      <section class="ui-lab-panel"><div class="ui-lab-heading"><div><small>Semántica</small><h2>Badges y estados</h2></div></div><div class="ui-lab-control-row">${renderUiBadge("Neutral")}${renderUiBadge("Acento", "accent")}${renderUiBadge("Sincronizado", "success")}${renderUiBadge("Pendiente", "warning")}${renderUiBadge("Conflicto", "danger")}</div><p class="ui-lab-state ui-lab-state--success"><strong>Guardado</strong><span>Los cambios fueron sincronizados.</span></p><p class="ui-lab-state ui-lab-state--danger"><strong>Error</strong><span>No se pudo completar la operación.</span></p></section>

      <section class="ui-lab-panel"><div class="ui-lab-heading"><div><small>Composición</small><h2>Diálogo</h2></div></div><div class="ui-lab-dialog"><header><div><small>Confirmación</small><strong>Intercambio con Mirna</strong></div>${renderUiButton({ label: "Cerrar", variant: "ghost", size: "compact", attributes: { "aria-label": "Cerrar diálogo" } })}</header><p>Los diálogos reutilizan superficie, encabezado, espaciado y jerarquía de acciones.</p><footer>${renderUiButton({ label: "Cancelar" })}${renderUiButton({ label: "Confirmar", variant: "primary" })}</footer></div></section>
      <section class="ui-lab-panel"><div class="ui-lab-heading"><div><small>Primitivas</small><h2>Formularios y feedback</h2></div>${renderUiIconButton({ icon: "?", label: "Ayuda" })}</div><div class="ui-lab-fields">${renderUiSelect({ id: "lab-category", label: "Categoría", value: "weapon", options: [{ value: "weapon", label: "Arma" }, { value: "armor", label: "Armadura" }, { value: "tool", label: "Herramienta" }] })}${renderUiTextarea({ id: "lab-notes", label: "Notas", value: "Una descripción breve.", hint: "El mismo contrato se usa en editores y formularios." })}</div>${renderUiMessage({ tone: "success", title: "Sincronizado", text: "El estado remoto está actualizado." })}${renderUiMessage({ tone: "warning", title: "Revisión necesaria", text: "Hay cambios pendientes de confirmar." })}${renderUiEmptyState({ title: "Sin resultados", text: "Probá con otro nombre o limpiá los filtros." })}</section>
    </div>
  </div>`;
  bindEvents();
}

function bindEvents(): void {
  root.querySelectorAll<HTMLButtonElement>("[data-lab-theme]").forEach((button) => button.addEventListener("click", () => {
    mode = button.dataset.labTheme === "light" ? "light" : "dark";
    render();
  }));
  root.querySelectorAll<HTMLButtonElement>("[data-lab-accent]").forEach((button) => button.addEventListener("click", () => {
    accent = normalizeUiHexColor(button.dataset.labAccent ?? "") ?? accent;
    render();
  }));
  root.querySelector<HTMLFormElement>("[data-lab-accent-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const next = normalizeUiHexColor(root.querySelector<HTMLInputElement>("#lab-accent")?.value ?? "");
    if (next) accent = next;
    render();
  });
  root.querySelectorAll<HTMLButtonElement>("[data-ui-segment-value]").forEach((button) => button.addEventListener("click", () => {
    segment = button.dataset.uiSegmentValue ?? segment;
    render();
  }));
  root.querySelectorAll<HTMLButtonElement>("[data-ui-quantity-step]").forEach((button) => button.addEventListener("click", () => {
    quantity = normalizeUiQuantity(quantity + Number(button.dataset.uiQuantityStep), 0, 5);
    render();
  }));
  root.querySelector<HTMLInputElement>("#lab-quantity")?.addEventListener("change", (event) => {
    quantity = normalizeUiQuantity(Number((event.currentTarget as HTMLInputElement).value), 0, 5);
    render();
  });
}

render();
