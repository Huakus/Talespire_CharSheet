/** Editorial statements are retained in audit files, never mixed into the rules a player reads. */
export function equipmentInternalParagraph(text:string):boolean {
 if (/^Entrada oficial reutilizada del catálogo de campaña\.$/i.test(text.trim())) return true;
 return /^(?:Resolución asistida: aplicar las condiciones y resultados descritos;|Regla custom consolidada por autorización del GM\. Las versiones antiguas discrepaban|Esta ficha aplica la versión Adaptada[^\n]*se corrige el campo antiguo|La ficha registra «[^»]+»\. No aporta una descripción propia|Conservar y completar las reglas particulares|Texto de uso oficial completo conservado; falta estructurar|La regla íntegra está cotejada en el texto oficial; falta estructurar|La base e infusiones están bloqueadas hasta resolver|Se conserva la decisión ya aplicada en la ficha:|Cerrar la cobertura de|Conservar los originales y cerrar)/i.test(text.trim());
}
export function cleanEquipmentPlayerText(value:string):string {
 const seen=new Set<string>();
 return value.replaceAll('\\n','\n').replace(/<br\s*\/?\s*>/gi,'\n')
  .replace(/\bRequires\s+attunement\b/gi,'Requiere sintonización')
  .replace(/\bScorching Ray\b/g,'Rayo abrasador')
  .replaceAll('Precio de la fila original','Precio base').replaceAll('Peso de la fila original','Peso')
  .split(/\r?\n\s*\r?\n/).map(p=>p.trim()).filter(p=>{
   if(!p||equipmentInternalParagraph(p))return false;
   const key=p.replace(/\s+/g,' ');if(seen.has(key))return false;seen.add(key);return true;
  }).join('\n\n');
}
