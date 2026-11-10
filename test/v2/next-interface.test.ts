// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextApp } from "../../src/ui/next/next-app";
import type { CampaignSnapshot } from "../../src/application/ports/campaign-repository";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { createCharacter } from "../../src/domain/character/create-character";
import { CampaignV2Schema } from "../../src/domain/character/character-v2";
import { normalizeEquipmentDefinition } from "../../src/domain/equipment/equipment-catalog";
import { EncounterSchema } from "../../src/domain/encounter/encounter-model";

const characterId = "chr_11111111111111111111111111111111";
const campaignId = "cmp_22222222222222222222222222222222";
const stamp = "2026-11-03T12:00:00.000Z";
const apps: NextApp[] = [];
beforeEach(() => { document.body.replaceChildren(); localStorage.clear(); });
afterEach(() => { for (const app of apps.splice(0)) app.stop(); document.body.replaceChildren(); localStorage.clear(); });

async function fixture() {
  const character = createCharacter(characterId, "<Lira>", stamp);
  character.spellcasting.spells = [{ id: "spl_55555555555555555555555555555555", order: 0,
    name: "Truco de prueba", level: 0, prepared: false, definition: null, casting: null, effect: { active: false, description: "" } }];
  character.inventory = [{ ...normalizeEquipmentDefinition({ name: "Nombre secreto", description: "Poder secreto" }),
    id: "inv_33333333333333333333333333333333", order: 0, group: "backpack", equipped: false,
    identification: { identified: false, name: "Piedra opaca", appearance: "Una piedra sin brillo" } }];
  const repository = new InMemoryCampaignRepository();
  const snapshot = await repository.save(CampaignV2Schema.parse({ schemaVersion: 2, id: campaignId, revision: 0,
    characters: { [characterId]: character }, metadata: { createdAt: stamp, updatedAt: stamp } }), { kind: "empty" });
  const save = vi.spyOn(repository, "save");
  const root = document.createElement("div");
  document.body.append(root);
  return { root, repository, snapshot, save, application: new CampaignApplication(repository) };
}

describe("read-only next interface", () => {
  it.each(['player','gm'] as const)('keeps one shared character header across every %s section and updates health and identity without writes', async role => {
    const {root,snapshot,save}=await fixture();
    const c=snapshot.campaign.characters[characterId]!;
    Object.assign(c.identity,{species:'Elfo',subrace:'Alto elfo',className:'Mago',subclass:'Evocación',background:'Erudito',alignment:'Neutral'});
    c.combat.hitPoints={current:20,maximum:40,temporary:10};
    let receive!: (snapshot?: CampaignSnapshot)=>void;
    const app=new NextApp(root,{role,loadCampaign:async()=>snapshot,subscribeChanges:listener=>{receive=listener;return()=>{};}});
    apps.push(app);await app.start();
    for(const section of role==='gm'?['combat','characters','content','more']:['sheet','turn','equipment','more']) {
      root.querySelector<HTMLButtonElement>(`[data-next-section="${section}"]`)!.click();
      expect(root.querySelectorAll('#character-title-select')).toHaveLength(1);
      expect(root.querySelector('header .ns-dashboard')).toBeNull();
      expect(root.querySelectorAll('.next-content .ns-dashboard')).toHaveLength(section==='sheet'||section==='characters'?1:0);
      expect(root.querySelector('header .ns-identity .ns-person-menu summary')!.getAttribute('aria-label')).toBe('Más opciones del personaje');
      expect(root.querySelector('header [aria-label^="Editar ficha"]')).toBeTruthy();
    }
    root.querySelector<HTMLButtonElement>(`[data-next-section="${role==='gm'?'characters':'sheet'}"]`)!.click();
    expect([...root.querySelectorAll('.ns-identity-fields dt')].map(node=>node.textContent)).toEqual(['Raza','Subraza','Clase','Subclase','Trasfondo','Alineación']);
    expect(root.querySelector('.next-content .ns-context .ns-identity-fields')!.textContent).toContain('Alto elfo');
    expect(root.querySelector('.ns-context h3, .ns-identity > div:first-child .next-meta')).toBeNull();
    expect(root.querySelectorAll('.ns-identity-fields dt.ns-sr-only')).toHaveLength(6);
    const meter=()=>root.querySelector<HTMLElement>('.ns-hp-meter')!;
    expect(meter().getAttribute('aria-valuenow')).toBe('50');
    expect(root.querySelector<HTMLElement>('.ns-vital-pg')!.style.getPropertyValue('--ns-health')).toContain('60');
    for(const current of [40,0,-2,80]) {
      const updated=structuredClone(snapshot);updated.campaign.characters[characterId]!.combat.hitPoints.current=current;
      receive(updated);
      expect(Number(meter().getAttribute('aria-valuenow'))).toBe(Math.max(0,Math.min(100,current/40*100)));
    }
    const empty=structuredClone(snapshot);empty.campaign.characters[characterId]!.combat.hitPoints.maximum=0;receive(empty);
    expect(meter().getAttribute('aria-valuenow')).toBe('0');
    expect(root.querySelector<HTMLInputElement>('[name="color"]')!.disabled).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  it("keeps navigation and condition expansion local while two readers receive the same campaign update", async () => {
    const { root, snapshot, save } = await fixture();
    const otherRoot = document.createElement('div'); document.body.append(otherRoot);
    const receivers: ((snapshot?: CampaignSnapshot) => void)[] = [];
    for (const [viewRoot, role] of [[root, 'player'], [otherRoot, 'gm']] as const) {
      const app = new NextApp(viewRoot, { role, loadCampaign: async () => snapshot, subscribeChanges: listener => { receivers.push(listener); return () => {}; } });
      apps.push(app); await app.start();
    }
    otherRoot.querySelector<HTMLButtonElement>('[data-next-section="characters"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-next-conditions]')!.click();
    expect(root.querySelector('[data-next-conditions]')!.getAttribute('aria-expanded')).toBe('true');
    expect(otherRoot.querySelector('[data-next-conditions]')!.getAttribute('aria-expanded')).toBe('false');
    const updated = structuredClone(snapshot);
    updated.campaign.characters[characterId]!.combat.hitPoints.current = 0;
    for (const receive of receivers) receive(updated);
    for (const viewRoot of [root, otherRoot]) expect(viewRoot.querySelector('.ns-vital-value')!.textContent).toContain('0 / 1');
    expect(root.querySelector('[data-next-section="sheet"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(otherRoot.querySelector('[data-next-section="characters"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(save).not.toHaveBeenCalled();
  });

  it("shows the reviewed icon sheet and real origins without exposing game actions or changing the snapshot", async () => {
    const { root, snapshot, save } = await fixture();
    const c = snapshot.campaign.characters[characterId]!;
    c.identity.level = 10; c.abilities.intelligence = 16;
    c.checks.skills.investigation.proficiency = 1;
    c.checks.savingThrows.intelligence.proficiency = 1;
    c.combat.conditions = [{ id: 'con_44444444444444444444444444444444', key: 'bless', label: 'Bendición', level: null, addedAt: stamp }];
    c.combat.exhaustion = 2;
    const before = JSON.stringify(snapshot);
    const app = new NextApp(root, { role: 'player', loadCampaign: async () => snapshot });
    apps.push(app); await app.start();
    expect(root.querySelectorAll('.ns-ability')).toHaveLength(6);
    expect(root.querySelectorAll('.ns-save')).toHaveLength(6);
    expect(root.querySelectorAll('.ns-skill')).toHaveLength(18);
    for (const pair of root.querySelectorAll('.ns-attribute-pair')) expect(pair.querySelector('.ns-ability')!.nextElementSibling).toBe(pair.querySelector('.ns-save'));
    const keys = [...root.querySelectorAll<HTMLElement>('.ns-skill')].map(node => node.dataset.nextFocus);
    expect(keys).toEqual(['skill:athletics','skill:acrobatics','skill:sleightOfHand','skill:stealth','skill:arcana','skill:history','skill:investigation','skill:nature','skill:religion','skill:medicine','skill:perception','skill:insight','skill:survival','skill:animalHandling','skill:deception','skill:performance','skill:intimidation','skill:persuasion']);
    expect(root.querySelectorAll('svg path,svg circle,svg rect,svg polyline').length).toBeGreaterThan(25);
    const skill = root.querySelector<HTMLElement>('[data-next-focus="skill:investigation"]')!;
    expect(skill.textContent).toBe('+7');
    skill.focus();
    const tooltip = root.querySelector<HTMLElement>('[role="tooltip"]')!;
    expect(tooltip.hidden).toBe(false);
    expect(tooltip.textContent).toBe('Investigación\n+3 Inteligencia (puntaje 16)\n+4 Competencia · nivel 10');
    expect(skill.getAttribute('aria-describedby')).toBe(tooltip.id);
    skill.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(tooltip.hidden).toBe(true);
    expect(document.activeElement).toBe(skill);
    skill.click(); // Consultation cannot roll or write.
    expect(root.querySelector('[role="dialog"]')).toBeNull();
    expect(root.querySelector('[data-next-focus="passive:investigation"] strong')!.textContent).toBe('17');
    expect(root.querySelector('.ns-save[data-ability="intelligence"]')!.textContent).toBe('+7');
    const active = root.querySelector('.ns-condition-summary')!.innerHTML;
    expect(root.querySelectorAll('[data-next-active-condition]')).toHaveLength(2);
    root.querySelector<HTMLButtonElement>('[data-next-conditions]')!.click();
    expect(root.querySelector('.ns-condition-summary')!.innerHTML).toBe(active);
    expect(root.querySelectorAll('#next-condition-choices .ns-condition')).toHaveLength(24);
    root.querySelector<HTMLElement>('#next-condition-choices .ns-condition')!.click();
    expect(root.querySelector('.ns-condition-summary')!.innerHTML).toBe(active);
    const grid = root.querySelector<HTMLElement>('.ns-skills')!;
    Object.defineProperty(grid, 'clientWidth', { configurable: true, value: 260 });
    window.dispatchEvent(new Event('resize'));
    expect(grid.style.getPropertyValue('--ns-columns')).toBe('4');
    expect(grid.style.getPropertyValue('--ns-rows')).toBe('5');
    expect(root.querySelector('script[src],link[href],img[src],i[data-lucide]')).toBeNull();
    expect(JSON.stringify(snapshot)).toBe(before);
    expect(save).not.toHaveBeenCalled();
    app.stop();
    skill.focus();
    expect(root.querySelector('[role="tooltip"]')).toBeNull();
  });

  it("keeps condition expansion, statistic focus and updated explanations during remote refreshes", async () => {
    const { root, snapshot, save } = await fixture();
    let receive!: (snapshot?: CampaignSnapshot) => void;
    const app = new NextApp(root, { role: 'player', loadCampaign: async () => snapshot, subscribeChanges: listener => { receive = listener; return () => {}; } });
    apps.push(app); await app.start();
    root.querySelector<HTMLButtonElement>('[data-next-conditions]')!.click();
    root.querySelector<HTMLElement>('[data-next-focus="skill:investigation"]')!.focus();
    const updated = structuredClone(snapshot);
    updated.campaign.characters[characterId]!.abilities.intelligence = 18;
    receive(updated);
    expect(root.querySelector('[data-next-conditions]')!.getAttribute('aria-expanded')).toBe('true');
    expect((document.activeElement as HTMLElement).dataset.nextFocus).toBe('skill:investigation');
    expect(root.querySelectorAll('[role="tooltip"]')).toHaveLength(1);
    expect(root.querySelector('[role="tooltip"]')!.textContent).toContain('+4 Inteligencia (puntaje 18)');
    expect(root.querySelector('[data-next-focus="skill:investigation"]')!.textContent).toBe('+4');
    expect(save).not.toHaveBeenCalled();
  });

  it("loads and navigates real snapshots without writing and masks unidentified items", async () => {
    const { root, application, repository, snapshot, save } = await fixture();
    const app = new NextApp(root, { role: "player", loadCampaign: () => application.loadCampaign() });
    apps.push(app);
    await app.start();
    expect(root.textContent).toContain("<Lira>");
    expect(root.querySelector("lira")).toBeNull();
    expect(root.querySelectorAll(".ns-ability")).toHaveLength(6);
    root.querySelector<HTMLButtonElement>('[data-next-section="turn"]')!.click();
    expect(root.querySelector('[data-next-detail="spl_55555555555555555555555555555555"]')!.textContent).toContain("No requiere preparación");
    root.querySelector<HTMLButtonElement>('[data-next-section="equipment"]')!.click();
    expect(root.textContent).toContain("Piedra opaca");
    expect(root.innerHTML).not.toContain("Nombre secreto");
    expect(root.innerHTML).not.toContain("Poder secreto");
    for (const section of ["sheet", "more", "turn"]) root.querySelector<HTMLButtonElement>(`[data-next-section="${section}"]`)!.click();
    expect(save).not.toHaveBeenCalled();
    expect((await repository.load())!.checksum).toBe(snapshot.checksum);
    expect(await app.savePendingChanges()).toBe(true);
  });

  it("accepts remote changes, keeps the section and releases its subscription", async () => {
    const { root, application, snapshot, save } = await fixture();
    let receive: (snapshot?: CampaignSnapshot) => void = () => {};
    const unsubscribe = vi.fn();
    const app = new NextApp(root, { role: "player", loadCampaign: () => application.loadCampaign(),
      subscribeChanges: listener => { receive = listener; return unsubscribe; } });
    apps.push(app);
    await app.start();
    root.querySelector<HTMLButtonElement>('[data-next-section="equipment"]')!.click();
    root.querySelector<HTMLDetailsElement>(".next-content details")!.open = true;
    const updated = structuredClone(snapshot);
    updated.campaign.characters[characterId]!.combat.hitPoints.current = 7;
    receive(updated);
    expect(root.querySelector(".ns-dashboard")).toBeNull();
    expect(root.querySelector('[data-next-section="equipment"]')!.getAttribute("aria-pressed")).toBe("true");
    expect(root.querySelector<HTMLDetailsElement>(".next-content details")!.open).toBe(true);
    root.querySelector<HTMLButtonElement>('[data-next-section="sheet"]')!.click();
    expect(root.querySelector(".ns-vital-pg")!.textContent).toContain("7 / ");
    app.stop();
    const html = root.innerHTML;
    receive(snapshot);
    expect(root.innerHTML).toBe(html);
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(save).not.toHaveBeenCalled();
  });

  it("does not replace a newer pushed snapshot with a late initial load", async () => {
    const { root, snapshot } = await fixture();
    let resolveLoad!: (snapshot: CampaignSnapshot) => void;
    let receive!: (snapshot?: CampaignSnapshot) => void;
    const app = new NextApp(root, { role: "player", loadCampaign: () => new Promise(resolve => { resolveLoad = resolve; }),
      subscribeChanges: listener => { receive = listener; return () => {}; } });
    apps.push(app);
    const starting = app.start();
    const updated = structuredClone(snapshot);
    updated.campaign.characters[characterId]!.name = "Actualizado";
    receive(updated);
    resolveLoad(snapshot);
    await starting;
    expect(root.textContent).toContain("Actualizado");
    expect(root.textContent).not.toContain("<Lira>");
  });

  it("consults GM state without combat synchronization or writes", async () => {
    const { root, application, save } = await fixture();
    const app = new NextApp(root, { role: "gm", loadCampaign: () => application.loadCampaign() });
    apps.push(app);
    await app.start();
    expect(root.textContent).toContain("Combate guardado");
    expect(root.textContent).toContain("No controla ni sincroniza");
    root.querySelector<HTMLButtonElement>('[data-next-section="characters"]')!.click();
    expect(root.textContent).toContain("<Lira>");
    expect(save).not.toHaveBeenCalled();
  });

  it("shows an empty campaign and cleans up a failed initial load", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const app = new NextApp(root, { role: "player", loadCampaign: async () => null });
    apps.push(app);
    await app.start();
    expect(root.textContent).toContain("No hay campaña cargada");
    app.stop();
    const unsubscribe = vi.fn();
    const broken = new NextApp(root, { role: "player", loadCampaign: async () => { throw new Error("unavailable"); },
      subscribeChanges: () => unsubscribe });
    apps.push(broken);
    await expect(broken.start()).rejects.toThrow("unavailable");
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("refreshes only matching browser storage events and never starts subscriptions twice", async () => {
    const { root, snapshot } = await fixture();
    const load = vi.fn(async () => snapshot);
    const subscribe = vi.fn(() => () => {});
    const app = new NextApp(root, { role: "player", loadCampaign: load, subscribeChanges: subscribe, storageEventKey: "campaign-key" });
    apps.push(app);
    await app.start();
    await app.start();
    expect(subscribe).toHaveBeenCalledOnce();
    window.dispatchEvent(new StorageEvent("storage", { key: "interface-preference" }));
    expect(load).toHaveBeenCalledOnce();
    window.dispatchEvent(new StorageEvent("storage", { key: "campaign-key" }));
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    app.stop();
    window.dispatchEvent(new StorageEvent("storage", { key: "campaign-key" }));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("provides the selected character for GM queries and disconnects on stop", async () => {
    const { root, application } = await fixture();
    let read!: () => ReturnType<typeof createCharacter> | null;
    const disconnect = vi.fn();
    const app = new NextApp(root, { role: "player", loadCampaign: () => application.loadCampaign(),
      connectCharacterQueries: getter => { read = getter; return disconnect; } });
    apps.push(app);
    await app.start();
    expect(read()?.id).toBe(characterId);
    app.stop();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("shows one saved GM encounter, preserves selection on updates and falls back after removal without writing", async () => {
    const { root, snapshot, save } = await fixture();
    const alphaId = "enc_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const betaId = "enc_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const encounter = (id: string, name: string, combatantName: string) => EncounterSchema.parse({
      schemaVersion: 1, id, revision: 0, name, round: 1, activeCombatantId: "cbt_cccccccccccccccccccccccccccccccc",
      combatants: [{ kind: "custom", id: "cbt_cccccccccccccccccccccccccccccccc", name: combatantName,
        initiative: 12, order: 0, armorClass: 14, hitPoints: { current: 8, maximum: 10, temporary: 3 },
        conditions: [], visibleToPlayers: false }], metadata: { createdAt: stamp, updatedAt: stamp },
    });
    snapshot.campaign.encounters = { [alphaId]: encounter(alphaId, "Alfa", "Criatura alfa"), [betaId]: encounter(betaId, "Beta", "Criatura beta") };
    let receive!: (snapshot?: CampaignSnapshot) => void;
    const app = new NextApp(root, { role: "gm", loadCampaign: async () => snapshot,
      subscribeChanges: listener => { receive = listener; return () => {}; } });
    apps.push(app);
    await app.start();
    const list = () => root.querySelector<HTMLOListElement>(".next-combat-list")!;
    expect(list().textContent).toContain("Criatura alfa");
    expect(list().textContent).not.toContain("Criatura beta");
    const select = root.querySelector<HTMLSelectElement>("[data-next-encounter]")!;
    select.value = betaId;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(list().textContent).toContain("Criatura beta");
    expect(list().textContent).not.toContain("Criatura alfa");
    expect(list().querySelector(".next-current-combatant")!.textContent).toContain("Turno guardado");
    expect(list().textContent).toContain("+3 temporales");
    receive(structuredClone(snapshot));
    expect(root.querySelector<HTMLSelectElement>("[data-next-encounter]")!.value).toBe(betaId);
    const updated = structuredClone(snapshot);
    delete updated.campaign.encounters[betaId];
    receive(updated);
    expect(list().textContent).toContain("Criatura alfa");
    expect(root.querySelector("[data-next-encounter]")).toBeNull();
    expect(snapshot.campaign.encounters[betaId]).toBeDefined();
    expect(save).not.toHaveBeenCalled();
  });
});
