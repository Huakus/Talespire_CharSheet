export type CheckboxChoice = string | { value: string; label: string };

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function renderCheckboxGroup(
  label: string,
  name: string,
  choices: readonly CheckboxChoice[],
  selected: readonly string[],
): string {
  const selectedKeys = new Set(selected.map((value) => value.trim().toLocaleLowerCase()));
  const normalized = choices.map((choice) => typeof choice === "string" ? { value: choice, label: choice } : choice);
  const known = new Set(normalized.map((choice) => choice.value));
  const all = [...normalized, ...selected.filter((value) => !known.has(value)).map((value) => ({ value, label: value }))];
  const options = all.map((choice) => `<label><input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(choice.value)}" ${selectedKeys.has(choice.value.trim().toLocaleLowerCase()) ? "checked" : ""}><span>${escapeHtml(choice.label)}</span></label>`).join("");
  return `<fieldset class="gm-checkbox-group"><legend>${escapeHtml(label)}</legend><div>${options || '<span class="muted">Sin opciones disponibles</span>'}</div></fieldset>`;
}
