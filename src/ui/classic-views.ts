import "../styles.css";
import { BrowserApp, type BrowserAppRuntime } from "./browser-app";
import { GmApp, type GmAppRuntime } from "./gm-app";
import type { CampaignApplication } from "../application/campaign/campaign-application";
import type { EncounterApplication } from "../application/encounter/encounter-application";

export function createPlayer(root: HTMLElement, application: CampaignApplication, runtime: BrowserAppRuntime): BrowserApp {
  return new BrowserApp(root, application, runtime);
}

export function createGm(root: HTMLElement, application: EncounterApplication, runtime: GmAppRuntime): GmApp {
  return new GmApp(root, application, runtime);
}
