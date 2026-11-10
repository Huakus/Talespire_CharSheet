import { readFileSync } from "node:fs";
import { Window, type HTMLButtonElement, type HTMLFormElement, type HTMLOptionElement, type HTMLInputElement, type HTMLSelectElement, type HTMLElement } from "happy-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const html = readFileSync("docs/v2/ui-redesign/compact-icon-sheet.html", "utf8");
let browser: Window;
const network = vi.fn(() => { throw new Error("The local prototype must work offline"); });

function openPrototype(setup = '') {
  const window = new Window({ url: "file:///review/compact-icon-sheet.html" });
  Object.assign(window, { structuredClone, fetch: network });
  window.document.body.innerHTML = html;
  window.eval(window.document.querySelector("script")!.textContent!.replace('restore(window.openai?.widgetState);render();', setup + ';restore(window.openai?.widgetState);render();'));
  return window;
}
beforeEach(() => { browser = openPrototype(); });
afterEach(async () => { await browser.happyDOM.abort(); vi.restoreAllMocks(); network.mockClear(); });

function click(action: string) {
  const button = [...browser.document.querySelectorAll<HTMLButtonElement>("button[data-action]")]
    .find(b => b.getAttribute("data-action") === action)!;
  expect(button, action).toBeDefined();
  button.click();
}
function change(selector: string, value: string) {
  const select = browser.document.querySelector<HTMLSelectElement>("select" + selector)!;
  select.value = value;
  select.dispatchEvent(new browser.Event("change", { bubbles: true }));
}
function expectLocalDrawings() {
  const icons = [...browser.document.querySelectorAll(".ic-sheet svg[data-icon] use")];
  expect(icons.length).toBeGreaterThan(0);
  for (const use of icons) {
    const reference = use.getAttribute("href")!;
    expect(reference.startsWith("#ts-icon-")).toBe(true);
    const symbol = browser.document.getElementById(reference.slice(1));
    expect(symbol?.querySelector("path,line,circle,rect,polyline,polygon,ellipse"), reference).toBeTruthy();
  }
  expect(browser.document.querySelector("i[data-lucide]")).toBeNull();
}

it('keeps identity and its chosen color in the common header while navigating, with synthetic undo', () => {
  const form=browser.document.querySelector<HTMLFormElement>('[data-form="character-color"]')!;
  form.querySelector<HTMLInputElement>('input')!.value='#6f96c4';
  form.dispatchEvent(new browser.Event('submit',{bubbles:true,cancelable:true}));
  const chosen=browser.document.querySelector<HTMLSelectElement>('[name="character"]')!.value;
  for(const route of ['inventory','spells','actions','more','notes','summary']) {
    click('route:'+route);
    expect(browser.document.querySelectorAll('[name="character"]')).toHaveLength(1);
    expect(browser.document.querySelector('.ic-common-header .ic-dashboard')).toBeNull();
    expect(browser.document.querySelectorAll('.ic-main .ic-dashboard')).toHaveLength(route==='summary'?1:0);
    expect(browser.document.querySelector('.ic-common-header [name="character"]')).toBeTruthy();
    expect(browser.document.querySelector<HTMLInputElement>('[name="characterColor"]')!.value).toBe('#6f96c4');
  }
  expect([...browser.document.querySelectorAll('.ic-identity-fields dt')].map(node=>node.textContent)).toEqual(['Raza','Clase','Trasfondo','Alineación']);
  expect(browser.document.querySelector('.ic-context h3, .ic-identity .ic-meta')).toBeNull();
  expect(browser.document.querySelector('.ic-main .ic-dashboard .ic-context .ic-identity-fields')).toBeTruthy();
  const other=[...browser.document.querySelectorAll<HTMLOptionElement>('[name="character"] option')].find(option=>option.value!==chosen)!.value;
  change('[name="character"]',other);
  expect(browser.document.querySelector<HTMLInputElement>('[name="characterColor"]')!.value).not.toBe('#6f96c4');
  change('[name="character"]',chosen);
  click('undo');
  expect(browser.document.querySelector<HTMLInputElement>('[name="characterColor"]')!.value).not.toBe('#6f96c4');
  expect(network).not.toHaveBeenCalled();
});

it('changes the HP fraction and card color together while temporary HP stay separate', () => {
  const card=()=>browser.document.querySelector<HTMLElement>('.ic-vital-pg')!;
  const meter=()=>browser.document.querySelector<HTMLElement>('.ic-hp-meter')!;
  expect(meter().getAttribute('aria-valuenow')).toBe('100');
  const full=card().style.getPropertyValue('--ic-health');
  click('open-hp');browser.document.querySelector<HTMLInputElement>('[name="amount"]')!.value='31';
  browser.document.querySelector<HTMLButtonElement>('[data-hp-operation="damage"]')!.click();
  expect(meter().getAttribute('aria-valuenow')).toBe('50');
  expect(card().style.getPropertyValue('--ic-health')).not.toBe(full);
  click('open-hp');browser.document.querySelector<HTMLInputElement>('[name="amount"]')!.value='50';
  browser.document.querySelector<HTMLButtonElement>('[data-hp-operation="temp"]')!.click();
  expect(meter().getAttribute('aria-valuenow')).toBe('50');
});

describe("standalone redesign prototype", () => {
  it('previews XP, the three inspiration states and a locked next-roll mode in the same canonical sheet', () => {
    expect(browser.document.querySelector('.ic-skills')!.parentElement!.textContent).not.toContain('Modificador');
    const form=browser.document.querySelector('form[data-form="experience"]')!;
    form.querySelector<HTMLInputElement>('input')!.value='15000';
    form.dispatchEvent(new browser.Event('submit',{bubbles:true,cancelable:true}));
    expect(browser.document.querySelector('.ic-xp-ready')!.textContent).toContain('85000 PX');
    expect(browser.document.querySelector('.ic-xp-ready [data-action="open-level"]')).toBeTruthy();
    click('inspiration');expect(browser.document.querySelector('.ic-inspiration')!.textContent).toBe('InspiraciónDisponible');
    expect(browser.document.querySelector('.ic-inspiration')!.classList.contains('ic-inspired')).toBe(true);
    click('inspiration');expect(browser.document.querySelector('.ic-inspiration')!.getAttribute('data-inspiration-state')).toBe('armed');
    expect(browser.document.querySelector('.ic-inspiration')!.textContent).toBe('InspiraciónEn uso');
    const random=vi.spyOn(browser.Math,'random').mockReturnValue(0.5);
    click('roll:history');expect(random).toHaveBeenCalledTimes(2);
    expect(browser.document.querySelector('.ic-inspiration')!.textContent).toBe('InspiraciónInactiva');
    click('roll-mode:advantage');click('roll-lock');click('roll:history');click('roll:history');
    expect(random).toHaveBeenCalledTimes(6);
    expect(browser.document.querySelector('[data-action="roll-lock"]')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('previews zero-HP restrictions, healing and one HP on the third death success', () => {
    click('open-hp');browser.document.querySelector<HTMLInputElement>('input[name="amount"]')!.value='999';
    browser.document.querySelector<HTMLButtonElement>('[data-hp-operation="damage"]')!.click();
    expect(browser.document.querySelector<HTMLButtonElement>('[data-action="roll:history"]')!.disabled).toBe(true);
    click('death:success');click('death:success');click('death:success');
    expect(browser.document.querySelector('.ic-vital-value')!.textContent).toBe('1 / 62');
    expect(browser.document.querySelector('[data-action="death:success"]')).toBeNull();
  });

  it("explains numeric properties and recalculates skill, save, passive and roll together after an edit", () => {
    const skill = () => browser.document.querySelector<HTMLButtonElement>('[data-action="roll:investigation"]')!;
    const passive = () => browser.document.querySelector<HTMLElement>('[data-passive="investigation"]')!;
    expect(skill().textContent).toBe('+7');
    expect(skill().getAttribute('data-tooltip')).toBe('Investigación\n+3 Inteligencia (puntaje 16)\n+4 Competencia · nivel 10');
    expect(passive().querySelector('strong')!.textContent).toBe('17');
    expect(passive().getAttribute('data-tooltip')).toBe('Investigación pasiva\n10 Base\n+3 Inteligencia (puntaje 16)\n+4 Competencia · nivel 10');
    const speed = browser.document.querySelector<HTMLElement>('.ic-vital[aria-label^="Velocidad"]')!;
    speed.focus();
    expect(browser.document.getElementById('ic-local-tooltip')!.textContent).toContain('30 pies Base registrada en ficha');
    expect(speed.dataset.tooltip).toContain('Origen de la velocidad base sin detallar');
    const armor = browser.document.querySelector('[data-action="open-armor"]')!;
    expect(armor.getAttribute('data-tooltip')).toContain('Armadura, escudo y otros aportes sin detallar');
    expect(browser.document.querySelector('.ic-resource-count')!.getAttribute('data-tooltip')).toContain('1 Máximo registrado\n+0 Usos consumidos');
    click('open-character-edit');
    browser.document.querySelector<HTMLInputElement>('input[name="int"]')!.value = '18';
    browser.document.querySelector<HTMLButtonElement>('form[data-form="character-edit"] button[type="submit"]')!.click();
    expect(skill().textContent).toBe('+8');
    expect(skill().dataset.tooltip).toContain('+4 Inteligencia (puntaje 18)');
    expect(passive().querySelector('strong')!.textContent).toBe('18');
    expect(browser.document.querySelector('[data-action="roll-save:int"]')!.textContent).toBe('+8');
    vi.spyOn(browser.Math, 'random').mockReturnValue(0.5);
    skill().click();
    expect(browser.document.querySelector('.ic-toast')).toBeNull();
    click('show-history');
    expect(browser.document.querySelector('[role="dialog"]')!.textContent).toContain('Investigación · d20 11 · 11 +8 = 19');
    click('close');
    change('[name="character"]', 'mira');
    expect(skill().textContent).toBe('+6');
    expect(skill().dataset.tooltip).toContain('+3 Competencia · nivel 5');
  });

  it("names positive and negative sources, expertise and passive-only effects without changing state on focus", async () => {
    await browser.happyDOM.abort();
    browser = openPrototype(`
      data.characters.delerion.skillTraining.investigation=2;
      data.characters.delerion.numberBonuses={
        'skill:investigation':[{value:1,label:'Objeto de ejemplo'},{value:-2,label:'Penalización de ejemplo'}],
        'save:int':[{value:1,label:'Rasgo de ejemplo'}],
        'speed':[{value:10,label:'Botas de ejemplo',unit:' pies'}],
        'passive:investigation':[{value:5,label:'Rasgo de atención'}]
      };
    `);
    const random = vi.spyOn(browser.Math, 'random').mockReturnValue(0.5);
    const investigation = browser.document.querySelector<HTMLButtonElement>('[data-action="roll:investigation"]')!;
    expect(investigation.textContent).toBe('+10');
    investigation.focus();
    const tooltip = browser.document.getElementById('ic-local-tooltip')!;
    expect(tooltip.textContent).toBe('Investigación\n+3 Inteligencia (puntaje 16)\n+8 Pericia (2 × competencia) · nivel 10\n+1 Objeto de ejemplo\n-2 Penalización de ejemplo');
    expect(browser.document.querySelector('[data-passive="investigation"] strong')!.textContent).toBe('25');
    expect(browser.document.querySelector('[data-passive="investigation"]')!.getAttribute('data-tooltip')).toContain('+5 Rasgo de atención');
    expect(browser.document.querySelector('[data-action="roll-save:int"]')!.textContent).toBe('+8');
    expect(browser.document.querySelector('[data-action="roll-save:int"]')!.getAttribute('data-tooltip')).toContain('+1 Rasgo de ejemplo');
    expect(browser.document.querySelector('.ic-vital[aria-label="Velocidad: 40 pies"]')!.textContent).toContain('40 pies');
    expect(browser.document.querySelector('.ic-vital[aria-label="Velocidad: 40 pies"]')!.getAttribute('data-tooltip')).toContain('+10 pies Botas de ejemplo');
    expect(random).not.toHaveBeenCalled();
    expect(browser.document.querySelector<HTMLButtonElement>('[data-action="undo"]')!.disabled).toBe(true);
    investigation.click(); click('show-history');
    expect(browser.document.querySelector('[role="dialog"]')!.textContent).toContain('Investigación · d20 11 · 11 +10 = 21');
    expect(network).not.toHaveBeenCalled();
  });

  it("applies HP operations from three icon buttons beside the amount and cancels without changes", () => {
    const hp = () => browser.document.querySelector('.ic-vital[data-action="open-hp"] .ic-vital-value')!.textContent;
    const amount = (value: string) => {
      const input = browser.document.querySelector<HTMLInputElement>('form[data-form="hp"] input[name="amount"]')!;
      input.value = value;
      input.dispatchEvent(new browser.Event('input', { bubbles: true }));
      return input;
    };
    const apply = (operation: string) => browser.document.querySelector<HTMLButtonElement>(`[data-hp-operation="${operation}"]`)!.click();
    click('open-hp');
    const form = browser.document.querySelector('form[data-form="hp"]')!;
    expect(form.querySelector('select')).toBeNull();
    const buttons = [...form.querySelectorAll('button')];
    expect(buttons).toHaveLength(4);
    expect(buttons.map(b => b.getAttribute('data-tooltip'))).toEqual(['Curar', 'Dañar', 'Puntos de golpe temporales', 'Cancelar']);
    for (const button of buttons) {
      expect(button.textContent).toBe('');
      expect(button.getAttribute('aria-label')).toBe(button.getAttribute('data-tooltip'));
    }
    expectLocalDrawings();
    const input = amount('9');
    const enter = new browser.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    apply('damage');
    expect(hp()).toBe('53 / 62');
    click('open-hp'); amount('4'); apply('temp');
    expect(hp()).toBe('53 / 62+4 temporales');
    click('open-hp'); amount('6'); apply('damage');
    expect(hp()).toBe('51 / 62');
    click('open-hp'); amount('99'); apply('heal');
    expect(hp()).toBe('62 / 62');
    click('open-hp'); amount('12'); click('close');
    expect(browser.document.querySelector('[role="dialog"]')).toBeNull();
    expect(hp()).toBe('62 / 62');
    click('undo');
    expect(hp()).toBe('51 / 62'); // Cancel must not add an undo entry.
  });

  it("uses the same direct HP controls for the selected GM combatant", () => {
    change('#ic-review-role', 'gm');
    click('select-actor:guardian'); click('open-actor-hp');
    const input = browser.document.querySelector<HTMLInputElement>('input[name="amount"]')!;
    input.value = '8';
    browser.document.querySelector<HTMLButtonElement>('[data-hp-operation="damage"]')!.click();
    expect(browser.document.querySelector('.ic-entry-selected .ic-read')!.textContent).toBe('PG 20/40');
    click('open-actor-hp');
    browser.document.querySelector<HTMLInputElement>('input[name="amount"]')!.value = '1';
    browser.document.querySelector<HTMLButtonElement>('[data-hp-operation="heal"]')!.click();
    expect(browser.document.querySelector('[role="dialog"]')).toBeNull();
    expect(browser.document.querySelector('.ic-entry-selected .ic-read')!.textContent).toBe('PG 21/40');
    change('#ic-review-role', 'player');
    expect(browser.document.querySelector('.ic-vital-value')!.textContent).toBe('62 / 62');
  });

  it("includes actual heart, shield and skill drawings without a viewer, CDN or network", () => {
    expect("lucide" in browser).toBe(false);
    expect("openai" in browser).toBe(false);
    expect(browser.document.querySelectorAll(".ic-ability")).toHaveLength(6);
    expect(browser.document.querySelectorAll(".ic-skill")).toHaveLength(18);
    expect(browser.document.querySelector('.ic-vital use[href="#ts-icon-heart"]')).toBeTruthy();
    expect(browser.document.querySelector('.ic-vital use[href="#ts-icon-shirt"]')).toBeTruthy();
    expectLocalDrawings();
    expect(network).not.toHaveBeenCalled();
    expect(browser.document.querySelector('script[src],link[href],img[src],iframe')).toBeNull();
  });

  it("keeps local drawings after player and GM navigation replaces the content", () => {
    for (const route of ["actions", "spells", "inventory", "summary"]) {
      click("route:" + route); expectLocalDrawings();
    }
    for (const route of ["traits", "progression", "notes", "extras", "lore", "commerce", "settings"]) {
      click("route:more"); click("route:" + route); expectLocalDrawings();
    }
    change("#ic-review-role", "gm");
    for (const route of ["encounter", "roster", "content", "lore"]) {
      click("route:" + route); expectLocalDrawings();
    }
    click("route:more"); click("route:tools"); expectLocalDrawings();
    expect(network).not.toHaveBeenCalled();
  });

  it("shows a local tooltip on keyboard focus, links its accessible description and closes with Escape", () => {
    const hp = browser.document.querySelector<HTMLButtonElement>('.ic-vital[data-action="open-hp"]')!;
    const before = hp.textContent;
    const tooltip = browser.document.querySelector<HTMLElement>("#ic-local-tooltip")!;
    hp.focus();
    expect(tooltip.hidden).toBe(false);
    expect(tooltip.textContent).toContain("Puntos de golpe");
    expect(hp.getAttribute("aria-describedby")).toBe(tooltip.id);
    hp.dispatchEvent(new browser.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(tooltip.hidden).toBe(true);
    expect(hp.hasAttribute("aria-describedby")).toBe(false);
    expect(browser.document.activeElement).toBe(hp);
    expect(hp.textContent).toBe(before);
    expect(browser.document.querySelector('[role="dialog"]')).toBeNull();
    const skill = browser.document.querySelector('[data-action="roll:history"]')!;
    skill.dispatchEvent(new browser.Event("pointerover", { bubbles: true }));
    expect(tooltip.hidden).toBe(false);
    expect(tooltip.textContent).toBe("Historia\n+3 Inteligencia (puntaje 16)");
    browser.document.querySelector<HTMLButtonElement>('.ic-ability[data-ability="str"]')!.focus();
    expect(tooltip.textContent).toContain("Fuerza · puntaje 10");
    expect(tooltip.textContent).toContain("(10 − 10) ÷ 2, redondeado hacia abajo");
    expect(browser.document.querySelector('[role="dialog"]')).toBeNull();
    click("route:actions");
    expect(tooltip.hidden).toBe(true);
  });

  it("exposes local review controls without the conversation's controls helper", () => {
    expect("Tweak" in browser).toBe(false);
    change("#ic-review-width", "320");
    expect(browser.document.querySelector(".ic-sheet")!.getAttribute("style")).toContain("320px");
    change("#ic-review-icons", "hide");
    expect(browser.document.querySelector(".ic-sheet")!.getAttribute("data-glyphs")).toBe("false");
    change("#ic-review-icons", "show");
    expect(browser.document.querySelector(".ic-sheet")!.getAttribute("data-glyphs")).toBe("true");
    expectLocalDrawings();
  });

  it("rolls once immediately from an icon button, without opening a secondary panel", () => {
    const random = vi.spyOn(browser.Math, "random").mockReturnValue(0.5);
    expect([...browser.document.querySelectorAll('.ic-skill')].map(button => button.getAttribute('data-action'))).toEqual([
      'roll:athletics', 'roll:acrobatics', 'roll:sleight', 'roll:stealth',
      'roll:arcana', 'roll:history', 'roll:investigation', 'roll:nature', 'roll:religion',
      'roll:medicine', 'roll:perception', 'roll:insight', 'roll:survival', 'roll:animals',
      'roll:deception', 'roll:performance', 'roll:intimidation', 'roll:persuasion',
    ]);
    for (const button of browser.document.querySelectorAll('.ic-ability,.ic-skill')) {
      expect(button.textContent).toMatch(/^[+-]\d+$/);
      expect(button.querySelector('svg use')).toBeTruthy();
      expect(button.getAttribute('data-tooltip')).toBeTruthy();
    }
    const history = browser.document.querySelector<HTMLButtonElement>('.ic-skill[data-action="roll:history"]')!;
    expect(history.textContent).toBe("+3");
    expect(history.getAttribute("aria-label")).toContain("Historia");
    history.focus();
    history.dispatchEvent(new browser.Event("pointerover", { bubbles: true }));
    expect(random).not.toHaveBeenCalled();
    history.click();
    expect(random).toHaveBeenCalledTimes(1);
    expect(browser.document.querySelector('.ic-toast')).toBeNull();
    expect(browser.document.querySelector('.ic-main .ic-detail,[role="dialog"]')).toBeNull();
    expect(browser.document.querySelectorAll('.ic-skills')).toHaveLength(1);
    expect(browser.document.querySelector('.ic-skill-group,.ic-skills h4')).toBeNull();
    const dexterity = browser.document.querySelector<HTMLButtonElement>('.ic-ability[data-action="roll-ability:dex"]')!;
    expect(dexterity.textContent).toBe("+2");
    dexterity.click();
    expect(random).toHaveBeenCalledTimes(2);
    expect(browser.document.querySelector('.ic-toast')).toBeNull();
    expect(browser.document.querySelector('.ic-main .ic-detail,[role="dialog"]')).toBeNull();
    click('show-history');
    const historyText=browser.document.querySelector('[role="dialog"]')!.textContent;
    expect(historyText).toContain("Historia · d20 11 · 11 +3 = 14");
    expect(historyText).toContain("Destreza · d20 11 · 11 +2 = 13");
    expect(network).not.toHaveBeenCalled();
  });

  it("keeps each saving throw directly below its ability and uses its own modifier", () => {
    const pairs = [...browser.document.querySelectorAll('.ic-attribute-pair')];
    expect(pairs).toHaveLength(6);
    expect(pairs.map(pair => pair.getAttribute('data-ability'))).toEqual(['str','dex','con','int','wis','cha']);
    for (const pair of pairs) {
      const ability = pair.querySelector('.ic-ability')!;
      const save = pair.querySelector('.ic-save')!;
      expect(ability.nextElementSibling).toBe(save);
      expect(save.getAttribute('data-ability')).toBe(ability.getAttribute('data-ability'));
      expect(save.querySelector('use')!.getAttribute('href')).toBe('#ts-icon-shield-check');
    }
    const intelligence = browser.document.querySelector('.ic-ability[data-ability="int"]')!;
    const save = browser.document.querySelector<HTMLButtonElement>('.ic-save[data-ability="int"]')!;
    expect(intelligence.textContent).toBe('+3');
    expect(save.textContent).toBe('+7');
    expect(save.getAttribute('data-tooltip')).toBe('Salvación de Inteligencia\n+3 Inteligencia (puntaje 16)\n+4 Competencia · nivel 10');
    const random = vi.spyOn(browser.Math, 'random').mockReturnValue(0.5);
    save.focus();
    expect(random).not.toHaveBeenCalled();
    save.click();
    expect(random).toHaveBeenCalledTimes(1);
    expect(browser.document.querySelector('.ic-toast')).toBeNull();
    expect(browser.document.querySelector('.ic-main [role="dialog"]')).toBeNull();
    expect([...browser.document.querySelectorAll('summary')].some(s => s.textContent?.includes('Salvaciones'))).toBe(false);
    click('show-history');
    expect(browser.document.querySelector('[role="dialog"]')!.textContent).toContain('Salvación de Inteligencia · d20 11 · 11 +7 = 18');
  });

  it("fills skills down each column and recalculates rows for width and label changes", () => {
    const grid = () => browser.document.querySelector<HTMLElement>('.ic-skills')!;
    const sequence = () => [...grid().querySelectorAll('.ic-skill')].map(s => s.getAttribute('data-action'));
    const initialOrder = sequence();
    expect(browser.getComputedStyle(grid()).gridAutoFlow).toBe('column');
    expect(grid().style.getPropertyValue('--ic-skill-columns')).toBe('6');
    expect(grid().style.getPropertyValue('--ic-skill-rows')).toBe('3');
    change('#ic-review-width', '320');
    expect(grid().style.getPropertyValue('--ic-skill-columns')).toBe('4');
    expect(grid().style.getPropertyValue('--ic-skill-rows')).toBe('5');
    expect(sequence()).toEqual(initialOrder);
    click('route:more'); click('route:settings'); change('[name="labels"]','full'); click('route:summary');
    expect(grid().style.getPropertyValue('--ic-skill-columns')).toBe('1');
    expect(grid().style.getPropertyValue('--ic-skill-rows')).toBe('18');
    expect(sequence()).toEqual(initialOrder);
  });

  it("fills a single condition grid by column with good conditions first and a stable active summary", () => {
    const section = () => browser.document.querySelector<HTMLElement>('.ic-conditions')!;
    const toggle = () => section().querySelector<HTMLButtonElement>('.ic-conditions-toggle')!;
    const choices = () => section().querySelector<HTMLElement>('[aria-label="Seleccionar condiciones"]')!;
    const active = () => section().querySelector<HTMLElement>('[data-active-conditions]')!;
    const selected = () => [...active().querySelectorAll('[data-condition-active]')];
    const groupNames = (kind: string) => [...choices().querySelectorAll(`button[data-condition-kind="${kind}"]`)].map(button=>button.getAttribute('data-tooltip'));
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(choices().hidden).toBe(true);
    expect(active().hidden).toBe(false);
    expect(selected()).toHaveLength(0);
    expect(section().querySelector('.ic-condition-header')!.nextElementSibling).toBe(active());
    expect(groupNames('good')).toEqual(['Acelerar','Bendición','Concentración','Furia','Guía','Heroísmo','Invisible','Santuario']);
    expect(groupNames('bad')).toEqual(['Agarrado','Agotamiento','Apresado','Asustado','Aturdido','Cegado','Derribado','Ensordecido','Envenenado','Hechizado','Incapacitado','Inconsciente','Maleficio','Paralizado','Perdición','Petrificado','Ralentizado','Recargando']);
    expect(section().querySelector('.ic-condition-group,.ic-condition-label')).toBeNull();
    expect([...choices().children].every(child=>child.tagName==='BUTTON')).toBe(true);
    expect([...choices().querySelectorAll('button')].map(button=>button.getAttribute('data-condition-kind'))).toEqual([...Array(8).fill('good'),...Array(18).fill('bad')]);
    expect(browser.getComputedStyle(choices()).gridAutoFlow).toBe('column');
    expect(browser.getComputedStyle(active()).gridAutoFlow).toBe('column');
    expect(choices().children).toHaveLength(26);
    expect(choices().style.getPropertyValue('--ic-condition-columns')).toBe('13');
    expect(choices().style.getPropertyValue('--ic-condition-rows')).toBe('2');
    toggle().click();
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(choices().hidden).toBe(false);
    for (const button of choices().querySelectorAll('button')) {
      expect(button.textContent).toBe('');
      expect(button.querySelector('svg use')).toBeTruthy();
      expect(button.getAttribute('data-tooltip')).toBe(button.getAttribute('aria-label'));
    }
    const random = vi.spyOn(browser.Math, 'random');
    click('condition:Envenenado');
    click('condition:Derribado');
    click('condition:Bendición');
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(choices().querySelector('[data-action="condition:Envenenado"]')).toBeNull();
    expect(choices().querySelector('[data-action="condition:Derribado"]')).toBeNull();
    expect(choices().querySelector('[data-action="condition:Bendición"]')).toBeNull();
    expect(choices().querySelectorAll('button')).toHaveLength(23);
    expect(selected().map(button=>button.getAttribute('data-tooltip'))).toEqual(['Bendición','Derribado','Envenenado']);
    expect(selected().every(button=>button.getAttribute('aria-pressed')==='true'&&button.classList.contains('ic-condition-active'))).toBe(true);
    expect(active().style.getPropertyValue('--ic-condition-rows')).toBe('1');
    const summaryOrder=selected().map(button=>button.getAttribute('data-tooltip'));
    change('#ic-review-width','320');
    expect(choices().style.getPropertyValue('--ic-condition-columns')).toBe('7');
    expect(choices().style.getPropertyValue('--ic-condition-rows')).toBe('4');
    expect(selected().map(button=>button.getAttribute('data-tooltip'))).toEqual(summaryOrder);
    expect(browser.document.querySelector('[role="dialog"]')).toBeNull();
    toggle().focus();
    const summaryBeforeCollapse=active().innerHTML;
    toggle().click();
    expect(choices().hidden).toBe(true);
    expect(active().hidden).toBe(false);
    expect(active().innerHTML).toBe(summaryBeforeCollapse);
    toggle().click();
    expect(active().innerHTML).toBe(summaryBeforeCollapse);
    toggle().click();
    const poisoned = active().querySelector<HTMLButtonElement>('[data-condition-active="Envenenado"]')!;
    poisoned.focus();
    expect(browser.document.getElementById('ic-local-tooltip')!.textContent).toBe('Envenenado');
    poisoned.click();
    expect(selected().map(button=>button.getAttribute('data-tooltip'))).toEqual(['Bendición','Derribado']);
    expect(choices().querySelector('[data-action="condition:Envenenado"]')).toBeTruthy();
    expect(browser.document.activeElement).toBe(toggle());
    click('undo');
    expect(selected()).toHaveLength(3);
    click('redo');
    expect(selected()).toHaveLength(2);
    expect(random).not.toHaveBeenCalled();
    change('[name="character"]','varka');
    expect(selected()).toHaveLength(0);
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    change('[name="character"]','delerion');
    expect(selected()).toHaveLength(2);
    click('route:spells'); click('open-cast:detect');
    browser.document.querySelector('form[data-form="cast"]')!.dispatchEvent(new browser.Event('submit',{bubbles:true,cancelable:true}));
    click('route:summary');
    expect(active().querySelector('[data-condition-active="Concentración"]')).toBeTruthy();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });

  it("reuses the collapsible conditions for companions and combatants without changing a different sheet", () => {
    click('route:more'); click('route:extras');
    browser.document.querySelector<HTMLButtonElement>('.ic-conditions-toggle')!.click();
    click('condition:Envenenado');
    expect(browser.document.querySelector('[data-action="condition:Envenenado"]')!.getAttribute('aria-pressed')).toBe('true');
    click('route:summary');
    expect(browser.document.querySelectorAll('[data-condition-active]')).toHaveLength(0);
    change('#ic-review-role','gm');
    click('select-actor:guardian');
    browser.document.querySelector<HTMLButtonElement>('.ic-conditions-toggle')!.click();
    click('condition:Derribado');
    browser.document.querySelector<HTMLButtonElement>('.ic-conditions-toggle')!.click();
    expect(browser.document.querySelector('[data-condition-active="Derribado"]')).toBeTruthy();
    click('select-actor:delerion');
    expect(browser.document.querySelectorAll('[data-condition-active]')).toHaveLength(0);
    click('select-actor:unbound');
    browser.document.querySelector<HTMLButtonElement>('.ic-conditions-toggle')!.click();
    expect([...browser.document.querySelectorAll<HTMLButtonElement>('.ic-condition-icon[data-action]')].every(button=>button.disabled)).toBe(true);
    change('#ic-review-role','player');
    browser.document.querySelector<HTMLButtonElement>('.ic-conditions-toggle')!.click();
    click('condition:Guía');
    change('#ic-review-state','readonly');
    expect([...browser.document.querySelectorAll<HTMLButtonElement>('.ic-condition-icon[data-action]')].every(button=>button.disabled)).toBe(true);
    const active = browser.document.querySelector<HTMLButtonElement>('[data-condition-active="Guía"]')!;
    expect(active.getAttribute('aria-disabled')).toBe('true');
    active.focus();
    expect(browser.document.getElementById('ic-local-tooltip')!.textContent).toBe('Guía');
    active.click();
    expect(browser.document.querySelector('[data-condition-active="Guía"]')).toBeTruthy();
  });
});
