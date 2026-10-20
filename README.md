# OpenLandcraft

OpenLandcraft is a planned open-source browser editor for designing landscapes and buildings in one scene, with AI tools to follow once manual editing is reliable.

The first demonstration is a small site with sculpted hills, an editable winding river, placed trees, and a simple building. Users must be able to save the project, reopen it, and undo changes.

## Project status

Architecture menu creation added October 20, 2026: **Add… → Architecture → Wall / Floor / Roof**, then choose **Drawing level** in Properties or **Add blank level**. Click corners and finish the wall chain or closed surface outline. The tools show live segment lengths, endpoint/grid snapping, cancellation and repeated creation with one undo step per finished drawing. Floors and flat roofs expose base offset and thickness. Pitched roof creation and reusable types/materials remain planned.

Automatic wall joins added October 20, 2026: choose **Architecture → Wall**, choose a level and wall thickness, then snap to an existing endpoint or the middle of a joined wall. Mixed-thickness corners miter; interior T connections trim to the host face. Walls remain individually editable, with independent thicknesses and preserved opening IDs. Moving a host carries its attached endpoints; moving a branch off its host detaches it. Preview, undo/redo, copied assemblies and version-15 saving preserve connections. Connections require matching base/height (inherited while drawing) and angles of at least 30°. Crossing-wall splitting and three-way endpoint junctions remain unsupported. See [wall-join validation](docs/M7B_WALL_JOINS_VALIDATION.md).

Selected-level Properties now edits the level and links to its existing elements. The old quick-add Wall/Slab/Roof buttons and wall-chain creation controls have been removed; start element creation in the Architecture menu.

Architectural modeling roadmap expanded October 20, 2026: level-based Wall/Floor/Roof creation, connected walls including interior T junctions, reusable element types and materials, floor boundaries, and flat/shed/gable/hip roofs are now explicit prerequisites for the final M7 workflow check. Creation tools and bounded wall joins are delivered increments; the remaining additions are still planned. See the [ordered modeling increments](docs/ROADMAP.md#m7b-remaining-modeling-increments--required-before-final-validation) and [interaction contract](docs/M7_INTERACTION_PLAN.md#october-20-modeling-completion-contract). M8 remains on hold.

River and lake volumes/underwater viewing added October 20, 2026: select either type in **Water System** and choose **Dive into river** or **Dive into lake**. Their volumes follow the existing sloped channel or lake shoreline, with animated undersides, bed-aware depth tint and a **Return to 3D** action. Both work without an ocean; Ocean keeps its own controls and waves. **215 tests** and the production build pass. See [validation and limits](docs/INLAND_WATER_VOLUME_VALIDATION.md).

Terrain closure and the first ocean volume/underwater pass added October 19, 2026: terrain sides follow the sculpted edge and connect to a closed bottom. Ocean cut faces meet the existing animated waves and seabed. **Dive** frames submerged water with a visible wave underside and depth tint; **3D** returns to editing and **Shore** retains the horizon. Existing projects need no migration. **211 tests** and the production build pass. See [validation and limits](docs/TERRAIN_WATER_VOLUME_VALIDATION.md).

M7b direct floor/roof editing added October 18, 2026: single-click selects; double-click or Enter exposes corner and edge handles. Drag the surface to move the outline, add/remove corners, or enter precise coordinates. Gables remain pitched until explicitly converted. Invalid drags cancel and each valid drag is one undo step. **165 tests** and the production build pass. See [outline validation](docs/M7B_OUTLINE_EDIT_VALIDATION.md).

M7b direct opening editing added October 18, 2026: in normal selection mode, click a door or window once to select it, then double-click to edit. Drag its body or square grips. No separate edit tool is required. Move and width resize work in plan and 3D; height has a 3D grip and precise fields. Invalid drops cancel, each drag is one undo action, and saved openings remain independent across floors. **150 tests** and the production build pass. See [editing validation](docs/M7B_OPENING_EDIT_VALIDATION.md).

M7b click placement added October 18, 2026: choose **Place door on wall** or **Place window on wall** in the viewport toolbar, choose an active floor and sizes, then hover and click a wall. Repeated placement, 0.1 m offset snapping, fit/overlap feedback, Escape, one-step undo, and version-13 saving are supported. The active floor is temporarily isolated with its roof hidden. See [placement validation](docs/M7B_OPENING_PLACEMENT_VALIDATION.md).

Direct unit/floor repetition implemented October 18, 2026 as the first M7c increment: select a floor or grouped unit, choose **Duplicate above** beside it in the viewport, then **Place copy above** repeatedly. Escape clears the next preview. Copies retain editable walls, openings and slabs; one roof moves to the top. Shift-click elements to make a unit, switch active floors, and isolate a floor for editing. The scene tree groups buildings, floors and units. Open [Repeated units study](examples/repeated-units.olc.json). Version 13 preserves old projects. See [validation and limits](docs/M7C_REPETITION_VALIDATION.md). Direct door/window placement is now available; wall and floor/roof outline handles are also delivered; M8 stays on hold.

M7a architectural geometry foundation implemented October 18, 2026: draw joined wall chains in plan, add real door/window cutouts through the inspector, edit floor and flat-roof outlines numerically, and view dimensions. Shared corners and hosted cuts use preview, Apply, Cancel, undo, and version-12 saving. Older walls stay independent until **Join wall chain** is enabled. Open [Architectural pavilion](examples/architectural-pavilion.olc.json), which retains the ocean, Water System, path, and landscape regions. The implementation validation recorded **127 passing tests** and a successful production build. See [validation and bounds](docs/M7_ARCHITECTURE_VALIDATION.md). Custom polygon roofs are flat. **M7 remains open:** the [refined M7 workflow](docs/M7_INTERACTION_PLAN.md) now tracks delivered repetition separately from remaining direct authoring work. **M8 is on hold.**

M6c landscape regions implemented October 18, 2026: **Landscape regions → Surface / Planting** adds drawn ground materials and seeded planting with density, model, scale, spacing and water/path/building exclusions. Regeneration previews before Apply; individually edited plants detach and survive later regeneration. Version-11 files retain boundaries, settings and generated results. Open [Landscape regions study](examples/landscape-regions.olc.json). **117 tests** and the production build pass. See [validation and limits](docs/M6C_REGIONS_VALIDATION.md). The existing large-scene brush latency gate remains open.

M6b Water System UI and lakes implemented October 18, 2026: **Water System → River / Lake** groups inland-water authoring, while **Ocean stays separate**. Lakes support drawing, numbered boundary handles, level/depth/bank edits, gentle wind waves, water materials, foam and wet banks. Basin carving preserves authored sculpting; previews, undo and version-10 saving use the existing core. Open [Water System study](examples/water-system.olc.json). **105 tests** and the production build pass. See [validation and limits](docs/M6B_WATER_SYSTEM_VALIDATION.md), including the remaining large-scene brush latency issue.

M6a surface paths completed October 18, 2026: draw and edit a terrain-following route, adjust width, choose gravel/stone paving/timber, snap endpoints to building edges, and view plan dimensions. Path previews, undo/redo, and version-9 saves preserve the authored terrain and water. Open [Pavilion to shore](examples/coastal-paths.olc.json), or choose **Draw path**. **96 tests** and the production build pass. See [path validation and limits](docs/M6A_PATHS_VALIDATION.md). Grading, fixed-elevation paths, bridges, and junctions remain deferred.

River water engine added October 18, 2026: rivers now use the ocean's wave bank through a depth-aware channel field, with downstream foam transport, persistent wet banks, and their own motion controls. This extends the earlier shared-material pass to surface behavior. Open [River water study](examples/river-water-study.olc.json), select Study river, and use Water motion. **88 tests** and the production build pass. [Verification, sampled motion and performance limits](docs/RIVER_WATER_VALIDATION.md). The largest 500-tree scene measured 88–132 ms brush samples, so it is not consistently within the provisional 100 ms target.

M5c material authoring completed for its bounded scope, October 18, 2026: editable sand/grass/rock palettes, world-space detail size, roughness, slope-based rock, and shared river/ocean clarity, roughness, ripple size and presets. Preview, Apply, Cancel, undo and portable saving use the editor core. Open [Coastal materials](examples/coastal-materials.olc.json) for the combined example. **82 tests** and the production build pass. [Validation and limits](docs/M5C_MATERIALS_VALIDATION.md). Full reference-video fidelity remains an open visual target; M6a now adds the first surface-path workflow.

Ocean reference rebuild, October 18, 2026: the linked video's beach, shoreline, swimmer, and offshore shots informed overlapping directional swells, rounded green wave faces, finer crest foam, and clearer shallows. Clouds are removed; a plain environment supplies reflections. Open [Coastal water study](examples/coastal-water-study.olc.json) and choose **Shore**. **76 tests** and the production build pass. See [the implementation and verification record](docs/VIDEO_WATER_VALIDATION.md) and [the stepped shoreline review](docs/evidence/video-water-motion/index.html). This is an independent above-water approximation; overturning surf and the video's full rendering fidelity remain open.

First M5c appearance pass implemented October 18, 2026: terrain/object transmission with bounded refraction, RGB absorption, sky/cloud reflections, finer surface normals, shared beach/seabed material, and a Shore camera with visual surroundings. Open [Clearwater coast](examples/clearwater-coast.olc.json), then choose **Shore**. All **72 tests** and the production build pass. See [appearance validation and remaining gaps](docs/M5C_VALIDATION.md). This advances toward the linked coastal video; it does not establish matching showcase quality or complete all M5c work.

M5b coastal motion implemented October 18, 2026: depth-dependent wave fronts, a breaker region, run-up/retreat, advected foam history, and wet sand that dries. All **68 tests** and the production build pass. Open the [coastal shore example](examples/coastal-shore.olc.json), read [validation and limits](docs/M5B_VALIDATION.md), or inspect the [sampled motion review](docs/evidence/coast-motion/index.html). These are bounded visual effects; M5c still needs to improve water/seabed appearance and materials toward the reference's visual target.

M5a ocean foundation implemented October 18, 2026: directional waves, wavelength controls, shallow-water fading, accurate terrain-driven clipping, and Add ocean for sites without water. Version 1–4 projects migrate to version 5. All 60 tests and the production build pass. See [M5a validation](docs/M5A_VALIDATION.md) and open the new [coastal ocean example](examples/coastal-ocean.olc.json).

M4 validation completed for the bounded manual workflow as of October 17, 2026. The production build and 54 automated tests pass. New site/rename, recovery feedback, GLB instancing, and faster terrain picking/updates complete the terrain, river, model, and basic building workflow. The 500-tree benchmark measured 52–60 FPS navigation and 85–96 ms brush feedback in the final samples on this machine. Isolated browser-profile portability and broader hardware testing remain release checks. See the [M4 validation record](docs/M4_VALIDATION.md) for evidence and limits.

Next direction: M7 architectural editing beyond massing, followed by measured support for larger sites. Clouds, AI editing, and collaboration are deferred. The [M5–M8 roadmap](docs/ROADMAP.md#next-product-target) defines the sequence and exit checks.

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

In Scene, choose Add building for a rectangular building, or Draw footprint and click two corners in Top view. Footprints snap to 0.5 m. Select a level to move or rotate the building; create elements from the Architecture menu and select individual walls, slabs, and roofs to edit their numeric properties. Their elevations are relative to the level and remain fixed during sculpting. Parts remain independently editable; changing wall height does not automatically move the roof.

Import GLB embeds a self-contained, uncompressed GLB 2.0 model and places it on the ground. Demo tree supplies an original procedural model without external services. Move, Rotate, and Scale handles commit one undo step on release. Snap uses 0.5 m, 15°, and 0.1 scale increments. Numeric properties provide a keyboard alternative. Choose Follow terrain or Fixed elevation for each model. Scatter copies uses an explicit seed, count, and radius; the copies remain individually editable.

Choose **Water System → River → Add starter river**, or **Draw river** and click upstream-to-downstream points in Top view, then Finish river. Select the river to drag numbered handles in plan or edit point elevations, width, depth, bank blending, flow speed, and color. Insert/remove points in Properties. Apply river changes commits numeric edits; handle release commits a drag. Undo and Escape work through the shared command system. Water animation can be paused and preview quality reduced.

Choose **Water System → Lake → Draw lake**, click at least three shoreline points, then Finish lake. Add starter lake offers an eight-point basin where space allows. Edit level, depth, bank blend, wind waves, material, foam and wet banks in the Lake panel. This increment permits one lake with 3–24 points and one river; their banks must remain separate. Lake water stays bounded, with no automatic overflow or junction simulation. Ocean remains in its own sidebar group and inspector.

River carving overlays the authored terrain. Sculpting edits the underlying heights; moving, hiding, or deleting the river preserves those edits. The MVP supports one open river with 2–16 points, at most 250 m long. Elevations must descend or stay level, banks must stay inside the site, and tight/overlapping bends are rejected. Minimum width depends on terrain resolution. Flow is a visual shader, with fluid simulation, branching, and waterfalls deferred.

Choose Add ocean when a site has no ocean. Edit water level, amplitude, wavelength, direction, speed, color, and Shore and beach controls in Properties, then Apply changes. Direction 0° travels toward +X; 90° toward +Z. Depth changes wave progression; arriving waves generate run-up, foam, and wet sand. Pause water to reset or step the shore preview. Runtime histories rebuild on reopening.

Select Site terrain → Surface materials for Coastal, Woodland, and Arid palettes, sand/grass/rock colors, detail size, roughness, and rock slope. Use Apply materials or Cancel materials. Ocean and river Properties share Clear coastal, Cool blue, and Silty green presets plus clarity, roughness, and fine-ripple size. Water material changes leave primary wave geometry unchanged.

Export saves a portable `.olc.json` project including model bytes and attribution. Open validates it before replacing the scene. Versions 1–14 migrate to version 15, preserving existing settings, source bytes, and authored heights while adding defaults introduced by earlier water/material milestones. Legacy walls retain independent behavior until joins are enabled. Prototype limits: 8 MB per GLB, 24 MB of model sources, 16 source models, 1,000 entities, and 40 MB per project file. Draco, Meshopt, KTX2, external resources, imported animation playback, crossing-wall splitting, and advanced BIM remain deferred.

- [Pascal source findings](docs/research/PASCAL_FINDINGS.md)
- [Ocean reference findings](docs/research/OCEAN_REFERENCE.md)
- [Core contracts](docs/CORE_CONTRACT.md)
- [M0 validation record](docs/M0_VALIDATION.md)
- [M1 validation record](docs/M1_VALIDATION.md)
- [M2 validation record](docs/M2_VALIDATION.md)
- [M3 validation record](docs/M3_VALIDATION.md)
- [M4 validation record](docs/M4_VALIDATION.md)
- [M5a validation record](docs/M5A_VALIDATION.md)
- [M5b validation record](docs/M5B_VALIDATION.md)
- [M5c appearance validation](docs/M5C_VALIDATION.md)
- [Example coastal project](examples/coastal-study.olc.json): open this file with the editor's Open button.
- [Sculpted coastal example](examples/sculpted-coast.olc.json): includes editable terrain from browser verification.
- [Coastal architecture example](examples/coastal-architecture.olc.json): sculpted ground, a building, and 11 trees with their source GLB embedded.
- [Coastal river example](examples/coastal-river.olc.json): the complete M3 scene, with a winding editable river beside the building and trees.

## References

- [Original planning conversation](https://chatgpt.com/share/6ad31f83-7294-83ea-90eb-1803ed08222b)
- [Pascal Editor](https://github.com/pascalorg/editor)
- [Reference research plan](docs/RESEARCH.md)

M7b direct wall editing: single-click selects a wall; double-click or Enter exposes body movement and Start/End handles in plan and 3D. Joined corners follow, invalid changes cancel, and each drag is one undo step. Doors/windows now use double-click rather than repeated single clicks. See [wall validation](docs/M7B_WALL_EDIT_VALIDATION.md).

Selection shortcuts: **Delete / Backspace** removes the selected element (including directly selected doors/windows); **Ctrl/Cmd Z** restores it. Multi-selection deletes as one undo step. Typing in fields and open dialogs do not delete scene objects.

Editor clipboard: **Ctrl/Cmd C / V** copies and pastes independent scene elements, including hosted openings and groups, with one-step undo. **F** now eases the camera to the selection; drag, scroll or Escape interrupts it. Clipboard contents last for the open editor session.

Direct duplication: **Alt + left-drag** an element to preview a copy, then release to place it. The original stays in place. **Escape** cancels; **Ctrl/Cmd Z** undoes the placement. Selected units, floors and multiple parts copy together. Doors/windows copy along their existing wall with placement validation.

Sidebar quick actions: double-click an object (including a level) or layer name to rename it inline. F2 also starts renaming; Enter or clicking away saves, Escape cancels, and undo restores the prior name. Right-click a layer for Rename, Parent layer, Color and Delete empty layer, or use the Layer actions toolbar button. Layer settings now float over the workspace instead of occupying sidebar height.
