# OpenLandcraft

OpenLandcraft is a planned open-source browser editor for designing landscapes and buildings in one scene, with AI tools to follow once manual editing is reliable.

The first demonstration is a small site with sculpted hills, an editable winding river, placed trees, and a simple building. Users must be able to save the project, reopen it, and undo changes.

## Project status

M4 validation completed for the bounded manual workflow as of October 17, 2026. The production build and 54 automated tests pass. New site/rename, recovery feedback, GLB instancing, and faster terrain picking/updates complete the terrain, river, model, and basic building workflow. The 500-tree benchmark measured 52–60 FPS navigation and 85–96 ms brush feedback in the final samples on this machine. Isolated browser-profile portability and broader hardware testing remain release checks. See the [M4 validation record](docs/M4_VALIDATION.md) for evidence and limits.

Next direction, October 18: richer ocean/shoreline rendering, landscape tools and materials, deeper building editing, then measured support for larger sites. AI editing and collaboration are deferred. The [M5–M8 roadmap](docs/ROADMAP.md#next-product-target) defines the proposed sequence and exit checks; implementation starts with M5a's ocean foundation.

OpenLandcraft is an independent editor with its own scene model, tools, UI, history, and project format. Pascal is one source for reverse engineering and architectural research, alongside other relevant applications. We will study their behavior and implementation approaches, then design our own systems. General-purpose libraries may support rendering and application development.

## Planning documents

- [Product requirements](docs/PRD.md): users, scope, workflows, and acceptance criteria.
- [Architecture](docs/ARCHITECTURE.md): our editor core, scene data, terrain, rivers, assets, and persistence.
- [Roadmap](docs/ROADMAP.md): ordered milestones and checks required to complete each one.
- [Decisions](docs/DECISIONS.md): working decisions, assumptions, risks, and source references.

## Run locally

Use Node.js 22.14 or a compatible newer version and npm. From this directory:

```powershell
npm ci
npm run dev
```

Open the Local URL printed by Vite, normally http://127.0.0.1:5173/. Run `npm run build` for the production build and `npm test` for core and storage tests.

Choose New to create a coast or flat site with custom dimensions and resolution. Click the project name to rename it. New-site replacement and rename support Undo within the session. The [usage and recovery guide](docs/USAGE.md) explains tools, backups, and browser-local storage.

## Editor prototype

The prototype implements our own validated scene document, commands, preview/commit/cancel lifecycle, undo/redo, local IndexedDB storage, and portable `.olc.json` files. It includes a viewport, scene hierarchy, property inspector, editable terrain, parameterized massing blocks, and an experimental water shader driven by the edited terrain-depth data.

Select an object, change its properties to preview, then Apply changes to commit. Select Sculpt terrain or Site terrain for raise, lower, flatten, and smooth brushes. Adjust radius and strength, then drag on the ground. Releasing commits one undo step; Escape cancels. Switch to the selection tool to navigate. Coordinate stamps provide a keyboard alternative with explicit preview/apply/cancel controls.

In Scene, choose Add building for a rectangular building, or Draw footprint and click two corners in Top view. Footprints snap to 0.5 m. Select a level to move or rotate the building and add elements; select individual walls, slabs, and roofs to edit their numeric properties. Their elevations are relative to the level and remain fixed during sculpting. Parts remain independently editable; changing wall height does not automatically move the roof.

Import GLB embeds a self-contained, uncompressed GLB 2.0 model and places it on the ground. Demo tree supplies an original procedural model without external services. Move, Rotate, and Scale handles commit one undo step on release. Snap uses 0.5 m, 15°, and 0.1 scale increments. Numeric properties provide a keyboard alternative. Choose Follow terrain or Fixed elevation for each model. Scatter copies uses an explicit seed, count, and radius; the copies remain individually editable.

Choose Add river for a starter channel, or Draw river and click upstream-to-downstream points in Top view, then Finish river. Select the river to drag numbered handles in plan or edit point elevations, width, depth, bank blending, flow speed, and color. Insert/remove points in Properties. Apply river changes commits numeric edits; handle release commits a drag. Undo and Escape work through the shared command system. Water animation can be paused and preview quality reduced.

River carving overlays the authored terrain. Sculpting edits the underlying heights; moving, hiding, or deleting the river preserves those edits. The MVP supports one open river with 2–16 points, at most 250 m long. Elevations must descend or stay level, banks must stay inside the site, and tight/overlapping bends are rejected. Minimum width depends on terrain resolution. Flow is a visual shader, with fluid simulation, branching, and waterfalls deferred.

Export saves a portable `.olc.json` project including model bytes and attribution. Open validates it before replacing the scene. Versions 1–3 migrate to version 4, preserving existing objects, source bytes, and authored heights. Prototype limits: 8 MB per GLB, 24 MB of model sources, 16 source models, 1,000 entities, and 40 MB per project file. Draco, Meshopt, KTX2, external resources, imported animation playback, joined wall corners, and openings are deferred.

- [Pascal source findings](docs/research/PASCAL_FINDINGS.md)
- [Ocean reference findings](docs/research/OCEAN_REFERENCE.md)
- [Core contracts](docs/CORE_CONTRACT.md)
- [M0 validation record](docs/M0_VALIDATION.md)
- [M1 validation record](docs/M1_VALIDATION.md)
- [M2 validation record](docs/M2_VALIDATION.md)
- [M3 validation record](docs/M3_VALIDATION.md)
- [M4 validation record](docs/M4_VALIDATION.md)
- [Example coastal project](examples/coastal-study.olc.json): open this file with the editor's Open button.
- [Sculpted coastal example](examples/sculpted-coast.olc.json): includes editable terrain from browser verification.
- [Coastal architecture example](examples/coastal-architecture.olc.json): sculpted ground, a building, and 11 trees with their source GLB embedded.
- [Coastal river example](examples/coastal-river.olc.json): the complete M3 scene, with a winding editable river beside the building and trees.

## References

- [Original planning conversation](https://chatgpt.com/share/6ad31f83-7294-83ea-90eb-1803ed08222b)
- [Pascal Editor](https://github.com/pascalorg/editor)
- [Reference research plan](docs/RESEARCH.md)
