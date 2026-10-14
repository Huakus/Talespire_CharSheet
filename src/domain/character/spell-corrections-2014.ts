import type { SpellDefinition } from "./character-spell-model";

// Terminology follows the supplied PDFs. Mechanical corrections follow SRD 5.1
// and the 2014 PHB / Xanathar errata linked in the implementation audit.
export function correct2014SpellText(spells: Record<string,SpellDefinition>) {
  spells["arcane-eye"]!.classes = ["wizard"];
  spells.divination!.classes = ["cleric"];
  spells["faerie-fire"]!.classes = ["bard","druid"];
  spells["meld-into-stone"]!.classes = ["cleric","druid"];
  spells["create-food-and-water"]!.classes = ["cleric","paladin"];
  const append = (key: string,text: string) => { if (spells[key]) spells[key]!.description += ` Aclaración de reglas 2014: ${text}`; };
  const replace = (key: string,from: string,to: string) => { if (spells[key]) spells[key]!.description = spells[key]!.description.replace(from,to); };
  replace("resilient-sphere","Una esfera de fuerza y brillante envuelve a una salvación criatura u objeto de ta- -2 maño Grande o menor -4 dentro del alcance.","Una esfera brillante de fuerza envuelve a una criatura u objeto Grande o menor dentro del alcance.");
  replace("contagion",spells.contagion!.description.split("Ceguera.")[0]!,"Ataque mágico cuerpo a cuerpo. Al impactar, el objetivo queda envenenado. Al final de cada turno hace CON: tres éxitos terminan el conjuro; tres fallos quitan envenenado y aplican una de estas enfermedades durante el resto de la duración. Se pueden curar como enfermedades naturales. ");
  replace("phantasmal-killer","Al comienzo de cada turno del objetivo","Al final de cada turno del objetivo");
  replace("weird","Al comienzo de cada turno","Al final de cada turno");
  replace("sanctuary","Si la criatura protegida realiza un ataque o lanza un conjuro que afecte una criatura enemiga, este conjuro finaliza.","El conjuro termina si la criatura protegida ataca, lanza un conjuro que afecte a un enemigo o causa daño a otra criatura.");
  append("acid-splash","Debés ver a los objetivos.");
  append("polymorph","No afecta criaturas a 0 PG.");
  append("true-polymorph","No afecta criaturas a 0 PG; el objeto resultante es no mágico y no puede superar el tamaño original. Tras una hora completa de concentración, dura hasta ser disipado.");
  replace("true-polymorph","la transformación se vuelve permanente","la transformación dura hasta ser disipada");
  append("disintegrate","Desintegra si este daño deja al objetivo a 0 PG.");
  append("clone","El recipiente debe poder contener a la criatura clonada; no está limitado a tamaño Mediano.");
  append("find-familiar","Al desaparecer a 0 PG o a su dimensión de bolsillo, deja lo que llevaba en su espacio. No deja cuerpo al caer a 0 PG.");
  append("glyph-of-warding","Puede tener efectos no dañinos. Mover superficie u objeto más de 10 pies desde su lugar de creación rompe el glifo sin activarlo.");
  append("heroes-feast","Afecta hasta doce criaturas en total.");
  append("levitate","Un objeto objetivo debe estar suelto.");
  append("magnificent-mansion","Al terminar, expulsa criaturas y objetos dejados dentro.");
  append("sleet-storm","La prueba de concentración se hace al comenzar el turno en el área.");
  append("simulacrum","El duplicado es un constructo.");
  append("true-resurrection","Un muerto viviente regresa a su forma anterior a la no-muerte.");
  append("prismatic-wall","Disipar Magia solo elimina la capa violeta; no interviene una vara de cancelación.");
  append("holy-weapon","La explosión final se centra en el arma, no en el lanzador.");
  const dice: Record<string,[string,string,string]> = {
    "destructive-wave": ["5d6+5d6","choice","constitution"],"conjure-barrage": ["3d8","choice","dexterity"],"conjure-volley": ["8d8","choice","dexterity"],"cordon-of-arrows": ["1d6","piercing","dexterity"],
    "hail-of-thorns": ["1d10","piercing","dexterity"],tsunami: ["6d10","bludgeoning","strength"],"grasping-vine": ["","","dexterity"],"compelled-duel": ["","","wisdom"],
    "searing-smite": ["1d6","fire","constitution"],"staggering-smite": ["4d6","psychic","wisdom"],"blinding-smite": ["3d8","radiant","constitution"],"wrathful-smite": ["1d6","psychic","wisdom"],"thunderous-smite": ["2d6","thunder","strength"],"ensnaring-strike": ["1d6","piercing","strength"],
  };
  for (const [key,[damageExpression,damageType,saveAbility]] of Object.entries(dice)) if (spells[key]) Object.assign(spells[key]!,{ damageExpression,damageType,saveAbility,attackType: "save" });
}
