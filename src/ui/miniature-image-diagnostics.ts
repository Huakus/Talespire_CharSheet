import type { AppBuildInfo } from "../build-info";
import type { MiniatureImageDiagnostic } from "../infrastructure/talespire/talespire-miniature";

export interface MiniatureImageReport {
  build: AppBuildInfo;
  capturedAt: string;
  thumbnailLoaderAvailable: boolean;
  capabilities: Record<string, boolean>;
  participants: Array<{
    creatureId: string;
    name: string;
    native?: MiniatureImageDiagnostic;
    failure?: { attempt: number; reason: string; retryInMs: number | null };
    display: ReturnType<typeof inspectMiniatureImage>;
  }>;
}

// Inspect geometry and resource readiness without reading canvas pixels or copying
// resource URLs (which may contain private or temporary credentials).
export function inspectMiniatureImage(slot: HTMLElement | null) {
  const element = slot?.querySelector<HTMLElement>(".gm-miniature-render") ?? null;
  const bounds = element?.getBoundingClientRect();
  const images = element ? [element, ...element.querySelectorAll("img")].filter((node) => node.tagName === "IMG") as HTMLImageElement[] : [];
  const canvases = element ? [element, ...element.querySelectorAll("canvas")].filter((node) => node.tagName === "CANVAS") as HTMLCanvasElement[] : [];
  return {
    state: slot?.dataset.miniatureImageState ?? (slot ? "not-requested" : "not-mounted"),
    elementTag: element?.tagName ?? null,
    connected: element?.isConnected ?? false,
    width: bounds?.width ?? 0, height: bounds?.height ?? 0,
    images: images.map((image) => ({ complete: image.complete, naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight, hasSource: Boolean(image.currentSrc || image.getAttribute("src") || image.getAttribute("srcset")) })),
    canvases: canvases.map((canvas) => ({ width: canvas.width, height: canvas.height })),
  };
}

const stageLabels: Record<string, string> = {
  "creature-info": "Datos de la miniatura", "active-model": "Modelo activo",
  "content-packs": "Paquetes de contenido", "content-pack-info": "Datos de los paquetes",
  "model-lookup": "Búsqueda del modelo", thumbnail: "Creación de la imagen",
  "element-returned": "Elemento recibido de TaleSpire",
};

function summary(entry: MiniatureImageReport["participants"][number]): string {
  const stage = entry.native ? stageLabels[entry.native.stage] ?? entry.native.stage : "Sin diagnóstico de la API";
  if (entry.failure || entry.native?.status === "error") return `${stage}: ${entry.failure?.reason ?? entry.native?.error}`;
  if (entry.native?.status === "loading") return `Cargando: ${stage}`;
  if (!entry.display.elementTag) return `${stage}. No hay una imagen insertada en la tarjeta.`;
  if (entry.display.images.some((image) => !image.hasSource)) return `${stage}. La imagen recibida no tiene una fuente asignada.`;
  if (entry.display.images.some((image) => image.complete && !image.naturalWidth)) return `${stage}. La imagen no tiene contenido cargado.`;
  if (entry.display.images.some((image) => !image.complete)) return `${stage}. El recurso de imagen sigue cargando.`;
  if (!entry.display.width || !entry.display.height) return `${stage}. El elemento ocupa 0 píxeles en pantalla.`;
  return `${stage}. Tamaño visible: ${Math.round(entry.display.width)} × ${Math.round(entry.display.height)} px. Esto no confirma que el dibujo sea correcto.`;
}

export function openMiniatureImageDiagnostics(getReport: () => MiniatureImageReport, retry: () => void): () => void {
  const previousFocus = document.activeElement;
  const dialog = document.createElement("dialog");
  dialog.className = "issue-report-dialog miniature-image-diagnostics";
  dialog.setAttribute("aria-labelledby", "miniature-image-diagnostics-title");
  dialog.innerHTML = `<form method="dialog">
    <header><h2 id="miniature-image-diagnostics-title">Diagnóstico de imágenes</h2><button type="submit" class="secondary-button">Cerrar</button></header>
    <p class="issue-context-status">Muestra dónde se detiene la carga automática y si el elemento recibido tiene contenido y espacio en la tarjeta.</p>
    <p data-image-build class="issue-context-status"></p>
    <ul data-image-status></ul>
    <label>Informe técnico<textarea data-image-report readonly rows="9" spellcheck="false"></textarea></label>
    <p data-image-feedback class="issue-report-feedback" role="status"></p>
    <footer><button type="button" class="secondary-button" data-image-refresh>Actualizar diagnóstico</button><button type="button" class="secondary-button" data-image-retry>Reintentar imágenes</button><button type="button" data-image-copy>Copiar informe</button></footer>
  </form>`;
  const reportField = dialog.querySelector<HTMLTextAreaElement>("[data-image-report]")!;
  const feedback = dialog.querySelector<HTMLElement>("[data-image-feedback]")!;
  const refresh = () => {
    const report = getReport();
    reportField.value = JSON.stringify(report, null, 2);
    dialog.querySelector("[data-image-build]")!.textContent = `Versión ${report.build.version} · ${report.build.sourceHash ?? "desarrollo"} · Compilación ${report.build.builtAt ?? "local"}`;
    const list = dialog.querySelector("[data-image-status]")!;
    list.replaceChildren();
    const add = (title: string, text: string) => {
      const item = document.createElement("li");
      const heading = document.createElement("strong"); heading.textContent = title;
      const detail = document.createElement("p"); detail.textContent = text;
      item.append(heading, detail); list.append(item);
    };
    if (!report.thumbnailLoaderAvailable) add("API no disponible", "La carga de imágenes no está conectada en esta sesión.");
    const missing = Object.entries(report.capabilities).filter(([, available]) => !available).map(([name]) => name);
    if (missing.length) add("Funciones de TaleSpire ausentes", missing.join(", "));
    for (const entry of report.participants) add(entry.name, summary(entry));
    if (!report.participants.length) add("Sin participantes", "Agregá miniaturas a la cola de turnos de TaleSpire.");
  };
  dialog.querySelector("[data-image-refresh]")!.addEventListener("click", refresh);
  dialog.querySelector("[data-image-retry]")!.addEventListener("click", () => {
    retry(); refresh();
    feedback.textContent = "Carga solicitada. Pulsá Actualizar diagnóstico para consultar el resultado.";
  });
  dialog.querySelector("[data-image-copy]")!.addEventListener("click", () => {
    // Keep the displayed snapshot stable while the user selects or copies it.
    void (async () => {
      try {
        await navigator.clipboard.writeText(reportField.value);
        feedback.textContent = "Informe copiado.";
      } catch {
        reportField.focus(); reportField.select();
        feedback.textContent = "No se pudo acceder al portapapeles. El informe está seleccionado: presioná Ctrl+C.";
      }
    })();
  });
  dialog.addEventListener("close", () => {
    dialog.remove();
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
  });
  document.body.append(dialog);
  refresh();
  dialog.showModal();
  return () => { if (dialog.isConnected) dialog.close(); };
}
