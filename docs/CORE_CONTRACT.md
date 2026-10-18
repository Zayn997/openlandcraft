# Editor contracts through M4

## Document

The current project envelope is `openlandcraft.project`, version 4, in meters with Y up. The site owns dimensions, coast seed parameters, and an explicit authored heightfield. Version 1 files migrate by sampling their analytic coast; versions 2 and 3 preserve their heights exactly. Existing entities and embedded assets survive migration; older files without a library gain an empty one. Entities have stable unique IDs, a parent, kind, name, and visibility. Site and terrain IDs are reserved. Unknown versions, fields, and kinds are rejected before scene replacement.

Blocks persist a base position, dimensions, Y rotation in degrees, and color. Oceans persist water level, wave amplitude, wave speed, and color. Terrain stores row-major heights, columns, and rows. The initial grid is 129 by 105; validation caps either side at 257 and heights at -9 to 35 meters. Changing the resolution through a brush command is prohibited.

Levels have fixed world positions and Y rotation. Walls, slabs, and roofs must reference an existing level. Wall endpoints and slab/roof centers use level-local X/Z coordinates; elevations are relative to the level. Walls have height/thickness; rectangular slabs have width/depth/thickness; gable roofs have width/depth/rise. A level's visibility controls all its parts. Deleting it cascades to those parts atomically. Roof and wall elevations are independently authored.

Instances reference embedded GLB sources by stable IDs, with position, Y rotation, three-axis scale, and terrain/fixed anchoring. Terrain-mode Y means a ground offset sampled at the instance's X/Z. Fixed-mode Y means world elevation. Model origins normalize to bottom-center without modifying source bytes. Scatter uses a stored result of seeded radial placements, rather than regenerating on reload.

A river owns 2–16 world-space X/Y/Z control points, width, depth, bank blend, flow speed, and color. Y is water elevation. Point order is upstream to downstream. This version permits one open, non-overlapping path, with nonincreasing elevations, adjacent point separation of at least 1 m, and length at most 250 m. Width is 1–12 m and must span at least two terrain-grid intervals; depth is 0.2–5 m, and bank blend is 1–8 m. The entire corridor must fit inside the site and its bed must stay above -9 m. Tight bends and closed/crossing paths are rejected before commit.

Catmull–Rom plan samples and linearly interpolated water elevations drive carving and the water ribbon. Authored heights remain separate. `evaluateProject` applies the visible river to derive rendered heights, cached by authored field and river identity. Carving only lowers ground and blends channel banks into the existing surface. Terrain meshes, river depth, ocean depth, new fixed-object placement, and terrain-anchored instances share the evaluated surface. Brushes and terrain undo patches always operate on authored heights. Hiding/deleting/moving the river never bakes or erases independent sculpting.

## Commands and previews

The framework-independent core supports add, replace, remove, atomic multi-entity/source insertion, source attribution edits/removal, project rename, terrain, and grouped commands. A command produces a validated immutable document before commit. Entity replacement preserves identity and kind. Commands cannot interleave with an active gesture. Sources in use cannot be removed; deleting an instance leaves its source available for reuse.

Gestures follow begin, preview, commit/cancel. Every preview evaluates against committed state. Rendering can read preview state, while project storage reads committed state. Selection changes and undo cancel pending previews. Invalid imports change nothing.

History has a 100-entry bound. Terrain-only edits store changed sample indices and exact before/after values; object edits retain before/after documents while sharing unchanged terrain. No-op commits leave revision and history unchanged. New commits clear redo. Undo and redo advance the revision so autosave can observe the resulting document.

New site uses validated whole-document replacement as one undoable entry, including grid-resolution changes. File Open validates before loading and resets history. New sites use square 129² or 257² grids; the original coastal study retains its 129 by 105 grid.

## Storage and rendering

The prototype stores a single current project in IndexedDB and exports portable `.olc.json` files. Sources contain base64 GLB bytes and attribution; runtime objects and URLs are excluded. Identical imports reuse an existing source by exact byte equality. Limits are 8 MB/source, 24 MB total source bytes, 16 sources, 1,000 entities, and 40 MB per serialized project. Validation rejects external resource URIs and unsupported compression before any model decoder runs. The viewport decoder verifies geometry before import or hydration replaces the document. Failed imports preserve the document and active draft. Saves run in order and use committed state; hydration completes before autosaving can start.

The viewport maps entity IDs to derived meshes. A shared terrain sampler feeds terrain vertices, placement, and water depth. Terrain geometry, normals, and water-depth attributes update during previews. Sculpt mode disables camera controls; pointer capture keeps the stroke owned until release or cancellation. Escape, blur, pointer cancellation, tool changes, and teardown discard active previews. Animation consumes an independent clock.

Terrain picking traverses crossed grid cells and tests their actual mesh triangles. Height changes update vertex/color buffers and area-weighted normals locally, falling back to a full normal rebuild for broad changes. Autosave is debounced and deferred during active gestures. Failed hydration pauses autosave until explicit recovery through Save, Open, or New site.

Transform controls edit a scene-attached proxy and publish validated previews; release commits once. Cancel discards the control's pointer session too. Numeric editing remains available. Eligible opaque static meshes use source-mesh instance batches with entity-ID mapping for selection. Skinned, morphing, mirrored, transparent, and non-mesh sources use individual clones. Both paths share source geometry, materials, and textures; instance buffers have their own owners. The source owner disposes resources when its last visible instance leaves the viewport; late asynchronous loads are also disposed. Resource owners, promises, controls, and selection never enter the project format.

River drawing remains a draft until Finish adds one entity. Numbered handles capture one pointer and disable navigation for the gesture; release commits one command. Invalid handle locations are rejected and an invalid release cancels the gesture. Numeric river drafts retain invalid input and disable Apply until corrected or cancelled. Rendering uses a runtime-only clock for flowing patterns; speed/color persist, while pause, quality, and per-frame time do not enter document history. River buffers, label textures, and materials have viewport owners and are disposed on teardown.
