export function calculateFloatingPanelPosition(
  viewport: { width: number; height: number },
  anchor: { left: number; top: number; bottom: number },
  panel: { width: number; height: number },
  margin = 6,
): { left: number; top: number; maxHeight: number } {
  const maxHeight = Math.max(1, viewport.height - margin * 2);
  const width = Math.min(panel.width, Math.max(1, viewport.width - margin * 2));
  const height = Math.min(panel.height, maxHeight);
  const left = Math.max(margin, Math.min(anchor.left, viewport.width - width - margin));
  const below = anchor.bottom + 4;
  const top = below + height <= viewport.height - margin
    ? below
    : Math.max(margin, Math.min(anchor.top - height - 4, viewport.height - height - margin));
  return { left, top, maxHeight };
}

export function positionFloatingPanel(anchor: HTMLElement, panel: HTMLElement, margin = 6): void {
  panel.style.visibility = "hidden";
  panel.style.position = "fixed";
  panel.style.right = "auto";
  panel.style.bottom = "auto";
  panel.style.left = "0px";
  panel.style.top = "0px";
  panel.style.maxWidth = `calc(100vw - ${margin * 2}px)`;
  const position = calculateFloatingPanelPosition(
    { width: window.innerWidth, height: window.innerHeight },
    anchor.getBoundingClientRect(),
    panel.getBoundingClientRect(),
    margin,
  );
  panel.style.maxHeight = `${position.maxHeight}px`;
  panel.style.overflowY = "auto";
  panel.style.left = `${position.left}px`;
  panel.style.top = `${position.top}px`;
  panel.style.visibility = "visible";
}

export function bindViewportConstrainedDetails(root: ParentNode, detailsSelector: string, panelSelector: string): void {
  root.querySelectorAll<HTMLDetailsElement>(detailsSelector).forEach((details) => {
    const position = (): void => {
      if (!details.open) return;
      const anchor = details.querySelector<HTMLElement>(":scope > summary");
      const panel = details.querySelector<HTMLElement>(panelSelector);
      if (anchor && panel) positionFloatingPanel(anchor, panel);
    };
    details.addEventListener("toggle", position);
    if (details.open) position();
  });
}
