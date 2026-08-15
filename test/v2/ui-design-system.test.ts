import { describe, expect, it } from "vitest";
import {
  normalizeUiQuantity,
  renderUiButton,
  renderUiField,
  renderUiMeter,
  renderUiQuantityStepper,
  renderUiSegmentedControl,
} from "../../src/ui/design-system/primitives";
import {
  deriveUiAccentTheme,
  normalizeUiHexColor,
  UI_ACCENT_PRESETS,
  uiAccentStyle,
  uiContrastRatio,
} from "../../src/ui/design-system/theme";

describe("UI design system", () => {
  it("normalizes valid accent colors and rejects values that could escape a style attribute", () => {
    expect(normalizeUiHexColor("6F96C4")).toBe("#6f96c4");
    expect(normalizeUiHexColor("#abc")).toBe("#aabbcc");
    expect(normalizeUiHexColor('#fff; background:url("bad")')).toBeNull();
    expect(uiAccentStyle('#fff; background:url("bad")')).not.toContain("url");
  });

  it("derives readable foregrounds for every preset in both themes", () => {
    for (const mode of ["dark", "light"] as const) {
      for (const preset of UI_ACCENT_PRESETS) {
        const theme = deriveUiAccentTheme(preset, mode);
        expect(uiContrastRatio(theme.accent, theme.onAccent)).toBeGreaterThanOrEqual(4.5);
        expect(uiContrastRatio(theme.accentHover, theme.onAccent)).toBeGreaterThanOrEqual(4.5);
        expect(uiContrastRatio(theme.accentActive, theme.onAccent)).toBeGreaterThanOrEqual(4.5);
        expect(uiContrastRatio(theme.accentSecondary, theme.onAccentSecondary)).toBeGreaterThanOrEqual(4.5);
        expect(theme.accentSubtle).not.toBe(theme.accent);
        expect(theme.accentBorder).not.toBe(theme.accentSubtle);
      }
    }
  });

  it("renders shared control states with native and accessible attributes", () => {
    expect(renderUiButton({ label: "Guardar", variant: "primary", disabled: true })).toContain("ui-button--primary");
    expect(renderUiButton({ label: "Guardar", variant: "primary", disabled: true })).toContain("disabled");
    expect(renderUiField({ id: "amount", label: "Cantidad", error: "Valor inválido" })).toContain('aria-invalid="true"');
    expect(renderUiSegmentedControl({ label: "Modo", value: "buy", options: [{ value: "buy", label: "Comprar" }, { value: "sell", label: "Vender" }] })).toContain('aria-pressed="true"');
    expect(renderUiQuantityStepper({ id: "quantity", label: "Cantidad", value: 20, maximum: 5 })).toContain('value="5"');
    expect(renderUiMeter({ label: "Peso", value: 25, maximum: 100, displayValue: "25/100" })).toContain('role="meter"');
  });

  it("uses one quantity normalization rule", () => {
    expect(normalizeUiQuantity(-3, 0, 5)).toBe(0);
    expect(normalizeUiQuantity(9, 0, 5)).toBe(5);
    expect(normalizeUiQuantity(3.8, 0, 5)).toBe(3);
    expect(normalizeUiQuantity(Number.NaN, 1, 5)).toBe(1);
    expect(normalizeUiQuantity(3, Number.NaN, Number.NaN)).toBe(0);
  });
});
