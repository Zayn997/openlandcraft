# M3 river authoring validation

October 17, 2026. Complete for one bounded, open river with reversible carving and visual flow. M4 is the next whole-product validation milestone.

## Implementation

The landscape package samples a Catmull–Rom path in plan with a nonincreasing linear elevation profile. Segment bounds limit the grid work needed to derive the channel and blended banks. Carving only lowers the authored field. Core caches evaluated ground by terrain/river identity and shares it with terrain, depth queries, and placement. Brushes always edit authored heights; river edits, visibility, and deletion reevaluate the overlay rather than altering those heights.

Draw river accepts upstream-to-downstream, 0.5 m snapped clicks and commits one command on Finish. Back removes the latest draft point; Cancel/Escape discards draft points. Add river supplies a five-point starter. Selected rivers expose numbered drag handles and numeric X/Y/Z properties. Width, depth, bank blend, flow speed, color, point insertion/removal, and deletion use the existing preview/history/storage system. Invalid numeric drafts remain editable and cannot be applied. Pointer cancellation, Escape, blur, tool changes, and teardown discard active handle previews.

The river ribbon uses animated procedural ripples, a runtime clock, and evaluated terrain depth for clipping. The shared water pause and quality controls affect preview rendering without editing authored geometry. Number labels use owned canvas textures and camera-facing sprites, with numeric inspector fields as the keyboard alternative. GLB models and prior terrain/building workflows remain available.

Version 4 projects persist authored heights and river parameters alongside embedded assets. Versions 1–3 migrate automatically. Existing terrain data, entities, visibility, and source GLB bytes remain intact.

## Automated checks

`npm run build` passes; Vite retains the existing large-chunk warning. `npm test` passes 44 tests across eight files. New coverage includes spline interpolation and elevation order, pure bounded carving, bank restoration, minimum resolution/width checks, unsupported path rejection, migration, cancelled/committed previews, mixed sculpt/river history, visibility/deletion restoration, terrain-anchored instances, and exact portable/IndexedDB round trips. The complete example also round trips with its original GLB bytes and equal evaluated ground.

The reproducible Node benchmark in `scripts/create-river-example.mjs` measured command validation plus derived terrain evaluation for 20 width previews on the 129 × 105 grid: median 2.96 ms and p95 5.49 ms. This excludes browser input, geometry upload, and GPU work.

## Browser checks

QA used `http://localhost:5173/` with the user's existing server; the user's `127.0.0.1` scene was not replaced.

- Added a river and inspected its carved channel and water ribbon with no console errors.
- Dragged point 3 from X/Z -13/-4 to -11/-7 on the initial starter. Undo restored -13/-4; redo restored the move.
- Committed width 6 m, depth 2 m, and flow speed 1.3 together. An uphill elevation of 10 m was rejected and Apply disabled; cancellation restored the valid profile.
- Applied an independent terrain stamp at -18/-17 while a river existed, deleted the river, and restored/deleted it through undo/redo. Exact sample preservation is covered by automated tests.
- Drew a three-point river through snapped ground clicks. Back removed one draft point; Finish created the channel in one step. Inserted a midpoint through Properties, applied it, and undid the insertion.
- Paused water and selected low quality; saved a drawn river with flow speed 1.2. Reload preserved its three points and speed while runtime preview settings reset separately.
- Opened the complete M3 example. A malformed uphill river import during a width-5 preview left the current scene and pending preview intact; cancellation restored width 4.
- Checked a 375 × 844 viewport: document width and scroll width both 375 pixels, with scrollable river fields and the existing scene/property switch.

On the Windows Chromium in-app browser at 1280 × 720, high quality, ANGLE / Intel Arc Graphics / Direct3D11, idle snapshots generally showed 57–60 FPS. Snapshots during build/hot reload or simultaneous QA tabs showed 43–44 FPS. With the extra QA tab closed, the selected five-point example reported 59 FPS, 78 draw calls, and 64,112 triangles. The final fresh tab had no console errors after replacing the initial DOM labels with viewport sprites. These observations are one small-scene baseline, not a performance guarantee for all valid files. The final scene screenshot is `docs/evidence/m3-river.jpg`.

## Scope and example

One river, 2–16 points, 250 m maximum path length, width 1–12 m subject to terrain resolution, depth 0.2–5 m, and bank blending 1–8 m. Points must remain level/downhill, banks must fit inside the site, and tight/crossing/overlapping paths are rejected. No branches, waterfalls, hydraulic simulation, foam/refraction, or automatic floodplain filling. Lowering authored ground below the water surface can expose ribbon edges; the river does not raise ground to build an embankment.

Open `examples/coastal-river.olc.json`: 24 entities including the river, a seven-part building, sculpted terrain, and 11 trees sharing an embedded original GLB. Generate it and rerun the CPU benchmark with `node scripts/create-river-example.mjs`. Portable serialization is exercised by automated tests; this milestone did not repeat the browser download check that stalled during M2.
