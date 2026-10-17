import { CharacterInventoryItemV2Schema } from "../character/character-inventory-model";
export const SPEAK_WITH_DEAD_NECKLACE_NAME = "Collar de hablar con los muertos";
export const SPEAK_WITH_DEAD_FEATURE = "speak-with-dead";

/** Campaign homebrew granted by the GM, rather than an item from another rulebook. */
export function createSpeakWithDeadNecklace(id: string, order: number) {
  return CharacterInventoryItemV2Schema.parse({
    id,order,group: "Objetos mágicos",name: SPEAK_WITH_DEAD_NECKLACE_NAME,quantity: 1,unitWeight: 0.1,
    cost: { quantity: 0,unit: "" },category: "wondrous-item",properties: ["magic"],
    description: "Objeto maravilloso raro · Personalizado de ECE. Requiere sintonización. Un pequeño relicario de plata contiene una cuenta de ónice grabada con un rostro.\n\nMientras llevás puesto el collar y estás sintonizado con él, podés usar una acción y gastar su única carga para lanzar Hablar con los muertos a nivel 3, sin componentes, preparación ni espacios de conjuro. Usa Inteligencia como característica de lanzamiento si fuera necesaria. La duración es de 10 minutos y el alcance es de 10 pies.\n\nEl cadáver debe conservar la boca y no ser un muerto viviente. Podés formular hasta cinco preguntas. Solo conoce lo que sabía en vida y no está obligado a decir la verdad. El conjuro falla si ese cadáver ya fue objetivo de Hablar con los muertos en los últimos diez días. Se aplican las demás reglas del conjuro del Manual del Jugador 2014.\n\nEl collar tiene una carga y recupera la carga gastada cuando su portador termina un descanso largo. El acceso al conjuro depende del collar: no lo aprendés ni lo añadís al libro de mago. Al quitarlo o perder la sintonización, no podés utilizarlo.",
    equipped: false,attuned: false,requiresAttunement: true,usable: false,consumable: false,
    charges: { current: 1,maximum: 1,reset: "long-rest" },armor: null,weapon: null,bonuses: [],
    features: [{ id: SPEAK_WITH_DEAD_FEATURE,order: 0,kind: "action",name: "Hablar con los muertos",description: "Lanzá Hablar con los muertos (nivel 3) desde Conjuros. Consume 1 carga del collar; se recupera tras un descanso largo. Requiere llevarlo puesto y estar sintonizado.",chargeCost: 1 }],
    effect: { active: false,description: "" },catalog: null,
  });
}
