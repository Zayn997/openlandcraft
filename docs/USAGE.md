# Run and use OpenLandcraft

Use Node.js 22.14 or a compatible newer version and npm. From the project directory:

```powershell
npm ci
npm run dev
```

Open the URL printed by Vite, normally `http://127.0.0.1:5173/`. Keep using the same hostname and port: `localhost` and `127.0.0.1` have separate browser storage. `npm test` runs the regression suite; `npm run build` checks TypeScript and creates `dist/`.

## Start a site

Choose New in the header. Set a name, dimensions from 20 to 200 m, flat ground or a coast, and 129 × 129 or 257 × 257 samples. Create site replaces the open scene; Undo restores it during the session. Export first to retain both projects across restarts. Click the project name to rename it; on narrow screens use Rename project in Scene.

For a complete demonstration, choose Open and select `examples/coastal-river.olc.json` from this repository. It includes authored hills, a winding river, a building, and embedded trees.

## Edit

- Navigate with orbit, right-drag pan, and scroll zoom in 3D. In Top view, left-drag pans. Frame selection or F centers the view. Select a scene row or a visible object for Properties.
- Sculpt terrain selects the brush tool. Choose Raise, Lower, Flatten, or Smooth, set radius/strength, and drag on the ground. Release commits one undo step; Escape cancels. Coordinate stamps provide preview/apply/cancel without a drag. Return to Selection to navigate.
- Add river creates a starter channel. Draw river uses upstream-to-downstream clicks in Top view, then Finish river. Drag numbered points in plan; edit their Y elevations and width/depth/bank/flow in Properties. Numeric changes need Apply. The path must descend or stay level, remain inside the site, and avoid tight or overlapping bends. Moving/deleting it preserves separately authored ground.
- Add building creates a level, four walls, a slab, and a gable roof. Draw footprint uses two corners in Top view. Select the level for placement/rotation or individual parts for dimensions. Parts keep explicit elevations; changing wall height does not move the roof.
- Import GLB embeds model bytes; Demo tree provides an original model immediately. Move/Rotate/Scale handles commit on release, or use numeric properties and Apply. Follow terrain keeps a ground offset; Fixed elevation uses world Y. Scatter copies uses an explicit seed, count, and radius; every resulting instance remains editable.
- Undo/Redo reverses completed commands. Escape cancels previews. Ctrl+S saves the committed project. Water play/pause and quality are preview settings, outside history.

## Save and recover

Autosave stores one committed project in this browser's IndexedDB after editing settles. A preview is not saved. Wait for Saved locally before closing. Save project requests an immediate save. Export creates a portable `.olc.json` containing scene parameters and embedded sources; keep exported files as backups. Open validates the entire file and its models before replacing the scene, then resets session history. Versions 1–3 migrate to version 4.

If local hydration fails, the visible recovery banner pauses autosave to preserve the unreadable local copy. Open a known valid backup, create a new site, or deliberately Save project to replace it. If a save fails because storage is unavailable or full, Export a file before closing. Invalid file imports leave the current project intact. The editor does not retain multiple local projects or recover an undo stack after restart.

## Supported scope

GLB 2.0 imports must be self-contained and uncompressed. Limits: 8 MB per source, 24 MB combined sources, 16 sources, 1,000 entities, and 40 MB per project file. Draco, Meshopt, KTX2, external resources, imported animation playback, architectural joins/openings, and branching rivers are deferred. Lower preview quality if a scene is slow. The [M4 validation record](M4_VALIDATION.md) gives the measured workload and remaining checks.
