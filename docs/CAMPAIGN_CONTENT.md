# Catálogo de contenido por campaña

Conjuros, equipo, monstruos, tiendas y checklist se leen y escriben en
`public.campaign_content_entries`. Cada fila pertenece a una campaña mediante
`campaign_id`, y Supabase es la única fuente de contenido.

El documento de campaña no duplica el catálogo. Los miembros pueden leerlo;
solo el propietario o un miembro con rol `gm` puede crear, editar, etiquetar o
eliminar entradas mediante operaciones con control de revisión.

`origin` identifica contenido oficial o creado por el GM. `tags` es una lista
editable que se usa para búsqueda y organización.

Por ahora el Symbiote trabaja exclusivamente en español. El contenido oficial
debe declarar `es`, `español` o `spanish` en sus etiquetas, clave o metadatos
de idioma; las entradas oficiales sin idioma y las marcadas en inglés se
ignoran. El contenido creado por el GM se considera español por compatibilidad,
salvo que esté marcado explícitamente en inglés. Toda entrada que el Symbiote
guarda recibe la etiqueta canónica `es`.
