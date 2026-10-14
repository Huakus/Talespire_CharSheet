import type { FighterCreation, FighterLevelChoice, CharacterBuilderState } from "../domain/character/character-builder-model";
import { PHB_SPELLS, classSpells } from "../domain/character/phb-spells";
import { WIZARD_SCHOOLS, WIZARD_SLOTS, WIZARD_SCHOOL_FEATURES, wizardSchool, wizardCantripCount,wizardTraditionName } from "../domain/character/wizard-catalog";
import { replayWizardChoices } from "../domain/character/wizard-builder";
import type { WizardRuntime } from "../domain/character/wizard-model";
const html = (s: string) => s.replace(/[&<>"']/g,(c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
function spellSelect(name: string, label: string, keys: string[], value: string) {
  return `<label>${html(label)}<select name="${name}"><option value="">Elegí un conjuro</option>${keys.map((key) => `<option value="${key}" ${key === value ? "selected" : ""}>${html(PHB_SPELLS[key]!.name)} · ${html(PHB_SPELLS[key]!.school)} · ${PHB_SPELLS[key]!.level}</option>`).join("")}</select></label>`;
}
function spellDescriptions(keys: string[]) { return [...new Set(keys)].filter((key) => PHB_SPELLS[key]).map((key) => { const s = PHB_SPELLS[key]!; return `<details><summary>${html(s.name)}</summary><p>${html(s.castingTime)} · ${html(s.range)} · ${html(s.duration)} · ${html(s.components)}${s.ritual ? " · Ritual" : ""}${s.concentration ? " · Concentración" : ""}</p><p>${html(s.description)}</p>${s.material ? `<p>Material: ${html(s.material)}</p>` : ""}${s.higherLevels ? `<p>${html(s.higherLevels)}</p>` : ""}</details>`; }).join(""); }
export function wizardInitialFields(creation: FighterCreation): string {
  return `<fieldset><legend>Trucos y libro inicial</legend><p>Los trucos se conocen permanentemente. Elegí tres trucos y seis conjuros distintos de nivel 1 para tu libro. Podés aprender magia de cualquier escuela, aunque luego te especialices en una.</p><div class="builder-grid">${[0,1,2].map((i) => spellSelect(`wizardCantrip${i}`,`Truco ${i+1}`,classSpells("wizard",0),creation.wizard.cantrips[i] ?? "")).join("")}${[0,1,2,3,4,5].map((i) => spellSelect(`wizardLearn${i}`,`Conjuro del libro ${i+1}`,classSpells("wizard",1),creation.wizard.learn[i] ?? "")).join("")}</div>${spellDescriptions([...creation.wizard.cantrips,...creation.wizard.learn])}<p>La revisión preparará automáticamente hasta tu cupo inicial. Después podés elegir otra lista desde el libro, tras descansar.</p></fieldset>`;
}
export function readWizardInitial(data: FormData, creation: FighterCreation): void {
  if (data.has("wizardCantrip0")) creation.wizard.cantrips = [0,1,2].map((i) => String(data.get(`wizardCantrip${i}`) ?? ""));
  if (data.has("wizardLearn0")) creation.wizard.learn = [0,1,2,3,4,5].map((i) => String(data.get(`wizardLearn${i}`) ?? ""));
}
export function wizardLevelChoices(state: CharacterBuilderState, choice: FighterLevelChoice, copied: WizardRuntime["copied"] = []): string {
  const replay = replayWizardChoices(state,copied), level = choice.level, school = level === 2 ? choice.subclass as keyof typeof WIZARD_SCHOOLS : wizardSchool(state);
  const currentBook = [...replay.book,...choice.wizard.learn.filter(Boolean)], table = WIZARD_SLOTS[level]!;
  const newCantrips = wizardCantripCount(level)-wizardCantripCount(level-1);
  let result = `<fieldset><legend>Aprendizaje de Mago ${level}</legend><p>Dos conjuros nuevos para el libro, hasta nivel ${table.length}. Espacios: ${table.map((n,i) => `${n} de nivel ${i+1}`).join(" · ")}. No necesitás reemplazar ni olvidar otros conjuros.</p><div class="builder-grid">${Array.from({ length: newCantrips },(_,i) => spellSelect(`wizardCantrip${i}`,`Truco nuevo ${i+1}`,classSpells("wizard",0).filter((key) => !replay.cantrips.includes(key)),choice.wizard.cantrips[i] ?? "")).join("")}${[0,1].map((i) => spellSelect(`wizardLearn${i}`,`Conjuro nuevo ${i+1}`,classSpells("wizard",1,table.length).filter((key) => !replay.book.includes(key)),choice.wizard.learn[i] ?? "")).join("")}</div>`;
  if (school === "illusion" && level === 2) {
    const known = [...replay.cantrips,state.creation.origin.cantrip,...(state.creation.initialFeat?.spells ?? []),...(state.creation.race === "forest-gnome" ? ["minor-illusion"] : [])];
    result += known.includes("minor-illusion") ? spellSelect("wizardBonusCantrip","Ilusión: truco adicional porque ya conocés Ilusión menor",classSpells("wizard",0).filter((key) => !known.includes(key)),choice.wizard.bonusCantrip) : "<p>Ilusión añade Ilusión menor automáticamente, fuera de tu cupo de trucos.</p>";
  }
  if (level === 18) result += `<h4>Maestría de conjuros</h4><p>Cuando estén preparados, podrás lanzarlos a su nivel base sin espacio. Podés cambiar estas elecciones estudiando ocho horas durante la partida.</p><div class="builder-grid">${[1,2].map((n,i) => spellSelect(`wizardMastery${i}`,`Maestría nivel ${n}`,currentBook.filter((key) => PHB_SPELLS[key]?.level === n),choice.wizard.mastery[i] ?? "")).join("")}</div>`;
  if (level === 20) result += `<h4>Conjuros característicos</h4><p>Dos conjuros de nivel 3: siempre preparados sin ocupar cupo, y cada uno dispone de un lanzamiento gratuito por descanso corto o largo.</p><div class="builder-grid">${[0,1].map((i) => spellSelect(`wizardSignature${i}`,`Característico ${i+1}`,currentBook.filter((key) => PHB_SPELLS[key]?.level === 3),choice.wizard.signature[i] ?? "")).join("")}</div>`;
  result += `${spellDescriptions([...choice.wizard.cantrips,...choice.wizard.learn,...choice.wizard.mastery,...choice.wizard.signature])}</fieldset>`;
  if (school) result += `<fieldset><legend>${html(wizardTraditionName(school))}</legend>${school !== "war-magic" ? "<p>Copiar conjuros de esta escuela cuesta la mitad de tiempo y oro.</p>" : "<p>Esta tradición no reduce el coste de copiar conjuros.</p>"}${WIZARD_SCHOOL_FEATURES[school].filter((f) => f.level === level).map((f) => `<h4>${html(f.name)}</h4><p>${html(f.description)}</p>`).join("")}</fieldset>`;
  return result;
}
export function readWizardLevel(data: FormData, choice: FighterLevelChoice, previous: FighterLevelChoice): FighterLevelChoice {
  const text = (name: string) => String(data.get(name) ?? "");
  const wizard = { ...choice.wizard };
  if (data.has("wizardCantrip0")) wizard.cantrips = [0,1,2].filter((i) => data.has(`wizardCantrip${i}`)).map((i) => text(`wizardCantrip${i}`));
  if (data.has("wizardLearn0")) wizard.learn = [0,1].map((i) => text(`wizardLearn${i}`));
  if (choice.subclass !== previous.subclass) wizard.bonusCantrip = "";
  else if (data.has("wizardBonusCantrip")) wizard.bonusCantrip = text("wizardBonusCantrip");
  if (data.has("wizardMastery0")) wizard.mastery = [0,1].map((i) => text(`wizardMastery${i}`));
  if (data.has("wizardSignature0")) wizard.signature = [0,1].map((i) => text(`wizardSignature${i}`));
  return { ...choice,wizard };
}
