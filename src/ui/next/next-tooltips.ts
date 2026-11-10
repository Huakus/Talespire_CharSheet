let tooltipSequence = 0;

/** Local hover/focus help; no CDN, global viewer runtime or game commands. */
export class NextTooltips {
  private readonly tooltip: HTMLDivElement;
  private target: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly window: Window | null;
  private readonly over = (event: Event) => {
    if (this.tooltip.contains(event.target as Node)) { clearTimeout(this.timer); return; }
    const target = (event.target as Element).closest<HTMLElement>("[data-next-tip]");
    if (target && this.root.contains(target)) this.show(target);
  };
  private readonly out = (event: Event) => {
    const related = (event as MouseEvent).relatedTarget as Node | null;
    if (related && (this.target?.contains(related) || this.tooltip.contains(related))) return;
    this.timer = setTimeout(() => this.hide(), 160);
  };
  private readonly focus = (event: Event) => {
    const target = (event.target as Element).closest<HTMLElement>("[data-next-tip]");
    if (target) this.show(target); else this.hide();
  };
  private readonly blur = () => this.hide();
  private readonly keydown = (event: Event) => { if ((event as KeyboardEvent).key === "Escape") this.hide(); };
  private readonly position = () => {
    if (!this.target || this.tooltip.hidden || !this.window) return;
    const rect = this.target.getBoundingClientRect(), width = this.tooltip.offsetWidth, height = this.tooltip.offsetHeight;
    this.tooltip.style.left = Math.max(8, Math.min(this.window.innerWidth - width - 8, rect.left)) + "px";
    this.tooltip.style.top = (rect.bottom + height + 16 <= this.window.innerHeight ? rect.bottom + 8 : Math.max(8, rect.top - height - 8)) + "px";
  };
  constructor(private readonly root: HTMLElement) {
    this.window = root.ownerDocument.defaultView;
    this.tooltip = root.ownerDocument.createElement("div");
    this.tooltip.id = `next-statistic-tooltip-${++tooltipSequence}`;
    this.tooltip.className = "ns-tooltip";
    this.tooltip.setAttribute("role", "tooltip");
    this.tooltip.hidden = true;
    for (const [name, handler] of this.listeners()) root.addEventListener(name, handler);
    this.window?.addEventListener("scroll", this.position, true);
    this.window?.addEventListener("resize", this.position);
  }
  private listeners(): [string, EventListener][] { return [["pointerover", this.over], ["pointerout", this.out], ["focusin", this.focus], ["focusout", this.blur], ["keydown", this.keydown]]; }
  afterRender(): void { this.hide(); (this.root.querySelector(".next-interface") ?? this.root).append(this.tooltip); }
  private show(target: HTMLElement): void {
    clearTimeout(this.timer);
    if (this.target === target && !this.tooltip.hidden) return;
    this.hide();
    this.target = target;
    this.tooltip.textContent = target.dataset.nextTip ?? "";
    const ids = new Set((target.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean));
    ids.add(this.tooltip.id);
    target.setAttribute("aria-describedby", [...ids].join(" "));
    this.tooltip.hidden = false;
    this.position();
  }
  hide(): void {
    clearTimeout(this.timer);
    if (this.target) {
      const ids = (this.target.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(id => id && id !== this.tooltip.id);
      if (ids.length) this.target.setAttribute("aria-describedby", ids.join(" ")); else this.target.removeAttribute("aria-describedby");
    }
    this.target = null;
    this.tooltip.hidden = true;
  }
  stop(): void {
    this.hide(); this.tooltip.remove();
    for (const [name, handler] of this.listeners()) this.root.removeEventListener(name, handler);
    this.window?.removeEventListener("scroll", this.position, true);
    this.window?.removeEventListener("resize", this.position);
  }
}
