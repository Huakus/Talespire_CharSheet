# Workspace scope

`Talespire_CharSheet` is the active TaleSpire symbiote project.

- Make source, test, documentation and build changes only in this directory.
- Treat the sibling directory `Toolset` as a legacy backup; do not edit or build it.
- TaleSpire campaign data under `.localstorage/` belongs to the user and must not be modified by development tasks.
- Build the active application with `npm run build:v2 -- --emptyOutDir=false` when TaleSpire may be locking existing output files.

# UI redesign continuity

- For UI redesign work, read `docs/v2/UI_REDESIGN_PROGRESS.md` first. It records the implemented stage, validation limits, and the next task with implementation steps.
- Keep Actual as the default and the interface choice local. The initial Nueva pilot is read-only; game actions must use shared application commands when added, with behavior tests.
- Update the progress document at the end of each redesign iteration, including completed checks and the next concrete task. Keep the plan and rollout document consistent with it.
- Continue all design reviews in the single canonical prototype `docs/v2/ui-redesign/compact-icon-sheet.html`. Expand and revise its screens, flows and states in place; do not create new HTML mockups for each iteration. Earlier HTML examples are historical references. Keep prototype actions synthetic and separate from the running application until the design review calls for implementation.
- The canonical prototype must open directly in a browser as a self-contained HTML document, offline, with embedded official SVG icons and local tooltips. Do not rely on the conversation viewer's Lucide, Tweak or tooltip runtime. Run `test/v2/ui-prototype.test.ts` when changing these capabilities; update its embedded icon sprite with `scripts/update-ui-prototype-icons.mjs` when adding icon names.
