# Current checkpoint

Frontend MVP implemented. Both supplied skills are installed in the user's Codex skills directory.

## Working features

- Immersive simulation layout: the 3D model fills the viewport, controls and impact data float in collapsible trays, live values sit over the scene, and scenario actions use a bottom dock.
- Interactive Three.js reservoir, animated levels, camera rotation/zoom, pause/reset.
- Three pilot LGUs and combined scope; inactive areas excluded from calculations.
- Source editing, drought, demand, allocation priorities, assistance, supplementary supply.
- Geographic boundaries, proportional water-flow ribbons, sector coverage and economic indicators.
- Scenario copies and comparisons, editable data, CSV export, methodology.

## Verification

- TypeScript and production build passed.
- All five engine tests passed.
- Browser verified Pinabacdao severe drought: supply 9 ML/day, unmet demand 1 ML/day, closing storage 0 ML. Supplementary supply: supply 14 ML/day, unmet demand 0, closing storage 4 ML.
- Production 3D scene and geographic map visually checked at desktop size.
- Latest changes improve contrast, small-screen camera fit, and short desktop layouts. Full mobile interaction testing remains to be completed.

## Local preview

Production preview: http://127.0.0.1:4173

Development server: http://127.0.0.1:5173

During initial browser testing, Vite's development module loading failed while the optimized production build worked. The development server was restarted with forced dependency optimization; further dev-mode verification is still advisable. Use the production preview for the current demo.

## Suggested next pass

- Finish mobile browser QA and check scenario persistence after reload.
- Draw map labels above every polygon so neighboring polygons cannot cover labels.
- Add visible moving flow particles on the 3D source/output pipes.
- Replace demonstration inputs and historical boundaries with verified data when available.

No backend or official data integration. AI and forecasts remain placeholders. Read README.md for setup and model details.
