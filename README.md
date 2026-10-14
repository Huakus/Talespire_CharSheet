# TaleSpire Character Sheet

Clean TypeScript implementation of a D&D 5e character-sheet Symbiote for
TaleSpire.

## Development

```powershell
npm install
npm run dev:v2
```

Validation:

```powershell
npm run check
```

The application entry point is `v2.html`; production assets are generated in
`dist-v2/` and loaded by `manifest.json`.

The guided builder supports single-class 2014 Fighters, Wizards, Warlocks,
Clerics, Rogues, Barbarians, Bards, Druids and Rangers from level 1 to 20, with PHB and Xanathar options: six Fighter
archetypes, nine Wizard traditions, five Warlock patrons, nine Cleric domains,
seven Rogue archetypes, five Barbarian paths, five Bard colleges and four Druid circles
(with all eight Land terrains), plus five Ranger archetypes. Shared
choices include 15 PHB racial profiles, 18 customizable backgrounds, 57 feats,
equipment packages or gold purchases, and 456 spells with Spanish display text.
Unavailable choices are explained and disabled; duplicate spell learning is
filtered across selectors. Clerics include daily preparation, domain spells,
shared Channel Divinity, rituals and Divine Intervention. See
[`CLERIC_XANATHAR_IMPLEMENTATION.md`](docs/v2/CLERIC_XANATHAR_IMPLEMENTATION.md)
for Cleric coverage and source corrections. Rogue expertise, Arcane Trickster
school restrictions, Spell Thief, equipment and validation are documented in
[`ROGUE_BUILDER_IMPLEMENTATION.md`](docs/v2/ROGUE_BUILDER_IMPLEMENTATION.md),
including which combat effects are resolved at the table.
Barbarian paths, independent totems, storm environments, rage, frenzy exhaustion,
unarmored defense and the level twenty capstone are documented in
[`BARBARIAN_BUILDER_IMPLEMENTATION.md`](docs/v2/BARBARIAN_BUILDER_IMPLEMENTATION.md).
Bard colleges, instrument training, expertise, Magical Secrets, Jack of All Trades,
shared inspiration and manual effect resolution are documented in
[`BARD_BUILDER_IMPLEMENTATION.md`](docs/v2/BARD_BUILDER_IMPLEMENTATION.md).
Druid preparation, circle spells, Wild Shape limits and separate form HP, circle
resources and the manual use of creature stat blocks are documented in
[`DRUID_BUILDER_IMPLEMENTATION.md`](docs/v2/DRUID_BUILDER_IMPLEMENTATION.md).
Ranger favored enemies, terrains, spells, all five archetypes and separate beast
companion resources are documented in
[`RANGER_BUILDER_IMPLEMENTATION.md`](docs/v2/RANGER_BUILDER_IMPLEMENTATION.md).
Open **Crear con tutorial** under character management, choose the class and initial level,
then use **Subir de nivel con tutorial** on that sheet.
The **Progresión** tab shows every recorded level with decisions, replaced
choices, new or improved traits, spell access, HP and resource changes. Search,
expand/collapse and level navigation are available in both sheet modes. This is
a read-only view of the saved tutorial; it does not alter campaign data. See
[`CHARACTER_PROGRESSION.md`](docs/v2/CHARACTER_PROGRESSION.md).
Available options, manual resolutions and remaining coverage are documented in
[`CHARACTER_BUILDER_IMPLEMENTATION.md`](docs/v2/CHARACTER_BUILDER_IMPLEMENTATION.md).
The reviewed rules, corrections and outstanding PHB coverage are recorded in
[`CHARACTER_BUILDER_RULES_AUDIT.md`](docs/v2/CHARACTER_BUILDER_RULES_AUDIT.md).
Wizard rules, school coverage, persistence and manual resolutions are documented
in [`WIZARD_BUILDER_IMPLEMENTATION.md`](docs/v2/WIZARD_BUILDER_IMPLEMENTATION.md).
SRD content attribution and data adaptations are listed in
[`PHB_2014_CONTENT_NOTICE.md`](docs/v2/PHB_2014_CONTENT_NOTICE.md) and in the tutorial's
**Fuentes y créditos** section.

Campaign data in `.localstorage/` is user-owned and intentionally excluded
from Git.

Campaign state is stored in granular, revision-checked Supabase fragments;
campaign-scoped catalog content is stored separately. The persistence model is
documented in [`docs/v2/GRANULAR_PERSISTENCE.md`](docs/v2/GRANULAR_PERSISTENCE.md),
and the catalog model in [`docs/CAMPAIGN_CONTENT.md`](docs/CAMPAIGN_CONTENT.md).
The read-only campaign lore browser is documented in
[`docs/CAMPAIGN_LORE.md`](docs/CAMPAIGN_LORE.md).
