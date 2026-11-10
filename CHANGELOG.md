# Changelog

Changes to Talespire CharSheet from **1.0.29 through 1.0.44**, inclusive. Historical versions were identified using the `manifest.json` files in the GitHub commit history. Dates use Argentina time (UTC−3).

## 1.0.44 — 2026-11-09

- Added a local interface selector: Actual remains the default; Nueva is an opt-in pilot applied on reload, with a direct return to Actual and separate production styles.
- Nueva's compact Ficha combines level, HP, armor, initiative, speed, identity and roll controls inside the sheet. The shared header keeps character selection, Edit and More options. Character colors can be saved using the shared editor.
- Added bundled official SVG icons, offline tooltips explaining statistic sources, HP indicators that change from green to red, and stacked green/red advantage controls with optional locks.
- Connected XP, guided level advancement, inspiration, skill/ability/save rolls, death save counters and zero-HP healing through shared application commands. The third death save success now restores 1 HP atomically in both interfaces.
- General editing, attacks/spells, rests and condition/resource management remain in Actual. Visual validation in TaleSpire and testing with two real clients remain pending.
- Updated mod.io packaging to include both interfaces, their dynamically loaded assets and the SVG license while preserving module-relative paths and the public communication channel.

## 1.0.43 — 2026-11-01

- Added item workflows for tool checks, conditional advantage, stat-book study, winged-boot flight reserves and additional Channel Divinity uses, with resource recovery and bearer requirements.
- Added last-charge checks and item-specific destruction, transformation and recharge outcomes. Replacement items preserve instance identity and applicable state; destroyed items relinquish their spell grants.
- Equipment packs can be unpacked into their canonical components. Rations record consumption by campaign day. Alchemist's fire, poison potions and acid resolve consumption and target effects together, including ongoing damage, saves, extinguishing and concentration checks where applicable.
- Connected the Doss lute's seven item spells to independent dawn-recovering uses. Item casting stays separate from class spell learning, preparation and spell slots.
- Corrected weapon proficiency matching, linked ranged-weapon bonuses, natural-20 weapon effects and a missing equipped-weapon action. Native equipment imports without an internal archive preserve charges and rules instead of silently reverting to another format.
- Removed repeated editorial text and redundant English auxiliary descriptions covered by Spanish rules. Inventory cards replace known static base-item summary tables with current instance values while retaining healing, armor timing, package quantities, random effects and custom rule tables.
- Updated Spanish equipment templates for character creation and retained audit records, publication guards and regression coverage. The complete equipment-automation objective remains in progress.
- **Shared campaigns:** players must update their Symbiote to this release before opening campaigns that use the new equipment mechanics. Earlier clients do not recognize these rule types and can reject otherwise valid inventory definitions.

## 1.0.42 — 2026-10-31

- Moved creature ability-check and saving-throw buttons from the collapsed combatant summary into the expanded details, preserving modifiers, roll modes and individual combatant names.
- Creature and character combat summaries now consistently show speed plus passive Perception, Investigation and Insight. Creature spellcasters also show their spell save DC and spell attack bonus using the same labels as characters.
- Creature passives honor explicitly listed scores; otherwise they use the listed skill bonus or the actual corresponding ability score. Missing or contradictory passive data displays a dash instead of an invented value.
- Removed duplicate passive readouts from expanded character details when those values are already in the summary.

## 1.0.41 — 2026-10-30

- GM character cards now start collapsed, displaying only the character name and **Open** button. Expanded cards show class/player details, visibility, guided-creation provenance, renaming, export, deletion and group assignment.
- Characters sort by visibility first, then name. **Hidden / Show / Hide** replaces the previous archive terminology; existing hidden sheets retain their state and remain excluded from player selection.
- Removed miniature-linking controls from character administration and character sheets. Participant association remains available in combat.
- Added persistent, collapsible character groups with creation, renaming, per-sheet membership and dissolution without deleting sheets. Group headers show visible/hidden counts, and group actions show or hide every member in a single save.
- Group operations preserve unrelated sheet/combat edits, retry optimistic save conflicts and reject stale membership changes or campaign switches. Deleting a sheet also removes its group membership.
- Search, visibility filters, expanded cards/groups and unsaved name drafts survive view updates. Group data round-trips through shared campaign storage without requiring a new database table.

## 1.0.40 — 2026-10-27

- Added a thin, theme-aware separator between combatant cards in the GM encounter view, with modest spacing to distinguish adjacent participants.

## 1.0.39 — 2026-10-27

- Ability-check and saving-throw colors now affect the modifier text only. Normal button backgrounds, borders, labels, ability scores and interaction styles are preserved; the scale reaches saturated red at −10 and green at +10, with zero retaining its default text color.
- Shop stock and catalog cards share the character inventory's rich description renderer, including expandable full text, lists, tables and inline dice rolls. Linked structured definitions supply complete rules when an older description contains only a summary.
- Shop previews include supplementary capability descriptions, roll shortcuts, uses/costs, additional effects, personal notes and resource recovery rules. Expanding a description survives filtering and rerenders; rolling a preview does not spend stock or discard merchant form changes.

## 1.0.38 — 2026-10-27

- Reorganized spell, equipment and merchant editors into compact sections with responsive columns, properly sized checkboxes, collapsible optional settings and a persistent save/discard toolbar.
- Spell editing exposes every supported definition field, including rules edition/year, casting details, components, materials, classes, attack/save resolution, damage, scaling and campaign tags. Invalid changed dice expressions report an actionable error without discarding the draft.
- Equipment fields adapt to weapon/armor type and charge usage while retaining draft values when switched. Added armor Strength requirements and initial quantity/equipped/attuned controls; ordinary edits preserve advanced rules, capabilities and resource state.
- Merchant editing separates identity/NPC availability, commerce, negotiation, inventory actions and stock. Filtering stock preserves unsaved settings; legacy category references and interaction counters survive saving.
- Creature spells now expose casting details, descriptions, attack/effect rolls, target save DCs and supported higher-level casting in GM combat. English/Spanish PHB names resolve automatically, while campaign definitions take precedence. Spell edits are available to combat immediately.
- Added independent creature spellcasting ability, attack bonus, save DC and caster-level fields. Only unambiguous, explicit casting traits supply defaults; missing automation data is highlighted rather than guessed. Spell slots, uses, targets and concentration remain manual.
- Added regression coverage for editor round trips, draft recovery, duplicate-save protection, advanced equipment preservation, casting-data serialization, spell scaling and actual GM stylesheet behavior.

## 1.0.37 — 2026-10-27

- Character administration now shows status badges: available characters in green, archived characters in bold red.
- Fixed GM button theme specificity overriding the modifier color scale with the golden accent. Modifier fills use broadly supported alpha gradients, retain the default style at zero and preserve readable text in both themes.
- Added regression checks against computed styles using the actual application stylesheet, covering positive/negative modifiers, neutral values and archived status.

## 1.0.36 — 2026-10-27

- Combatant name editing now uses a full-width input labeled **Name**, overriding the narrow input rule used for numeric combat controls.
- Saving throw buttons display only their modifier; accessible names and tooltips still identify the saving throw.
- Ability and saving throw buttons use independent modifier colors, blending from the default style at zero to saturated green at +20 or higher and red at −20 or lower.
- Combat HP is a horizontal meter immediately below the name, retaining current, maximum and temporary HP.
- Initiative sits beside AC in the header, preserving rolling, pending-result warnings and recommended-order indicators.

## 1.0.35 — 2026-10-27

### Character sheets and advancement

- Experience accumulates independently of level, including excess XP spanning multiple levels. Reaching the next threshold gives the level indicator a golden glow and exposes a button to open the existing guided level-up tutorial. Advancing remains a deliberate action.
- Spell selectors for all classes, feats and other catalog choices expose descriptions before selection, including keyboard previews, requirements and unavailable options. Copied wizard spells also include their descriptions.
- Character-sheet initiative results write directly to persisted combat data. They fill pending initiative only, preserve existing zero/negative results, and ignore rolls invalidated by clearing initiative or changing associations. TaleSpire still rolls the dice; GM receipt no longer depends on its message transport.
- Removed the redundant Initiative sheet tab. Section tabs wrap onto multiple rows instead of scrolling horizontally.

### GM character administration

- Replaced native browser deletion confirmations with an in-app confirmation dialog compatible with the TaleSpire WebView.
- Moved character-card actions to the right and grouped editing controls to reduce wasted space.
- Added direct linking to the selected board miniature. Linking updates the sheet, persistent association and current combat together, and clears the superseded binding.

### Combat presentation and identity

- Removed miniature images from combatant cards; native miniature names remain visible, including for unassociated participants.
- Combatant names are independent of miniature names and creature profiles. New creature associations receive the smallest available numeric suffix, starting with no suffix. Individual names can be edited and survive queue changes and profile edits; player names always come from their sheets.
- Saving throws sit directly beneath their matching ability buttons, with green/red styling when their bonus is higher/lower than the ability modifier.
- Compact creature cards show ability checks, saving throws, action roll shortcuts and distinct vulnerability, resistance and immunity labels. AC uses an inline badge. Expanded details provide rules and editing controls without repeating the compact creature statistics.
- Added **Copy name for TaleSpire**, using the native clipboard API where available. The public Symbiote API does not expose miniature renaming, so applying the copied name remains a native TaleSpire action.

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
