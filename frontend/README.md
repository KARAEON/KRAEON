# DULOY

A visualization-first frontend prototype for water planning in Catbalogan City, Pinabacdao, and Calbayog. React, TypeScript, Vite, React Three Fiber / Three.js, and D3 geographic projection.

## Run locally

The DULOY interface is in `frontend` and uses the Laravel water economy database and API in `backend`. Start both services in separate terminals.

Backend terminal:

```powershell
cd backend
composer install
if (!(Test-Path .env)) {
  Copy-Item .env.example .env
  php artisan key:generate
}
php artisan migrate --seed
php artisan serve --host 127.0.0.1 --port 8000
```

Add a `GROQ_API_KEY` to `backend/.env` to enable DULOY AI responses. The backend database and calculated barangay indicators still load without the AI key.

Frontend terminal:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Open http://localhost:5173. The Vite development server forwards `/api` requests to Laravel on port 8000. On Windows with a trusted enterprise certificate chain, Node 24 can use the system trust store with `$env:NODE_USE_SYSTEM_CA='1'` before installing.

```powershell
npm.cmd run build
npm.cmd test
```

## Demo walkthrough

1. Start in Combined MVP and explore the 3D reservoir by dragging or zooming.
2. Select Pinabacdao and choose Severe drought. Observe inflow, closing storage, and sector coverage.
3. Open Policies and enable supplementary supply or essential-needs protection.
4. Save a named scenario, then compare it under Scenarios.
5. Open Spatial view to see active pilot boundaries. Inactive municipalities are excluded from calculations.
6. Edit sector demand and household income in Data; export the current calculated results as CSV.
7. Open **Water GIS** in the top bar to explore the infrastructure map, service zones, barangays, and map-based DULOY AI tools from the current project.

## Important model details

This is a **single-day deterministic simulation**, not forecasting. Daily rates are ML/day; stored volume is ML. Each LGU starts with a fixed illustrative opening storage. Allocations are capped by inflow plus opening storage and use weighted demand. Optional essential-needs protection reserves institutional needs first, then 80% of residential demand as water permits. Excess beyond reservoir capacity spills. Municipal water is never implicitly pooled between LGUs.

The immutable baseline factory seeds 76 ML/day supply and 85 ML/day demand, a 9 ML/day inflow gap. Opening storage covers that baseline gap. Supply gap and actual unmet demand are deliberately separate indicators. The methodology view explains every calculation, including household assistance and affordability.

DULOY's local scenario values are **demonstration data, not official LGU statistics**. Calbayog's provider uses a configurable placeholder because the brief's Calbiga/Calbayog relationship is unverified. Supplemental supply illustrates a possible configurable partnership and does not assert a real service relationship. Backend barangay records include their own data status and calculated indicators. Forecasting remains disabled.

## Structure

- `src/engine/simulation.ts`: typed municipality data, scenario inputs, pure calculation functions.
- `src/engine/simulation.test.ts`: active-area exclusion, conservation, drought, policy, and assistance tests.
- `src/Reservoir.tsx`: animated 3D infrastructure scene with damped water-level transitions, camera controls, reduced-motion support, and a WebGL error fallback.
- `src/Visuals.tsx`: municipal boundary map and proportional flow ribbons.
- `src/BackendDataPanel.tsx` and `src/backendApi.ts`: barangay database browser and Laravel API client.
- `src/water-gis/`: the existing MapLibre water infrastructure map and its supporting AI, analysis, and data panels, served as an in-app GIS view.
- `src/App.tsx`: shared scenario state and interactive workspace, comparisons, editable data, methodology.
- `src/styles.css`: responsive application design.

DULOY scenario copies use browser local storage. The Data page also reads 238 barangay records and calculated states from the Laravel SQLite database. The DULOY assistant sends questions and the current simulation summary to the Laravel decision chat, which uses the configured Groq API key. Database indicators and DULOY's simulation are separate models with different units and assumptions; the interface labels those values separately.

## Geographic attribution

The bundled `public/samar.json` contains all 26 Samar municipality/city boundaries from [faeldon/philippines-json-maps](https://github.com/faeldon/philippines-json-maps), the **2011 low-resolution Samar dataset**. MIT license is included at `public/map-LICENSE.txt`. These boundaries are historical visual context, not verified current legal boundaries.

## Skills

Installed the user-provided `frontend-design` and `ui-ux-pro-max` skills into the user Codex skills directory. Both were applied to this build. The provided UI/UX package contained only `SKILL.md`; its referenced search scripts and design database were not supplied. `DESIGN.md` records the resulting design direction.
