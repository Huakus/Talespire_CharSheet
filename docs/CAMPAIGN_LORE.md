# Biblioteca de lore de campaña

El Symbiote lee el lore directamente desde Supabase y nunca escribe en las
tablas `lore_*`.

## Fuentes

- `lore_chapters`: capítulos Markdown completos.
- `lore_characters`: fichas y alias de personajes.
- `lore_locations`: fichas y alias de lugares.
- `lore_events`: eventos ordenados de la campaña.
- `lore_chapter_*`: relaciones entre documentos.
- `search_campaign_lore`: búsqueda de texto completo en español, con ranking.

Las consultas usan la sesión autenticada del Symbiote y quedan limitadas por
las políticas RLS de membresía de campaña. No se utiliza una clave de servicio.

## Interfaz

Cuando la campaña está conectada a Supabase aparece la sección **Campaña** en
las interfaces de jugador y GM. La biblioteca ofrece:

- índices navegables por capítulos, personajes, lugares y eventos;
- filtro local por nombre o alias;
- búsqueda global con resultados expandibles;
- renderizado seguro del Markdown;
- tabla de contenidos generada desde los encabezados;
- navegación entre capítulos y sus referencias relacionadas.

La sintaxis avanzada se basa en `websearch_to_tsquery`: comillas para frases
exactas, `OR` para alternativas y `-` para excluir términos.
