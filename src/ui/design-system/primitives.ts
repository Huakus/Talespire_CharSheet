type UiAttributeValue = string | number | boolean | undefined;
type UiAttributes = Readonly<Record<string, UiAttributeValue>>;

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function renderAttributes(attributes: UiAttributes = {}): string {
  return Object.entries(attributes).flatMap(([name, value]) => {
    if (!/^(aria-[a-z-]+|data-[a-z-]+|id|name|title|value|min|max|step|placeholder|inputmode|autocomplete)$/.test(name) || value === undefined || value === false) return [];
    return [value === true ? name : `${name}="${escapeHtml(String(value))}"`];
  }).join(" ");
}

export type UiButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type UiControlSize = "compact" | "default";
export type UiTone = "accent" | "secondary" | "neutral" | "success" | "warning" | "danger" | "info";

export function renderUiButton(input: {
  label: string;
  variant?: UiButtonVariant;
  size?: UiControlSize;
  type?: "button" | "submit";
  disabled?: boolean;
  pressed?: boolean;
  attributes?: UiAttributes;
}): string {
  const variant = input.variant ?? "secondary";
  const size = input.size ?? "default";
  const attributes = renderAttributes({ ...input.attributes, ...(input.pressed === undefined ? {} : { "aria-pressed": input.pressed }) });
  return `<button type="${input.type ?? "button"}" class="ui-button ui-button--${variant} ui-control--${size}" ${attributes} ${input.disabled ? "disabled" : ""}>${escapeHtml(input.label)}</button>`;
}

export function renderUiField(input: {
  id: string;
  label: string;
  value?: string | number;
  type?: "text" | "number" | "search";
  size?: UiControlSize;
  hint?: string;
  error?: string;
  disabled?: boolean;
  attributes?: UiAttributes;
}): string {
  const size = input.size ?? "default";
  const descriptionId = input.error || input.hint ? `${input.id}-description` : undefined;
  const attributes = renderAttributes({
    ...input.attributes,
    id: input.id,
    value: input.value ?? "",
    ...(descriptionId ? { "aria-describedby": descriptionId } : {}),
    ...(input.error ? { "aria-invalid": "true" } : {}),
  });
  const description = input.error ?? input.hint;
  return `<label class="ui-field ${input.error ? "ui-field--error" : ""}" for="${escapeHtml(input.id)}"><span>${escapeHtml(input.label)}</span><input type="${input.type ?? "text"}" class="ui-input ui-control--${size}" ${attributes} ${input.disabled ? "disabled" : ""}>${description ? `<small id="${escapeHtml(descriptionId!)}">${escapeHtml(description)}</small>` : ""}</label>`;
}

export function renderUiSegmentedControl(input: {
  label: string;
  value: string;
  options: readonly { value: string; label: string; meta?: string; disabled?: boolean }[];
  attributes?: UiAttributes;
}): string {
  return `<div class="ui-segmented" role="group" aria-label="${escapeHtml(input.label)}" ${renderAttributes(input.attributes)}>${input.options.map((option) => {
    const active = option.value === input.value;
    return `<button type="button" data-ui-segment-value="${escapeHtml(option.value)}" aria-pressed="${active}" ${option.disabled ? "disabled" : ""}><span>${escapeHtml(option.label)}</span>${option.meta ? `<small>${escapeHtml(option.meta)}</small>` : ""}</button>`;
  }).join("")}</div>`;
}

export function normalizeUiQuantity(value: number, minimum: number, maximum: number): number {
  const normalizedMinimum = Number.isFinite(minimum) ? Math.trunc(minimum) : 0;
  const normalizedMaximum = Number.isFinite(maximum) ? Math.max(normalizedMinimum, Math.trunc(maximum)) : normalizedMinimum;
  if (!Number.isFinite(value)) return normalizedMinimum;
  return Math.min(normalizedMaximum, Math.max(normalizedMinimum, Math.trunc(value)));
}

export function renderUiQuantityStepper(input: {
  id: string;
  label: string;
  value: number;
  minimum?: number;
  maximum: number;
  disabled?: boolean;
  attributes?: UiAttributes;
}): string {
  const minimum = Math.trunc(input.minimum ?? 0);
  const maximum = Math.max(minimum, Math.trunc(input.maximum));
  const value = normalizeUiQuantity(input.value, minimum, maximum);
  return `<div class="ui-quantity" aria-label="${escapeHtml(input.label)}" ${renderAttributes(input.attributes)}><div><button type="button" data-ui-quantity-step="-1" aria-label="Reducir ${escapeHtml(input.label)}" ${input.disabled || value <= minimum ? "disabled" : ""}>−</button><button type="button" data-ui-quantity-step="1" aria-label="Aumentar ${escapeHtml(input.label)}" ${input.disabled || value >= maximum ? "disabled" : ""}>+</button></div><input id="${escapeHtml(input.id)}" type="number" inputmode="numeric" min="${minimum}" max="${maximum}" step="1" value="${value}" aria-label="${escapeHtml(input.label)}" ${input.disabled ? "disabled" : ""}><small>de ${maximum}</small></div>`;
}

export function renderUiMeter(input: {
  label: string;
  value: number;
  maximum: number;
  displayValue: string;
  meta?: string;
  tone?: Exclude<UiTone, "neutral" | "info">;
  segments?: readonly { label: string; value: number; tone?: UiTone }[];
  attributes?: UiAttributes;
}): string {
  const maximum = Number.isFinite(input.maximum) ? Math.max(0, input.maximum) : 0;
  const value = Number.isFinite(input.value) ? Math.max(0, input.value) : 0;
  const percentage = maximum > 0 ? Math.min(100, value / maximum * 100) : 0;
  const segments = input.segments?.length
    ? input.segments.map((segment) => `<i data-ui-meter-tone="${segment.tone ?? "accent"}" style="--ui-meter-segment:${maximum > 0 && Number.isFinite(segment.value) ? Math.max(0, segment.value) / maximum * 100 : 0}%" title="${escapeHtml(segment.label)}"></i>`).join("")
    : `<i style="--ui-meter-segment:${percentage}%"></i>`;
  return `<div class="ui-meter ui-meter--${input.tone ?? "accent"}" role="meter" aria-label="${escapeHtml(input.label)}" aria-valuemin="0" aria-valuemax="${maximum}" aria-valuenow="${value}" ${renderAttributes(input.attributes)}><div class="ui-meter__composition" aria-hidden="true">${segments}</div><span>${escapeHtml(input.label)}</span><strong>${escapeHtml(input.displayValue)}</strong>${input.meta ? `<em>${escapeHtml(input.meta)}</em>` : ""}</div>`;
}

export function renderUiBadge(label: string, tone: Exclude<UiTone, "secondary" | "info"> = "neutral"): string {
  return `<span class="ui-badge ui-badge--${tone}">${escapeHtml(label)}</span>`;
}
