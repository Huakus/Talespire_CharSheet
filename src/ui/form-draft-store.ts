type DraftControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

interface DraftValue {
  value: string;
  checked?: boolean;
}

function inputControl(control: DraftControl): HTMLInputElement | null {
  return control.tagName === "INPUT" ? control as HTMLInputElement : null;
}

export class FormDraftStore {
  private readonly drafts = new Map<string, Map<string, DraftValue[]>>();

  has(key: string): boolean {
    return this.drafts.has(key);
  }

  clear(key: string): void {
    this.drafts.delete(key);
  }

  bind(form: HTMLFormElement | null, key: string, onDirty?: () => void): void {
    if (!form) return;
    this.restore(form, key);
    const capture = (): void => {
      this.capture(form, key);
      onDirty?.();
    };
    form.addEventListener("input", capture);
    form.addEventListener("change", capture);
  }

  capture(form: HTMLFormElement, key: string): void {
    const values = new Map<string, DraftValue[]>();
    for (const control of form.querySelectorAll<DraftControl>("[name]")) {
      const input = inputControl(control);
      if (!control.name || input?.type === "file") continue;
      const entries = values.get(control.name) ?? [];
      entries.push({
        value: control.value,
        ...(input && (input.type === "checkbox" || input.type === "radio") ? { checked: input.checked } : {}),
      });
      values.set(control.name, entries);
    }
    this.drafts.set(key, values);
  }

  restore(form: HTMLFormElement, key: string): boolean {
    const values = this.drafts.get(key);
    if (!values) return false;
    const indexes = new Map<string, number>();
    for (const control of form.querySelectorAll<DraftControl>("[name]")) {
      const index = indexes.get(control.name) ?? 0;
      indexes.set(control.name, index + 1);
      const saved = values.get(control.name)?.[index];
      if (!saved) continue;
      control.value = saved.value;
      const input = inputControl(control);
      if (saved.checked !== undefined && input) input.checked = saved.checked;
    }
    return true;
  }
}
