# Catálogo de contenido por campaña

Conjuros, equipo, monstruos, tiendas y checklist se leen y escriben en
`public.campaign_content_entries`. Cada fila pertenece a una campaña mediante
`campaign_id`, y Supabase es la única fuente de contenido.

El documento de campaña no duplica el catálogo. Los miembros pueden leerlo;
solo el propietario o un miembro con rol `gm` puede crear, editar, etiquetar o
eliminar entradas mediante operaciones con control de revisión.

`origin` identifica contenido oficial, importado o creado por el GM. `tags` es
una lista editable que se usa para búsqueda y organización.

## Contrato canónico de payload

Toda escritura nueva del Symbiote usa un payload autocontenido con
`schemaVersion: 1`, un discriminador `kind` y `language: "es"`. Las propiedades
booleanas se guardan como booleanos, las cantidades como números y las
colecciones como arreglos. Los metadatos de catálogo (`origin`, `tags`, revisión
y clave) permanecen en las columnas de la fila y no se duplican dentro del
payload.

En particular, un conjuro representa sus características por separado:

```json
{
  "schemaVersion": 1,
  "kind": "spell",
  "language": "es",
  "name": "Ejemplo",
  "level": 3,
  "castingTime": "1 acción",
  "ritual": true,
  "concentration": false,
  "components": ["V", "S", "M"],
  "classes": ["cleric", "wizard"],
  "school": "evocation",
  "damageTypes": ["radiant"]
}
```

`ritual` nunca se codifica dentro de `castingTime` en una escritura nueva. Del
mismo modo, `classes`, `components` y `damageTypes` no son textos separados por
comas. Los identificadores estándar se traducen a etiquetas españolas sólo al
presentarlos en la interfaz.

El lector conserva adaptadores para datos anteriores: reconoce `class` como
texto, claves snake_case, estructuras `HP`/`AC`, objetos de API de equipo y el
marcador de ritual `R`. Estos formatos se aceptan únicamente al leer; una entrada
que el GM vuelva a guardar se reescribe en el contrato canónico.

Equipo, monstruos, tiendas y checklist siguen el mismo encabezado. Sus datos
normalizados usan camelCase y tipos JSON reales. Los estados de catálogo no se
mezclan con el payload: las etiquetas de tienda se guardan en `tags`, y el stock
de una tienda vive en el inventario del PNJ asociado.

Por ahora el Symbiote trabaja exclusivamente en español. El contenido oficial
debe declarar `es`, `español` o `spanish` en sus etiquetas, clave o metadatos
de idioma; las entradas oficiales sin idioma y las marcadas en inglés se
ignoran. El contenido creado por el GM se considera español por compatibilidad,
salvo que esté marcado explícitamente en inglés. Toda entrada que el Symbiote
guarda recibe la etiqueta canónica `es`.
