import type { CharacterBuilderState,FighterCreation,FighterLevelChoice } from "../domain/character/character-builder-model";
import { BarbarianChoicesSchema } from "../domain/character/barbarian-model";
import { BARBARIAN_CORE,BARBARIAN_FEATURES,BARBARIAN_PATHS,TOTEM_ANIMALS,TOTEM_FEATURES,STORM_ENVIRONMENTS,STORM_FEATURES,barbarianPath,barbarianStorm,barbarianRages,barbarianRageDamage } from "../domain/character/barbarian-catalog";
import { BUILDER_WEAPONS,PHB_EQUIPMENT } from "../domain/character/fighter-builder-catalog";
import { BACKGROUND_EQUIPMENT } from "../domain/character/phb-character-options";
const html = (s: string) => s.replace(/[&<>"']/g,(c) => ({ "&": "&amp;","<": "&lt;",">": "&gt;",'"': "&quot;","'": "&#39;" })[c]!);
const select = (name: string,label: string,entries: Record<string,string>,value: string) => `<label>${html(label)}<select name="${name}">${Object.entries(entries).map(([key,text]) => `<option value="${html(key)}" ${key === value ? "selected" : ""}>${html(text)}</option>`).join("")}</select></label>`;
export function barbarianInitialFields() { return `<p>Furia y Defensa sin Armadura desde nivel 1. La senda primitiva se elige en nivel 3. Elegí dos habilidades de clase distintas de las de tu raza y trasfondo. Bárbaro no recibe un estilo de combate.</p>`; }
export function barbarianEquipmentFields(c: FighterCreation) {
  const weapons = (category: string) => Object.fromEntries(Object.entries(BUILDER_WEAPONS).filter(([,w]) => w.weapon!.category.startsWith(category) && (category !== "martial" || w.weapon!.range === "melee")).map(([k,w]) => [k,w.name]));
  return `<h3>Prepará tu equipo de bárbaro</h3>${select("equipmentMethod","Método de equipo",{ packages: "Paquetes de clase y trasfondo",gold: "2d4 × 10 po y compras" },c.equipment.method)}<div class="builder-grid">${select("barbarianWeapon","Arma marcial cuerpo a cuerpo",weapons("martial"),c.barbarianWeapon)}${select("barbarianSecondary","Armas adicionales",{ "two-handaxes": "Dos hachas de mano",...weapons("simple") },c.barbarianSecondary)}${BACKGROUND_EQUIPMENT[c.background.equipment].choices.map((choice,i) => select(`backgroundEquipment${i}`,choice.label,Object.fromEntries(choice.keys.map((k) => [k,PHB_EQUIPMENT[k]?.name ?? "Mula y carro"])),c.background.selections[i] ?? choice.keys[0]!)).join("")}</div><p>Se añaden paquete de explorador, cuatro jabalinas y equipo/dinero de trasfondo. La clase no regala armadura ni escudo. Sin armadura podés usar CA 10 + DEX + CON, compatible con escudo. Elegir un arma a distancia como alternativa simple no incluye munición.</p>`;
}
export function readBarbarianInitial(data: FormData,c: FighterCreation) {
  if (data.has("barbarianWeapon")) { c.barbarianWeapon = String(data.get("barbarianWeapon"));c.barbarianSecondary = String(data.get("barbarianSecondary")); }
}
export function barbarianLevelFields(state: CharacterBuilderState,choice: FighterLevelChoice) {
  const level = choice.level,path = level === 3 ? choice.barbarian.path : barbarianPath(state), pick = choice.barbarian, environment = pick.storm ?? barbarianStorm(state);
  let content = `<fieldset><legend>Bárbaro ${level}${path ? ` · ${BARBARIAN_PATHS[path]}` : ""}</legend><p>Furias: ${level >= 20 ? "ilimitadas" : barbarianRages(level)}; daño de furia +${barbarianRageDamage(level)}.</p>${level === 3 ? select("barbarianPath","Senda primitiva",{ "": "Elegí una senda",...BARBARIAN_PATHS },pick.path ?? "") : ""}`;
  if (path === "totem-warrior" && [3,6,14].includes(level)) content += select("barbarianTotem",level === 3 ? "Espíritu Tótem" : level === 6 ? "Aspecto de la Bestia" : "Sintonía Totémica",{ "": "Elegí un animal",...TOTEM_ANIMALS },pick.totem ?? "")+`<p>Cada elección es independiente: podés repetir un animal o elegir otro. Se incluyen los tres animales del Manual 2014.</p>${pick.totem ? `<p>${html(TOTEM_FEATURES[level as 3|6|14][pick.totem])}</p>` : ""}`;
  if (path === "storm-herald") content += select("barbarianStorm","Entorno del aura",{ "": level === 3 ? "Elegí un entorno" : `Conservar ${STORM_ENVIRONMENTS[barbarianStorm(state)!]}`,...STORM_ENVIRONMENTS },pick.storm ?? "")+`<p>Podés cambiar de entorno en cada ascenso de Bárbaro; no con un descanso. Aura, Alma y Tormenta Furiosa usan el mismo entorno.</p>${environment ? [3,6,14].filter((n) => n <= level).map((n) => `<p>${html(STORM_FEATURES[environment][n as 3|6|14])}</p>`).join("") : ""}`;
  if (path === "zealot" && level === 3) content += select("barbarianDivineDamage","Tipo de daño de Furia Divina",{ "": "Elegí el tipo de daño",radiant: "Radiante",necrotic: "Necrótico" },pick.divineDamage ?? "")+"<p>El tipo se elige al adquirir el rasgo; no se cambia libremente al subir de nivel.</p>";
  return content+[...BARBARIAN_CORE,...(path ? BARBARIAN_FEATURES[path] : [])].filter((f) => f.level === level).map((f) => `<h4>${html(f.name)}</h4><p>${html(f.description)}</p>`).join("")+"</fieldset>";
}
export function readBarbarianLevel(data: FormData,choice: FighterLevelChoice) {
  const text = (n: string) => String(data.get(n) ?? "");
  if (data.has("barbarianPath") && text("barbarianPath") !== choice.barbarian.path) { choice.barbarian = BarbarianChoicesSchema.parse({ path: text("barbarianPath") || null });return choice; }
  if (data.has("barbarianTotem")) choice.barbarian.totem = (text("barbarianTotem") || null) as FighterLevelChoice["barbarian"]["totem"];
  if (data.has("barbarianStorm")) choice.barbarian.storm = (text("barbarianStorm") || null) as FighterLevelChoice["barbarian"]["storm"];
  if (data.has("barbarianDivineDamage")) choice.barbarian.divineDamage = (text("barbarianDivineDamage") || null) as FighterLevelChoice["barbarian"]["divineDamage"];
  return choice;
}
