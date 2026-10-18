# OpenLandcraft proposed architecture

Status: Independent MVP implemented through M4; larger package splits and later capabilities below remain proposals. October 17, 2026. See [current contracts](CORE_CONTRACT.md) and [validation](M4_VALIDATION.md).

## Architecture ownership

OpenLandcraft owns its application shell, scene schema, tools, geometry generation, history, and project format. Pascal is one research source for architectural editing. Reference findings inform our design; they do not determine our runtime or internal contracts.

The implemented stack uses TypeScript, React, Vite, Three.js, and React Three Fiber, pinned in package manifests and the lockfile. We implement editor behavior above these general-purpose libraries ourselves.

## System boundaries

The application shell routes input into tools. Tools preview changes and submit commands to the editor core. The core validates and commits changes to the authored scene, records history, and notifies geometry and rendering systems. Project storage serializes that scene and referenced assets. Future AI tools submit the same commands.

Keep one authoritative authored model and transaction system. Selection, camera, panels, and active gestures are session state. Render objects and generated geometry are runtime state derived from the model.

## Proposed code organization

    apps/web/              Application shell, panels, project lifecycle
    packages/core/         Scene schemas, commands, validation, history
    packages/viewport/     Rendering, picking, camera, gizmos, resources
    packages/landscape/    Heightfield, brushes, terrain sampling
    packages/water/        Rivers, carving, geometry, materials
    packages/buildings/    Levels, walls, slabs, roofs, snapping
    packages/assets/       Import, model resources, instances, vegetation
    packages/project/      Storage, migrations, portable project bundles
    docs/                  Requirements, research, architecture, roadmap

Create boundaries as features become real. The first prototype needs only the host, core, viewport, and project lifecycle. Add agent operations when manual commands are stable.

## Authored scene model

Use stable IDs and typed entities with a schema version, parent reference, visibility, and explicit transform where needed. Initial kinds are Site, Terrain, River, AssetInstance, Building, Level, Wall, Slab, and Roof. Asset source files live in a registry referenced by ID.

Use meters, Y up, and an XZ site plane. Define parent-local transforms explicitly. Terrain sampling, river geometry, building placement, and raycasting share coordinate conversion helpers.

Store editable parameters rather than generated vertices. A wall begins with endpoints, thickness, height, and level reference. A slab uses a closed polygon and thickness. The first roof supports a simple documented form. Building elevations remain explicit; terrain edits do not silently relocate architecture.

## Commands and history

Commands validate inputs, compute authored changes, and commit atomically. A completed drag, brush stroke, or property change creates one undo entry. Store inverse patches or bounded before/after data for affected entities and height samples. Previews stay transient until commit; Escape discards them.

Recompute derived geometry after commit, undo, redo, or project load. Geometry updates never create additional history entries. Revision IDs keep autosave and asynchronous results aligned with the scene that produced them.

## Viewport and tools

Build navigation, picking, selection highlights, and transform handles around our entity IDs. A tool state machine handles selection, placement, drawing, dragging, commit, and cancellation. Pointer capture and camera arbitration ensure that a brush stroke cannot also orbit the view.

Map entity IDs to render objects and invalidate only affected geometry. Resources have explicit owners and disposal rules. Establish a browser and renderer baseline in M0; expand rendering features after measuring combined workloads.

## Terrain and rivers

Implement a bounded heightfield with world-to-grid conversion, bilinear sampling, normal updates, and raise/lower/flatten/smooth brushes. Brush strokes commit bounded sample patches. Keep resolution configurable within a measured budget.

M1 implements a 129 by 105 grid for the initial site. Project version 2 stores finite heights with validated dimensions and bounds; version 1 projects migrate by sampling their original coast. A stroke uses a fixed baseline, bounded brush coverage, and distance-spaced stamps. Geometry buffers are updated in place, and water-depth attributes use the same height query. Terrain history retains changed indices and before/after values; object history shares unchanged terrain data.

Retain authored ground separately from derived river carving. Evaluate authored heights followed by ordered river modifiers. Moving or deleting a river changes its carving contribution without destroying independent sculpting. Brush strokes edit authored ground and reevaluate affected modifiers.

A River record stores control points, width, channel depth, bank falloff, point water elevations, and material settings. M3 implements one unbranched Catmull–Rom path in X/Z with a linearly interpolated, nonincreasing elevation profile. It derives a water ribbon and carving field, rejects overlapping/tight bends, and requires the entire corridor inside the site. Both flat and downhill profiles are supported.

M3 updates bounded terrain and water buffers during validated handle previews, then commits one command on release. Carving visits only grid bounds near sampled segments and shares the evaluated surface with placement and water-depth queries. The shader scrolls procedural ripple patterns using an independent clock. Reflection, refraction, waterfalls, physical simulation, and branching follow the validated MVP.

## Water and environmental animation

Treat water as an editable runtime system. Persist river flow direction/speed and surface appearance; for a later Ocean entity, persist water level, wave settings, and surface appearance. The renderer evaluates these parameters against a scene clock. Store settings and seeds, rather than writing each animation frame into the project or undo history. Pause and reduced-quality preview modes should remain possible.

Begin river motion with flowing texture or normal patterns. Explore a bounded ocean surface with procedural waves in a separate rendering experiment before expanding the product scope. Add shoreline treatment, foam, reflections, and refraction incrementally against the browser budget. Visual water motion and physical fluid simulation are separate feature levels.

Use the [ocean reference notes](research/OCEAN_REFERENCE.md) to scope that experiment. Derived depth should update when terrain or water level changes. Optional foam and wetness history are runtime effect buffers: define reset/rebuild behavior on edits and project load, keep them outside command history, and make their cost adjustable.

Blender can help author meshes, textures, normal maps, and baked effects. Its shader graphs, procedural systems, and simulations need an explicit browser-compatible representation; GLB export alone does not establish that they will behave the same in our renderer. Keep interactive river shape and ocean parameters under OpenLandcraft's own control.

## Buildings

Implement a small parametric system: levels, straight walls, polygon slabs, and a simple roof. Provide endpoint/grid snapping and numeric edits. Begin with explicit independent elements; add joins, openings, constraints, and richer relationships incrementally.

Use reference research to specify observable behavior, then implement geometry and commands against our schemas. Full BIM semantics and IFC workflows remain later work.

## Assets and vegetation

M2 imports self-contained, uncompressed GLB 2.0 files. Source bytes live once under stable UUIDs; exact byte equality reuses an existing source on repeated import. Instances reference a source, transform, and terrain/fixed anchoring policy. Temporary URLs stay outside project files. Schema/placement logic currently lives in core, with decoder/resource ownership in viewport; the larger package split above remains a future organization option.

M4 caches sources and batches eligible opaque static GLB meshes with instance-ID selection. Skinned, morphing, transparent, mirrored, and non-mesh sources retain individual clones. Terrain picking traverses grid cells, and small edits update local normals. M2 scattering stores explicit seeded placements as independent instances. Region/density/exclusion-based regeneration remains future work.

## Optional asset production tools

Use Blender MCP for procedural modeling, mesh inspection and cleanup, UVs, texture baking, animation preparation, and export when a task needs them. Use the available Lux3D workflow for generating or processing bespoke models when existing assets or simple procedural geometry are insufficient. Check the connected capabilities when an actual asset task begins.

The proposed production path is brief/reference, generation or modeling, Blender preparation where needed, GLB/textures export, browser validation, then asset-library registration. Preserve editable source files alongside optimized deliverables. Record provenance, units, orientation, pivot, bounds, material/texture requirements, and any animation clips.

Validate scale, materials, texture sizes, geometry cost, and animation playback inside our viewport. Provide static previews or placeholders when animation support is incomplete. These tools help produce app content; opening and editing existing projects must not require a live Blender or Lux connection. Later in-app generation can be a separate service integration.

## Project persistence

M3 uses version 4 of the OpenLandcraft project envelope, with authored ground, river parameters, scene data, and an embedded asset registry. Derived carving and runtime flow clocks are excluded. A portable JSON bundle contains base64 model bytes and attribution; IndexedDB stores the same canonical document. Version 1–3 migration is automatic. Initial limits are 8 MB per model, 24 MB combined model bytes, and 40 MB per project file. A binary archive/Blob store can replace this bounded representation if larger workloads justify it.

Validate and migrate before replacing the open scene. Unknown required entity kinds produce a compatibility error rather than silent data loss. Surface quota, missing-file, and invalid-data failures. Autosave committed revisions in order.

M4 defers autosave during gestures and pauses it after failed hydration until explicit recovery. New-site replacement is an undoable document transaction; file Open resets history after validation. The portable envelope remains version 4.

History works during the session; preserving its stack across restarts is deferred. Prove portability by importing into fresh browser storage and recovering the same parameters and asset bytes.

## Future agent interface

Expose inspection and validated commands through an OpenLandcraft API, with MCP as one possible transport. Manual and agent edits share validation, history, and persistence. REA belongs to the development research toolchain.

## Verification

M0 proves our scene-to-viewport loop, picking, parameter editing, undo/redo, and save/reload. Subsequent checks cover terrain patch reversal, river carving, building geometry, asset bundles, cancellation, and the complete workflow. Record hardware, browser, scene size, and settings with performance results.
