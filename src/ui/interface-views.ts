import type { CampaignApplication } from "../application/campaign/campaign-application";
import type { EncounterApplication } from "../application/encounter/encounter-application";
import type { BrowserAppRuntime } from "./browser-app";
import type { GmAppRuntime } from "./gm-app";
import type { InterfaceVersion } from "./interface-preference";

export interface InterfaceView {
  start(): Promise<void>;
  stop(): void;
}

export interface PlayerInterfaceView extends InterfaceView {
  savePendingChanges(): Promise<boolean>;
}

export interface InterfaceViews {
  createPlayer(root: HTMLElement, application: CampaignApplication, runtime: BrowserAppRuntime): PlayerInterfaceView;
  createGm(root: HTMLElement, application: EncounterApplication, runtime: GmAppRuntime,
    reader: CampaignApplication): InterfaceView;
}

// Each dynamic import needs its own loader. Production minification can merge
// conditional imports (including if/return) and assign Classic's CSS to Nueva.
const interfaceLoaders: Record<InterfaceVersion, () => Promise<InterfaceViews>> = {
  classic: () => import("./classic-views"),
  next: () => import("./next/next-views"),
};

export function loadInterfaceViews(version: InterfaceVersion): Promise<InterfaceViews> {
  return interfaceLoaders[version]();
}
