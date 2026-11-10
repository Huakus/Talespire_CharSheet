import "./next.css";
import type { CampaignApplication } from "../../application/campaign/campaign-application";
import type { EncounterApplication } from "../../application/encounter/encounter-application";
import type { BrowserAppRuntime } from "../browser-app";
import type { GmAppRuntime } from "../gm-app";
import { NextApp } from "./next-app";

export function createPlayer(root: HTMLElement, application: CampaignApplication, runtime: BrowserAppRuntime): NextApp {
  return new NextApp(root, {
    role: "player", loadCampaign: () => application.loadCampaign(),
    play: { application, diceRoller: runtime.diceRoller },
    ...(runtime.subscribeCampaignChanges ? { subscribeChanges: listener => runtime.subscribeCampaignChanges!(snapshot => listener(snapshot)) } : {}),
    ...(runtime.storageEventKey !== undefined ? { storageEventKey: runtime.storageEventKey } : {}),
    ...(runtime.subscribeCharacterSummaryRequests && runtime.respondToCharacterSummaryRequest ? {
      connectCharacterQueries: (read, reportError) => runtime.subscribeCharacterSummaryRequests!(request => {
        const character = read();
        if (character) void runtime.respondToCharacterSummaryRequest!(character, request).catch(reportError);
      }),
    } : {}),
  });
}

export function createGm(root: HTMLElement, _application: EncounterApplication, runtime: GmAppRuntime,
  reader: CampaignApplication): NextApp {
  return new NextApp(root, {
    role: "gm", loadCampaign: () => reader.loadCampaign(),
    play: { application: reader, diceRoller: runtime.diceRoller },
    ...(runtime.subscribeCampaignChanges ? { subscribeChanges: listener => runtime.subscribeCampaignChanges!(() => listener()) } : {}),
  });
}
