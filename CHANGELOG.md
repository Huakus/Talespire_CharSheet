# Changelog

Changes to Talespire CharSheet from **1.0.29 through 1.0.34**, inclusive. Historical versions were identified using the `manifest.json` files in the GitHub commit history. Dates use Argentina time (UTC−3).

## 1.0.34 — 2026-10-27

### Shared combat reliability

- Concurrent GM damage and healing are rebased on the latest state; operation identities prevent duplicate application after retries and preserve separate, identical damage rolls.
- Native turn queue synchronization avoids duplicate round changes when two GMs observe the same transition.
- Character-sheet initiative rolls carry the character and combat identities, retry delivery and require GM acknowledgement after persistence. Automatic assignment fills missing initiative only, preserving existing results, including zero and negative values.
- Clearing initiative or changing an association invalidates pending automatic results. Undo refuses to overwrite subsequent changes and is unavailable for an action that incorporated another GM's concurrent edits.

### Character administration

- Added a GM Characters section with search, character sheets, rename, export, archive/reactivate, miniature unlinking and confirmed deletion.
- Archived characters are excluded from player selection. Deletion and unlinking clean up miniature associations and active combat references.
- Database guards enforce GM-only archival and deletion, including requests from older clients.

### Warlock invocations

- Invocation selectors show descriptions and requirements while browsing, before making a choice, with keyboard navigation and an accessible catalog that also explains unavailable options.

### Creatures

- Saving throws and skills use standard numeric bonus controls, preserving unrecognized legacy entries. Combat details provide roll buttons with normal, advantage and disadvantage modes.
- Corrected Spanish ability-name normalization so editing a creature preserves its Strength, Dexterity, Wisdom and Charisma scores.
- Audited all 450 campaign creatures against retained data. Repaired ten campaign records and four shared templates where the evidence was sufficient; uncertain values remain documented for review.
- Recognizes explicit attack bonuses in action text without treating damage values or save DCs as attack rolls.

### TaleSpire capabilities

- Added an experimental **Total only** result presentation for GM creature rolls. The GM retains the breakdown; the published result contains only a numeric total. Native GM-only results are never republished publicly.
- This mode does not guarantee modifier privacy: visible physical dice can allow inference. A two-client TaleSpire verification remains pending.
- Camera focus on a miniature remains unavailable through the documented public API; no unsupported focus action was added.
- Startup errors now include build identity. Distribution packages retain the stable public communication channel while the local Code installation remains isolated.

### Guided level-up fixes

- Level-up confirmation now tolerates unrelated campaign changes made while the wizard is open, including other players' edits and combat updates.
- Concurrent save conflicts are retried against the latest campaign state, with safeguards against duplicate level-ups, changes to the same character, and campaign switches.
- When the same character changes, the wizard displays Spanish recovery instructions and preserves the local draft.
- Save failures no longer disable the confirmation button when the reviewed choices remain valid, allowing another attempt without going back through the wizard.

## 1.0.33 — 2026-10-25

### TaleSpire combat integration

- The GM's Combat section remains available and displays only the miniatures in TaleSpire's turn queue, preserving their order and highlighting the active turn.
- Queue changes are tracked through events and periodic checks.
- Manual encounter management is replaced by a single active combat per campaign, saved automatically whenever its participants or state change.
- Initiative and creature state are preserved, including current, maximum, and temporary HP, AC, conditions, and visibility. Characters refresh their statistics from their character sheets.
- Associations between a miniature instance and a creature or character are saved for reuse. They can be created, changed, or removed from the participant card.

### Initiative and turn order

- Initiative can be rolled from the card using the appropriate modifier and advantage, or entered manually in the participant's details.
- Initiative rolls made from an associated character sheet are automatically added to combat.
- Arrows indicate the recommended position based on initiative. Ties preserve their relative order, and participants without initiative appear last in the recommendation.
- Positions that differ from the recommendation are highlighted with a red border. Missing associations and initiative values are also highlighted.
- The list preserves TaleSpire's actual order; the GM makes position changes in TaleSpire.
- Fixed roll identification for miniatures with identical names, roll cancellation, and the handling of pending results when clearing initiative.

### Participant cards

- New layout with the miniature image and name on the left; identity, statistics, and status in the center; and separate AC, HP, and initiative columns on the right.
- HP uses the full height of its column and includes temporary HP when applicable.
- Quick statistics show speed, passive Perception, and, when applicable, spell save DC and spell attack bonus.
- Active turn, concentration, conditions, and exhaustion are grouped in a dedicated row.
- Improved space usage for long names, missing-association notices, and expanded damage, healing, condition, and association controls.

### Miniature images and diagnostics

- Automatically loads the library image matching the board miniature's active model, refreshing it when its form or content packs change.
- Added loading retries and fixed handling of API errors and images drawn on a canvas.
- New **Image Diagnostics** option in the GM menu shows the version, build, model, loading stage, errors, and image element state. It supports retrying image loads and copying a report.
- Images depend on model availability through TaleSpire's API. Some custom or imported models may still display a placeholder; the exact portrait from the native turn queue is not retrieved.

### Creature editor

- Form organized into identity, combat, ability scores, proficiencies, defenses, traits, actions, and spells.
- A top toolbar keeps Save and Cancel visible while scrolling.
- Improved layout for long fields, compact checkboxes, and ability modifiers that update as scores are edited.
- Vulnerabilities, resistances, and immunities are combined in a table with Spanish damage type labels; condition immunities use selectable chips.
- Traits, actions, reactions, and legendary actions use separate entries with a name, description, and optional usage field, plus controls to add or remove entries.
- Spell search and a selected-spells filter preserve existing selections.
- Imported options, multiline descriptions, and drafts are preserved when navigating or recovering from a save failure.

### Testing

- Added tests for combat persistence, participant UI, initiative synchronization, images, diagnostics, and the creature editor.

Source: [changes from 1.0.30 to 1.0.33](https://github.com/Huakus/Talespire_CharSheet/compare/7df4b6789bdae76a5d83e6f9e774c6f5dbe19cc0...7ec952606fda04f8743bc57172997581494abdfa).

## 1.0.31 and 1.0.32

The `manifest.json` history on `master` jumps directly from **1.0.30 to 1.0.33**. There are no separate commits that allow changes to be assigned to these two versions; their improvements are documented under 1.0.33.

## 1.0.30 — 2026-10-19

- Corrected the symbiote name in the manifest to **Talespire CharSheet**, removing the “Code” suffix.
- Restored the interoperability identifier used before the final 1.0.29 change.

Source: [version 1.0.30 commit](https://github.com/Huakus/Talespire_CharSheet/commit/7df4b6789bdae76a5d83e6f9e774c6f5dbe19cc0).

## 1.0.29 — 2026-10-19

### Character creation

- Guided creation verifies that the campaign has not changed and retries after concurrent modifications, preventing duplicate characters or overwriting other changes.
- Starting equipment and builder purchases use identities, names, and rules from the reviewed Spanish catalog, with bundled templates for offline creation.
- Improved name matching for tools, clothing, ammunition, and other items while preserving personal names and descriptions.

### Potions and spell slot recovery

- Added the ability to administer healing potions to another character, consuming the dose and applying healing in a single operation.
- Corrected the tables displayed by each healing potion variant while preserving distinct variant identities.
- Healing validates the roll result and character sheet revisions, respects maximum HP and Wild Shape, and updates death saving throws and unconsciousness when applicable.
- The Pearl of Power can recover an expended spell slot and converts slots above 3rd level to 3rd level, keeping the original slot reserved until the appropriate rest.
- Updated Pact Magic, Arcane Recovery, and Expert Divination to recognize slots recovered or granted by items and prevent duplicate recovery.
- Expanded tests for equipment, potions, spell slot recovery, localization, and concurrent character creation.

Source: [changes from 1.0.28 to 1.0.29](https://github.com/Huakus/Talespire_CharSheet/compare/48b03faf559c7ae4af1ccec58396897dd5a4f4bc...66686147ffe2b4713cd5be3a609a7074db2db40c).
