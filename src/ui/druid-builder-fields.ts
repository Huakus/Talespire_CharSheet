import type { CharacterBuilderState,FighterCreation,FighterLevelChoice } from "../domain/character/character-builder-model";
import { DRUID_CIRCLES,DRUID_LANDS,DRUID_FEATURES,druidCircle,druidCantrips,druidCircleSpells,wildShapeLimit } from "../domain/character/druid-catalog";
import { replayDruidChoices } from "../domain/character/druid-builder";
import { PHB_SPELLS,classSpells } from "../domain/character/phb-spells";
import { BACKGROUND_EQUIPMENT } from "../domain/character/phb-character-options";
import { BUILDER_WEAPONS,PHB_EQUIPMENT } from "../domain/character/fighter-builder-catalog";
const html = (s: string) => s.replace(/[&<>"']/g,(c) => ({ "&": "&amp;","<": "&lt;",">": "&gt;",'"': "&quot;","'": "&#39;" })[c]!);
const select = (name: string,label: string,values: Record<string,string>,value = "") => `<label>${html(label)}<select name="${name}"><option value="">Elegí una opción</option>${Object.entries(values).map(([key,text]) => `<option value="${html(key)}" ${key === value ? "selected" : ""}>${html(text)}</option>`).join("")}</select></label>`;
const spells = (keys: string[]) => Object.fromEntries(keys.map((key) => [key,PHB_SPELLS[key]!.name]));
export function druidInitialFields(c: FighterCreation) { return `<fieldset><legend>Magia de Druida · Sabiduría</legend><p>Dos trucos permanentes. Preparás desde toda la lista de Druida tras descanso largo: hasta nivel + SAB, mínimo uno. Los rituales necesitan estar preparados. La clase concede Kit de herborista y lengua Druídica; personalizá competencias repetidas del trasfondo. El círculo se elige en nivel 2.</p>${[0,1].map((i) => select(`druidCantrip${i}`,`Truco ${i+1}`,spells(classSpells("druid",0)),c.druid.cantrips[i])).join("")}</fieldset>`; }
export function druidEquipmentFields(c: FighterCreation) {
  const simple = Object.fromEntries(Object.entries(BUILDER_WEAPONS).filter(([,w]) => w.weapon?.category.startsWith("simple")).map(([key,w]) => [key,w.name]));
  const melee = Object.fromEntries(Object.entries(BUILDER_WEAPONS).filter(([key,w]) => key === "scimitar" || w.weapon?.category.startsWith("simple") && w.weapon.range === "melee").map(([key,w]) => [key,w.name]));
  return `<h3>Prepará tu equipo de Druida</h3>${select("equipmentMethod","Método",{ packages: "Paquetes de clase y trasfondo",gold: "2d4 × 10 po y compras" },c.equipment.method)}<div class="builder-grid">${select("druidPrimary","Escudo de madera o arma sencilla",{ shield: "Escudo de madera",...simple },c.druidPrimary)}${select("druidWeapon","Cimitarra o arma sencilla cuerpo a cuerpo",melee,c.druidWeapon)}${select("druidFocus","Foco druídico",{ "sprig-of-mistletoe": "Ramita de muérdago",totem: "Tótem","wooden-staff": "Bastón de madera","yew-wand": "Varita de tejo" },c.druidFocus)}${BACKGROUND_EQUIPMENT[c.background.equipment].choices.map((d,i) => select(`backgroundEquipment${i}`,d.label,Object.fromEntries(d.keys.map((key) => [key,PHB_EQUIPMENT[key]?.name ?? "Mula y carro"])),c.background.selections[i] ?? d.keys[0])).join("")}</div><p>Además cuero, paquete de explorador y equipo/dinero del trasfondo. Las opciones de arma del paquete no conceden competencia automática. Los druidas no usan armadura ni escudos metálicos; acordá con el GM los materiales de objetos comprados.</p>`;
}
export function readDruidInitial(data: FormData,c: FighterCreation) { const t = (n: string) => String(data.get(n) ?? "");if (data.has("druidCantrip0")) c.druid.cantrips = [0,1].map((i) => t(`druidCantrip${i}`));if (data.has("druidPrimary")) { c.druidPrimary = t("druidPrimary");c.druidWeapon = t("druidWeapon");c.druidFocus = t("druidFocus") as typeof c.druidFocus; } }
export function druidLevelFields(state: CharacterBuilderState,choice: FighterLevelChoice) {
  const replay = replayDruidChoices(state),level = choice.level,c = choice.druid,circle = c.circle ?? druidCircle(state),known = replay.cantrips;
  let result = level === 2 ? `<fieldset><legend>Círculo Druídico</legend>${select("druidCircle","Círculo",DRUID_CIRCLES,c.circle ?? "")}<p>Tierra y Luna: Manual 2014. Sueños y Pastor: Xanathar.</p></fieldset>` : "";
  if (level === 3 && circle === "land") result += select("druidLand","Terreno del Círculo de la Tierra",DRUID_LANDS,c.land ?? "");
  if (level === 2 && circle === "land") result += select("druidBonusCantrip","Truco adicional de Tierra",spells(classSpells("druid",0).filter((k) => !known.includes(k))),c.bonusCantrip);
  result += Array.from({ length: druidCantrips(level)-druidCantrips(level-1) },(_,i) => select(`druidCantrip${i}`,"Nuevo truco de Druida",spells(classSpells("druid",0).filter((k) => !known.includes(k))),c.cantrips[i])).join("");
  const projected = { ...state,levels: [...state.levels,choice] },free = druidCircleSpells(projected).filter((k) => !replay.circleSpells.includes(k));
  if (free.length) result += `<p>Nuevos conjuros del círculo, siempre preparados y fuera del cupo diario: ${free.map((k) => html(PHB_SPELLS[k]?.name ?? k)).join(" · ")}.</p>`;
  result += `<p>Forma Salvaje: VD máximo ${wildShapeLimit(level,circle)}, ${level < 4 ? "sin nado ni vuelo" : level < 8 ? "con nado, sin vuelo" : "con nado y vuelo"}; duración ${Math.floor(level/2)} horas. ${circle === "moon" && level >= 10 ? "Elementales de aire, tierra, fuego o agua por dos usos." : ""}</p>`;
  return result+(circle ? DRUID_FEATURES[circle].filter((f) => f.level === level).map((f) => `<h4>${html(f.name)}</h4><p>${html(f.description)}</p>`).join("") : "")+"<p>La lista de conjuros disponibles crece automáticamente; elegí la preparación diaria desde el panel de Druida después de descansar.</p>";
}
export function readDruidLevel(data: FormData,choice: FighterLevelChoice) {
  const t = (n: string) => String(data.get(n) ?? ""),c = { ...choice.druid };
  if (data.has("druidCircle")) { const circle = (t("druidCircle") || null) as typeof c.circle;if (circle !== c.circle) c.bonusCantrip = "";c.circle = circle; }
  if (data.has("druidLand")) c.land = (t("druidLand") || null) as typeof c.land;
  if (data.has("druidBonusCantrip") && c.circle === "land") c.bonusCantrip = t("druidBonusCantrip");
  if (data.has("druidCantrip0")) c.cantrips = [0,1].filter((i) => data.has(`druidCantrip${i}`)).map((i) => t(`druidCantrip${i}`));
  return { ...choice,druid: c };
}
