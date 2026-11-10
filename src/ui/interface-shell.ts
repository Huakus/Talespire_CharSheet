import { preferredInterface, saveInterfacePreference, type InterfaceVersion } from "./interface-preference";
import type { SymbiotePreferences } from "./symbiote-preferences";

interface ShellOptions {
  current: InterfaceVersion;
  preferences: SymbiotePreferences;
  navigate?: (url: string) => void;
}

/** Lives outside the replaceable view. Selection never reloads an active editor. */
export function mountInterfaceShell(root: HTMLElement, options: ShellOptions): { showRecovery(): void } {
  const controls = document.createElement("aside");
  controls.className = "interface-shell";
  controls.setAttribute("aria-label", "Selección de interfaz");
  controls.innerHTML = `<details><summary>Interfaz: ${options.current === "next" ? "Nueva · en pruebas" : "Actual"}</summary>
    <label>Interfaz tras recargar
      <select aria-label="Interfaz tras recargar"><option value="classic">Actual</option><option value="next">Nueva · en pruebas</option></select>
    </label>
    <p>La elección es local. Guardá y terminá las operaciones pendientes antes de cerrar o recargar el symbiote.</p>
    <p role="status" aria-live="polite" data-interface-status></p>
    <button type="button" data-interface-recovery ${options.current === "classic" ? "hidden" : ""}>Volver a la interfaz actual</button>
  </details>`;
  root.before(controls);
  const select = controls.querySelector<HTMLSelectElement>("select")!;
  const status = controls.querySelector<HTMLElement>("[data-interface-status]")!;
  const recovery = controls.querySelector<HTMLButtonElement>("[data-interface-recovery]")!;
  select.value = preferredInterface(options.preferences);
  select.addEventListener("change", () => {
    const target = select.value === "next" ? "next" : "classic";
    if (!saveInterfacePreference(options.preferences, target)) {
      select.value = preferredInterface(options.preferences);
      status.textContent = "No se pudo recordar la elección. La interfaz de esta sesión sigue activa.";
      return;
    }
    // Remove a recovery override only after successfully choosing a future view.
    const url = new URL(window.location.href);
    if (url.searchParams.has("ui")) {
      url.searchParams.delete("ui");
      try { window.history.replaceState(window.history.state, "", url); }
      catch {
        status.textContent = "Elección guardada. El arranque sigue forzado a Actual; abrí el symbiote desde su entrada original para probar Nueva.";
        return;
      }
    }
    status.textContent = target === options.current
      ? "Esta interfaz seguirá seleccionada tras recargar."
      : "Elección guardada para la próxima recarga. Guardá y terminá las operaciones pendientes antes de usar Recargar en TaleSpire; ocultar el panel no aplica el cambio.";
  });
  recovery.addEventListener("click", () => {
    saveInterfacePreference(options.preferences, "classic");
    const url = new URL(window.location.href);
    url.searchParams.set("ui", "classic");
    (options.navigate ?? (target => window.location.assign(target)))(url.href);
  });
  return {
    showRecovery: () => {
      recovery.hidden = false;
      controls.querySelector("details")!.open = true;
      status.textContent = "No se pudo iniciar la vista. Podés volver a la interfaz actual; no se repetirán acciones de juego.";
    },
  };
}
