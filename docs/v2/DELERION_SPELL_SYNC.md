# Delerion 3: spellbook reconciliation

Applied to ECE on 2026-10-17 UTC. Source Delerion and all other characters and campaigns were preserved. No catalog changes.

- Added 22 missing level 1–3 wizard spells using the active canonical definitions.
- Integrated existing Forjar Constructo and Transferir Eco as campaign custom spells copied from external books, using Intelligence and normal wizard preparation/slots. Their original IDs, definitions and prepared state were preserved.
- The spellbook has 48 leveled spells and 24 external-copy history records. The character has 55 total spell entries: six existing cantrips, 48 book spells and Hablar con los muertos granted by the campaign necklace described below.
- Preserved four prepared wizard spells, preparation limit 13, currency, slot usage, existing cantrips and all unrelated character data.
- Saeta de fuego was excluded at the GM's explicit direction: wizard book copying does not teach cantrips.
- Hablar con los muertos was resolved by the GM's explicit authorization to create a campaign custom necklace. Its existing spell ID is preserved, its definition references the active PHB canonical entry, and casting now comes from the owned item rather than the wizard book. No additional rulebook or class spell-list expansion was introduced.

Historical copies are recorded at current wizard level 10 because their original acquisition levels, cost and elapsed time are unknown. The interface identifies that uncertainty. Current money was not charged. This does not make future copying free; ordinary copies still pay the calculated cost.

## Runtime support

Copy records now retain provenance, a historical marker and optional per-character custom spell definitions. Standard records remain backwards compatible. Campaign access does not change any global class spell list. Definitions, original spell IDs, preparation/casting and book backups survive rebuilding and future level advancement. Custom copies participate in future mastery/signature selectors by their actual spell level. Recopying retains the original access and definition while charging the normal school-adjusted cost.

External copies display as Libro ajeno in the personal origin filter and in the spellbook/progression history. Copy history distinguishes actual copying costs from unknown historical costs.

## Verification and recovery

`scripts/prepare-delerion-spell-sync.mjs` prepares and validates the update offline. `scripts/verify-delerion-spell-sync.mjs` validates the exported live result. Neither script connects to the database. SQL application requires guarded hashes and revisions, uses one transaction and checks unaffected data. A rollback dry run passed before committing. Target revision changed from 13 to 14; ECE state revision from 1154 to 1155.

Ignored `tmp/delerion-spell-sync/` contains original snapshots, compressed backup, checksums, exact plan, apply/rollback SQL, live post-update export and verification report. The rollback refuses subsequent conflicting changes. `.localstorage/` was not touched.

Validated all actual stored payloads and revisions, catalog and unrelated-fragment hashes, schemas, 24 origin records, level 10 progression history, and an offline level 11 advancement. Six relevant test files passed (117 tests), including custom spell preparation/casting/persistence/level-up/recopying and rejection of Hablar con los muertos as an ordinary PHB wizard copy. TypeScript validation and the active application build passed.

## Completed necklace grant

The GM subsequently authorized **Collar de hablar con los muertos**, a rare ECE homebrew wondrous item requiring attunement. It is saved in the ECE equipment catalog (`gm:equipment:ece-collar-hablar-con-los-muertos`, origin `gm`, tag `custom`) and assigned to Delerion 3, equipped and attuned, with one available charge. No money was deducted. No official spell definition was changed globally.

While worn and attuned, an action consumes its one charge to cast the level 3 PHB spell without components, preparation or spell slots. It uses Intelligence if an ability is needed; this spell ordinarily has no attack or save. The carrier's long rest restores the charge; a short rest does not. The spell retains its normal range, duration, target restrictions, question limit and ten-day repeat restriction. Those narrative target restrictions are adjudicated by the GM; the sheet does not identify or track individual corpses.

`casting.kind = item` and `casting.source = inventory:<item ID>:<feature ID>` link the spell to the owned item's existing resource-backed feature. Domain validation and both spell views check possession, equipment, attunement and resources. Launching consumes the actual inventory charge in the same character mutation, preventing a second launch and fallback to wizard slots. The origin filter displays Objeto mágico; the casting badge names the collar and the cast option shows its remaining charge. Item access remains separate from daily preparation and book copying.

The grant changed target revision 14 → 15 and ECE state revision 1155 → 1156. Verified the exported live payloads, canonical spell association, catalog loading, remaining 48 book spells/24 copies/four prepared spells, offline launch/recharge, and unchanged hashes for all other character/campaign fragments and all previously existing catalog entries. Item tests cover application persistence, fragment round-trip, equipment/attunement/possession loss, charge exhaustion, recovery, serialization, level advancement, UI and availability. TypeScript validation and the production build passed.

`scripts/prepare-dead-necklace.mjs` and `scripts/verify-dead-necklace.mjs` are offline preparation/verification tools. Ignored `tmp/dead-necklace/` holds before/after snapshots, compressed backup, checksums, plan, guarded apply/rollback SQL and the verification report. Application was preceded by a transaction dry run that rolled back. The live item retains its unused 1/1 charge; test casts were offline only. No pending configuration remains for this reconciliation.
