export type UiThemeMode = "dark" | "light";

export const UI_DEFAULT_ACCENT = "#d9bd73";
export const UI_ACCENT_PRESETS = [
  "#c98282", "#d09a68", "#c5ad6a", "#79a879", "#6fae9f",
  "#6f96c4", "#8f83bc", "#c982a6", "#9a73ad", "#9da79a",
] as const;

interface RgbColor { red: number; green: number; blue: number }
interface HslColor { hue: number; saturation: number; lightness: number }

export interface UiAccentTheme {
  accent: string;
  accentHover: string;
  accentActive: string;
  accentSubtle: string;
  accentSurface: string;
  accentBorder: string;
  accentSecondary: string;
  onAccent: string;
  onAccentSecondary: string;
  focusRing: string;
}

export function normalizeUiHexColor(input: string): string | null {
  const prefixed = input.trim().startsWith("#") ? input.trim() : `#${input.trim()}`;
  if (/^#[0-9a-f]{6}$/i.test(prefixed)) return prefixed.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(prefixed)) {
    return `#${[...prefixed.slice(1)].map((digit) => `${digit}${digit}`).join("")}`.toLowerCase();
  }
  return null;
}

function rgbFromHex(input: string): RgbColor {
  const color = normalizeUiHexColor(input) ?? UI_DEFAULT_ACCENT;
  return {
    red: Number.parseInt(color.slice(1, 3), 16),
    green: Number.parseInt(color.slice(3, 5), 16),
    blue: Number.parseInt(color.slice(5, 7), 16),
  };
}

function hexFromRgb(color: RgbColor): string {
  const channel = (value: number): string => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0");
  return `#${channel(color.red)}${channel(color.green)}${channel(color.blue)}`;
}

function mixHex(from: string, to: string, toShare: number): string {
  const start = rgbFromHex(from);
  const end = rgbFromHex(to);
  const share = Math.min(1, Math.max(0, toShare));
  return hexFromRgb({
    red: start.red + (end.red - start.red) * share,
    green: start.green + (end.green - start.green) * share,
    blue: start.blue + (end.blue - start.blue) * share,
  });
}

function hslFromRgb(color: RgbColor): HslColor {
  const red = color.red / 255;
  const green = color.green / 255;
  const blue = color.blue / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  if (delta === 0) return { hue: 0, saturation: 0, lightness };
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  const rawHue = maximum === red
    ? ((green - blue) / delta) % 6
    : maximum === green
      ? (blue - red) / delta + 2
      : (red - green) / delta + 4;
  return { hue: (rawHue * 60 + 360) % 360, saturation, lightness };
}

function rgbFromHsl(color: HslColor): RgbColor {
  const chroma = (1 - Math.abs(2 * color.lightness - 1)) * color.saturation;
  const section = color.hue / 60;
  const intermediate = chroma * (1 - Math.abs(section % 2 - 1));
  const [red, green, blue] = section < 1 ? [chroma, intermediate, 0]
    : section < 2 ? [intermediate, chroma, 0]
      : section < 3 ? [0, chroma, intermediate]
        : section < 4 ? [0, intermediate, chroma]
          : section < 5 ? [intermediate, 0, chroma]
            : [chroma, 0, intermediate];
  const match = color.lightness - chroma / 2;
  return { red: (red + match) * 255, green: (green + match) * 255, blue: (blue + match) * 255 };
}

function rotateHue(input: string, degrees: number): string {
  const hsl = hslFromRgb(rgbFromHex(input));
  return hexFromRgb(rgbFromHsl({ ...hsl, hue: (hsl.hue + degrees + 360) % 360 }));
}

export function uiRelativeLuminance(input: string): number {
  const color = rgbFromHex(input);
  const channel = (value: number): number => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return channel(color.red) * 0.2126 + channel(color.green) * 0.7152 + channel(color.blue) * 0.0722;
}

export function uiContrastRatio(first: string, second: string): number {
  const lighter = Math.max(uiRelativeLuminance(first), uiRelativeLuminance(second));
  const darker = Math.min(uiRelativeLuminance(first), uiRelativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function contrastingText(background: string): string {
  const dark = "#080b08";
  const light = "#ffffff";
  return uiContrastRatio(background, dark) >= uiContrastRatio(background, light) ? dark : light;
}

export function deriveUiAccentTheme(input: string, mode: UiThemeMode = "dark"): UiAccentTheme {
  const accent = normalizeUiHexColor(input) ?? UI_DEFAULT_ACCENT;
  const neutralSurface = mode === "dark" ? "#111610" : "#f8faf6";
  const onAccent = contrastingText(accent);
  const interactionTarget = onAccent === "#080b08" ? "#ffffff" : "#000000";
  const accentSecondary = rotateHue(accent, 42);
  return {
    accent,
    accentHover: mixHex(accent, interactionTarget, 0.12),
    accentActive: mixHex(accent, interactionTarget, 0.22),
    accentSubtle: mixHex(neutralSurface, accent, 0.14),
    accentSurface: mixHex(neutralSurface, accent, 0.08),
    accentBorder: mixHex(neutralSurface, accent, 0.48),
    accentSecondary,
    onAccent,
    onAccentSecondary: contrastingText(accentSecondary),
    focusRing: mixHex(accent, onAccent, 0.24),
  };
}

export function uiAccentStyle(input: string, mode: UiThemeMode = "dark"): string {
  const theme = deriveUiAccentTheme(input, mode);
  return [
    ["--character-color", theme.accent],
    ["--ui-accent", theme.accent],
    ["--ui-accent-hover", theme.accentHover],
    ["--ui-accent-active", theme.accentActive],
    ["--ui-accent-subtle", theme.accentSubtle],
    ["--ui-accent-surface", theme.accentSurface],
    ["--ui-accent-border", theme.accentBorder],
    ["--ui-accent-secondary", theme.accentSecondary],
    ["--ui-on-accent", theme.onAccent],
    ["--ui-on-accent-secondary", theme.onAccentSecondary],
    ["--ui-focus-ring", theme.focusRing],
  ].map(([name, value]) => `${name}:${value}`).join(";");
}
