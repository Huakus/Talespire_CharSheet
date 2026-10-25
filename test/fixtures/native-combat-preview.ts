import "../../src/styles.css";
import { GmApp } from "../../src/ui/gm-app";
import { EncounterApplication } from "../../src/application/encounter/encounter-application";
import { CombatSessionRepository } from "../../src/infrastructure/persistence/combat-session-repository";
import { nativeCombatFixture } from "./native-combat";

// Deterministic, in-memory data only; this page never connects to campaign storage.
const fixture = await nativeCombatFixture();
const parameters = new URLSearchParams(location.search);
const snapshot = (await fixture.source.load())!;
const caster = snapshot.campaign.characters[fixture.character.id]!;
caster.identity.level = 10;
caster.identity.className = "Mago · Escuela de abjuración";
caster.abilities.intelligence = 18;
caster.spellcasting.ability = "intelligence";
caster.combat.conditions = [
  { id: "cond_11111111111111111111111111111111", key: "concentration", label: "Concentración", level: null, addedAt: "2026-10-20T12:00:00Z" },
  { id: "cond_22222222222222222222222222222222", key: "poisoned", label: "Envenenado", level: null, addedAt: "2026-10-20T12:00:00Z" },
];
caster.combat.exhaustion = 1;
fixture.queue.items[1]!.name = "Delerion ventrílocuo junto al portal";
fixture.queue.activeItemIndex = 1;
await fixture.source.save(snapshot.campaign, { kind: "checksum", checksum: snapshot.checksum });
document.documentElement.dataset.v2Theme = parameters.get("theme") === "light" ? "light" : "dark";
const root = document.querySelector<HTMLElement>("#app")!;
root.style.maxWidth = `${parameters.get("width") ?? "640"}px`;
root.style.margin = "16px auto";
let receiveInitiative: (clientId: string, total: number, characterId: string | null) => void = () => undefined;
const app = new GmApp(root, new EncounterApplication(new CombatSessionRepository(fixture.source)), {
  monsters: [fixture.monster],
  diceRoller: { roll: async () => ({ kind: "rolled", totals: [14], summary: "14" }) },
  getNativeInitiative: async () => fixture.queue,
  subscribeInitiative: (listener) => { receiveInitiative = listener; return () => undefined; },
});
await app.start();
receiveInitiative("client-hero", 18, fixture.character.id);
