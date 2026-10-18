/** Preserve authored ECE rules; never infer that a custom name is an official item. */
import campaignDecisions from "../src/domain/equipment/campaign-equipment-decisions.json" with { type: "json" };
export function reviewCampaignItem({ value, item, payload, capability, resource, requirements, effect, dawn }) {
  const raw = payload.originals.find((entry) => value.id === `recovery:${entry.originalKey}`)?.raw.payload;
  if (!raw) return false;
  const id = "ece-authored-rule";
  const plain = (text) => String(text).replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/?(?:strong|em|u|b|i)>/gi, "").replace(/\[\/?b\]/gi, "").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").trim();
  value.sources.push({ id, kind: "campaign", title: "ECE · regla de campaña conservada", language: "es", rulesEdition: "2014", locator: item.contentKey, verified: true });
  value.origin = "campaign";
  value.description = (Array.isArray(raw.description) ? raw.description : [raw.description]).filter((text) => typeof text === "string" && text.trim()).map((text, index) => ({ id: `campaign-text-${index}`, type: "paragraph", section: "description", provenance: "campaign", sourceIds: [id], text: plain(text) }));
  for (const feature of raw.features ?? []) if (feature.description?.trim()) value.description.push({ id: `campaign-feature-${value.description.length}`, type: "paragraph", section: "rules", provenance: "campaign", sourceIds: [id], text: `${feature.name}\n${plain(feature.description)}` });
  if (raw.effect?.description?.trim()) value.description.push({ id: "campaign-existing-effect", type: "paragraph", section: "rules", provenance: "campaign", sourceIds: [id], text: plain(raw.effect.description) });
  // Capabilities need a rule block; retain the complete authored text as their reference.
  value.description.forEach((block) => { block.section = "rules"; });
  value.magical = item.index !== "jewlery"; value.properties = value.magical ? ["magic"] : [];
  value.rarity = typeof raw.rarity === "string" ? raw.rarity : raw.rarity?.index ?? (value.magical ? null : "none");
  value.category = item.index === "baston-de-acelerar" ? "staff" : item.index === "wand-of-mage-armor" ? "wand" : value.baseDefinitionId ? "weapon" : value.magical ? "wondrous-item" : "other";
  value.consumable = item.index === "cristal-luciente";
  value.weight = typeof (raw.unitWeight ?? raw.weight) === "number" ? { value: raw.unitWeight ?? raw.weight, unit: "lb" } : null;
  value.economy = { basePrice: null, campaignPrice: raw.cost?.quantity > 0 && ["cp", "sp", "ep", "gp", "pp"].includes(raw.cost.unit) ? raw.cost : null, explanation: "Precio de campaña anterior conservado por separado; cero no se interpreta como precio oficial ni modifica el stock." };
  value.weapon = null; value.armor = null; value.resources = []; value.capabilities = [];
  const attunement = raw.requiresAttunement === true || raw.requires_attunement === true || raw.properties?.some((property) => property.index === "attunement") === true;
  value.requirements = requirements(attunement, value.category === "staff" || value.category === "wand" ? "held" : "worn");
  value.requirements.explanation = "Requisitos conservados de la regla de campaña; no se añade sintonización si el texto y los campos no la exigen.";
  const unmodeled = (explanation) => effect("unmodeled", { explanation, original: structuredClone(raw) });
  const notes = [];
  if (item.index === "amulet-of-wisdom") {
    const decision = campaignDecisions.wisdomAmulet;
    value.sources = value.sources.filter((source) => source.id !== decision.source.id);
    value.sources.push(structuredClone(decision.source));
    value.description.push({ id: "gm-wisdom-saves-clarification", type: "paragraph", section: "rules", provenance: "campaign", sourceIds: [decision.source.id], text: decision.text });
    const rule = capability(value, "wisdom-saves-bonus", "Salvaciones de Sabiduría +1", [structuredClone(decision.effect)]);
    rule.execution.explanation = "Regla de campaña confirmada por el GM. Falta integrar y verificar su aplicación en el formato nuevo.";
    rule.execution.pendingAutomation = [...decision.pendingAutomation];
    value.capabilities.push(rule);
  }
  else if (item.index === "amuleto-de-mago") value.capabilities.push(capability(value, "arcana-bonus", "Ayuda arcana", [effect("bonus", { target: "arcana", operation: "add", value: 2 })]));
  else if (item.index === "túnica-de-agati") value.capabilities.push(capability(value, "agati-ac", "Protección de Agati", [effect("bonus", { target: "armor-class", operation: "add", value: 3, condition: "Mientras lleves puesta la túnica. No cuenta como armadura." })]));
  else if (item.index === "capa-de-carisma-1") value.capabilities.push(capability(value, "charisma-bonus", "Carisma +1", [effect("bonus", { target: "charisma", operation: "add", value: 1, condition: "Llevada y sintonizada; no puede elevar la puntuación por encima de 20. Recalcular las estadísticas derivadas de Carisma." })]));
  else if (item.index === "capa-con-runas") {
    const decision = campaignDecisions.runedCloak;
    value.sources = value.sources.filter((source) => source.id !== decision.source.id);
    value.sources.push(structuredClone(decision.source));
    value.description.push({ id: "gm-slot-clarification", type: "paragraph", section: "rules", provenance: "campaign", sourceIds: [decision.source.id], text: decision.text });
    const rule = capability(value, "additional-spell-slot", "Espacio de conjuro adicional de nivel 1", [structuredClone(decision.effect)]);
    rule.execution.explanation = "Regla aclarada por el GM. Falta integrar el aumento de capacidad con el gasto y recuperación de la reserva del portador.";
    rule.execution.pendingAutomation = [...decision.pendingAutomation];
    value.capabilities.push(rule);
  }
  else if (item.index === "sombra-del-segador") {
    const decision = campaignDecisions.reaperShadow;
    value.sources = value.sources.filter((source) => source.id !== decision.source.id);
    value.sources.push(structuredClone(decision.source));
    // Normalize markup for display while the complete, exact originals remain archived.
    value.description = value.description.map((block, index) => {
      const bullet = block.text.startsWith("* ");
      const text = (bullet ? block.text.slice(2) : block.text).replace(/^#{1,6}\s+/, "").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*\n]+)\*/g, "$1");
      const metadata = { id: block.id, section: index < 2 || index >= 16 && index <= 19 ? "flavor" : "rules", provenance: "campaign", sourceIds: block.sourceIds };
      return bullet ? { ...metadata, type: "list", ordered: false, items: [text] } : { ...metadata, type: "paragraph", text };
    });
    value.description.push({ id: "gm-reaper-clarification", type: "paragraph", section: "rules", provenance: "campaign", sourceIds: [decision.source.id], text: decision.text });
    value.requirements = requirements(true, "other");
    value.requirements.explanation = "Requiere sintonización y contacto con el cuerpo, llevado o vestido de forma visible u oculta. No necesita empuñarlo ni ocupar las manos, según la descripción original.";
    value.resources = [resource("marca", 1, structuredClone(decision.markRecovery))];
    const reference = (indices) => indices.map((index) => `campaign-text-${index}`);
    const singular = (explanation, indices) => effect("unmodeled", { explanation, original: { description: indices.map((index) => raw.description[index]) } });
    const intelligence = capability(value, "intelligence-bonus", "Inteligencia +1", [structuredClone(decision.intelligenceEffect)]);
    intelligence.textBlockIds = ["gm-reaper-clarification"];
    intelligence.execution.pendingAutomation = ["Aplicar y retirar INT +1 al cumplir o perder los requisitos, recalcular sus estadísticas derivadas y evitar duplicar el bono de una copia antigua."];
    value.capabilities.push(intelligence);
    const veil = capability(value, "veil-of-penumbra", "Velo de Penumbra", [
      effect("defense", { defense: "disadvantage", target: "perception-sight-against-bearer", condition: "Solo Percepción para detectar visualmente al portador mientras permanece inmóvil." }),
      singular("Luz brillante pasa a tenue y luz tenue a oscuridad no mágica a 10 pies; conservar la interacción con visión en la oscuridad descrita por el objeto.", [3, 4]),
    ]);
    veil.range = "Radio de 10 pies (3 m)"; veil.textBlockIds = reference([3, 4]);
    veil.execution.pendingAutomation = ["Resolver la iluminación del entorno y la Percepción visual condicionada a que el portador permanezca inmóvil."];
    value.capabilities.push(veil);
    const mark = capability(value, "nearness-mark", "Marca de la Cercanía", [
      effect("damage", { expression: "2d6", damageType: "necrotic", timing: "other", condition: "Solo la primera vez que el objetivo marcado cae por debajo de la mitad de sus PG máximos durante esta marca; no al activarla ni en cada turno." }),
      singular("El objetivo no puede beneficiarse de PG temporales mientras dure la marca; termina al perder la concentración o al cumplirse 1 minuto.", [5, 6, 7, 8, 9]),
    ], { activation: "bonus-action", target: "Una criatura que puedas ver", range: "30 pies (9 m)", duration: "Hasta 1 minuto", concentration: true, costs: [{ resourceId: "marca", amount: 1 }] });
    mark.textBlockIds = [...reference([5, 6, 7, 8, 9]), "gm-reaper-clarification"];
    mark.execution.pendingAutomation = ["Consumir el único uso y recuperarlo al amanecer, sin recargarlo por terminar un descanso.", "Vigilar el umbral de PG una sola vez por marca, el bloqueo de PG temporales, la concentración y su duración."];
    value.capabilities.push(mark);
    const presence = capability(value, "lingering-presence", "Presencia Persistente", [singular("Ventaja en el siguiente ataque o salvación antes del final del siguiente turno; si no se aprovecha, desventaja en la siguiente salvación de Sabiduría.", [10, 11])], { activation: "trigger", trigger: "Una criatura muere a 15 pies (4,5 m) o menos de ti.", duration: "Beneficio hasta el final de tu siguiente turno; la contrapartida se resuelve como indica el texto.", range: "15 pies (4,5 m)" });
    presence.textBlockIds = reference([10, 11]); presence.execution.pendingAutomation = ["Registrar el beneficio pendiente, consumirlo en un ataque o salvación y resolver su contrapartida si no se usa a tiempo."];
    value.capabilities.push(presence);
    const whisper = capability(value, "whisper-of-finality", "Susurro de Finalidad", [
      effect("defense", { defense: "disadvantage", target: "death-saving-throws", condition: "Solo si fallas la salvación de Sabiduría CD 12 al usar la marca, hasta tu próximo descanso largo." }),
      singular("Cada uso de la marca exige Sabiduría CD 12. Fallar también impide acercarse voluntariamente a criaturas con todos sus PG salvo prueba de Sabiduría CD 10. La recuperación al amanecer del uso de la marca no elimina esta penalización.", [12, 13, 14, 15]),
    ], { activation: "trigger", trigger: "Cada vez que uses Marca de la Cercanía.", duration: "Si fallas la salvación, hasta tu próximo descanso largo.", concentration: false });
    whisper.textBlockIds = reference([12, 13, 14, 15]); whisper.execution.pendingAutomation = ["Solicitar Sabiduría CD 12 al usar la marca y aplicar las penalizaciones solo al fallar, sin consumir un segundo uso.", "Mantener la contrapartida hasta el descanso largo aunque llegue un amanecer o termine la marca."];
    value.capabilities.push(whisper);
  }
  else if (item.index === "wand-of-mage-armor") {
    value.resources = [resource("cargas", 3, dawn({ kind: "roll", expression: "1d6+1" }), "cargas")];
    value.capabilities.push(capability(value, "mage-armor", "Armadura de mago", [effect("spell", { spellKey: "mage-armor", level: 1, ability: null, saveDc: null, attackBonus: null, components: "custom", explanation: "La regla de campaña exime únicamente los componentes materiales. Se conservan los demás requisitos del conjuro. La recarga no puede superar 3 cargas." }), unmodeled("Al gastar la última carga: tirar 1d20; con un 1 la varita se destruye. Conservar este procedimiento junto al lanzamiento.")], { activation: "action", costs: [{ resourceId: "cargas", amount: 1 }], target: "Según Armadura de mago", duration: "8 horas" }));
  } else if (value.name === "Collar de hablar con los muertos") {
    value.requirements = requirements(true, "worn"); value.resources = [resource("carga", 1, { kind: "event", event: "long-rest", explanation: "Cuando el portador termina un descanso largo.", amount: { kind: "full" } })];
    value.capabilities.push(capability(value, "speak-with-dead", "Hablar con los muertos", [effect("spell", { spellKey: "speak-with-dead", level: 3, ability: "intelligence", saveDc: null, attackBonus: null, components: "waived", explanation: "Concesión de campaña ya implementada: sin preparación, espacios ni aprendizaje en el libro. Se conserva la regla completa del cadáver, cinco preguntas y diez días entre usos sobre el mismo cadáver." })], { activation: "action", costs: [{ resourceId: "carga", amount: 1 }], range: "10 pies", duration: "10 minutos", target: "Un cadáver válido" }));
  } else if (item.index === "baston-de-acelerar") {
    value.resources = [resource("acelerar", 1, { kind: "event", event: "long-rest", explanation: "Al terminar un descanso largo.", amount: { kind: "full" } })];
    value.capabilities.push(capability(value, "haste", "Acelerar", [effect("spell", { spellKey: "haste", level: 3, ability: null, saveDc: null, attackBonus: null, components: "normal", explanation: "Una vez por descanso largo según la regla de campaña; no se inventan exenciones de componentes ni requisitos adicionales." })], { activation: "action", concentration: true, duration: "Hasta 1 minuto", costs: [{ resourceId: "acelerar", amount: 1 }] }));
    notes.push("El perfil mundano 1d6/1d8 del bastón está conservado en el original; falta representarlo en esta definición antes de migrar.");
  } else if (item.index === "cristal-de-reserva") {
    value.requirements = requirements(false, "held"); value.resources = [resource("cargas", 3, dawn({ kind: "roll", expression: "1d3" }), "cargas")];
    value.capabilities.push(capability(value, "reserve-crystal", "Reserva arcana y descarga", [unmodeled("Tres opciones de gasto 1/2/3; registrar por separado la corrupción MC, la ventana de 10 minutos, identificación, destrucción y uso en mecanismos. No sustituir la descarga por un conjuro oficial ni descartar sus costes de campaña.")], { activation: "other" }));
  } else if (item.index === "cristal-luciente") {
    value.requirements = requirements(false, "held");
    value.capabilities.push(capability(value, "consume-crystal", "Consumir cristal: elegir un efecto", [unmodeled("Elegir recuperación de espacio de nivel 1 o 2d6 PG temporales (con 1d4 de curación solo en el templo). No aplicar ambas opciones. Conservar corrupción, destrucción y uso de tres fragmentos en mecanismos.")], { activation: "action", consumeQuantity: 1 }));
  } else if (value.baseDefinitionId) {
    value.requirements = requirements(true, "held", [{ kind: "other", keys: ["chr_2de8dab74a76cdd8d2b0d37cc84725ea"], explanation: "Hoja Fásica es exclusiva de la variante de Stix, según indicación del GM. No trasladarla a otras dagas." }]);
    value.resources = [resource("salto", 1, { kind: "event", event: "short-rest", explanation: "Un descanso corto o largo recupera el uso.", amount: { kind: "full" } })];
    value.capabilities.push(capability(value, "phase-blade", "Hoja Fásica · Stix", [effect("damage", { expression: "1d6", damageType: "force", timing: "critical", condition: "Solo con un 20 natural en el ataque de Stix; no en todos los impactos. La regla especial no especifica por sí sola cómo se duplican estos dados en el crítico." })], { activation: "trigger", trigger: "Stix obtiene un 20 natural atacando con esta variante." }));
    value.capabilities.push(capability(value, "shadow-step", "Salto entre Sombras", [unmodeled("Teletransporte hasta 15 pies a espacio desocupado visible, sin ataques de oportunidad; una vez por descanso corto o largo.")], { activation: "bonus-action", costs: [{ resourceId: "salto", amount: 1 }], range: "15 pies", duration: "Instantánea" }));
    notes.push("El resumen antiguo aplica 1d6 sin mencionar el 20 natural, pero la característica Hoja Fásica y la instrucción del GM lo restringen a ese disparador. No se reasignan otras copias por compartir la referencia antigua.", "El campo antiguo de ataque +3 podría incluir modificadores del portador; no se convierte automáticamente en una bonificación mágica +3. Falta resolver ese perfil antes de migrar.");
  } else if (item.index === "jewlery") {
    value.requirements = requirements(false); value.rarity = "none";
    notes.push("Entrada genérica de tesoro: el precio es una valoración de campaña por unidad, sin propiedades mágicas atribuidas.");
  } else {
    value.capabilities.push(capability(value, "campaign-rule", "Regla de campaña conservada", [unmodeled("Estructurar todas las condiciones y resolver las diferencias entre campos y texto antes de ejecutar esta regla.")]));
  }
  return { notes, identity: true };
}
