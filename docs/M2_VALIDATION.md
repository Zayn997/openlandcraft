# M2 assets and buildings validation

October 17, 2026. Complete for bounded GLB placement and basic independent building elements. Editable rivers are the next milestone.

## Delivered workflow

GLB 2.0 import validates the binary envelope and embedded resources, then parses geometry before adding a source and instance in one command. Repeated imports of the same bytes reuse the source. A model library supports reuse and removal of unused sources. Source attribution travels with the project. The original procedural coastal pine is CC0-1.0; its reproducible generator is `scripts/create-demo-tree.mjs`. Blender/Lux3D were unnecessary for this fixture.

Model instances support bottom-center origins, translation, Y rotation, nonuniform scale, and terrain/fixed elevation modes. Handles and numeric fields use the same preview/commit/cancel history. Snap increments are 0.5 m, 15°, and 0.1 scale. Seeded scatter adds independently editable copies in one undo step. Instances share loaded source resources; the owner releases geometry, materials, textures, and image bitmaps when no visible instances remain.

Add building creates a fixed level, four walls, one rectangular slab, and one gable roof. Draw footprint creates those elements from two 0.5 m snapped ground points. Levels move/rotate all their elements. Each element has its own numeric properties and visibility. Add wall/slab/roof from a level inspector. Deleting a level and restoring it through undo includes all its elements. Terrain edits retain building elevations.

Version 3 `.olc.json` bundles authored parameters, source GLBs, and attribution. Versions 1 and 2 migrate without changing existing entities; version 2 heights remain exact. Local and portable storage use committed state. Invalid project/model imports preserve the scene; an invalid bundle was also checked while a numeric preview was active.

## Automated checks

`npm run build` and `npm test` pass. All 34 tests across six files cover existing terrain/core/storage behavior plus:

- Exact version 2 migration, coherent multi-part creation, cascading deletion, and undo/redo.
- Missing model references, duplicate sources, orphan parts, and degenerate walls rejected atomically.
- Fixed buildings/models versus terrain-following model elevations through sculpting and undo.
- Transform previews, cancellation, attribution edits, seeded scatter, and source reuse.
- GLB byte identity through portable JSON and IndexedDB storage; failed imports preserve active drafts.
- GLB headers/chunk bounds/external-resource rejection, actual GLTFLoader decoding, normalized bounds, shared instance resources, and owner disposal.

## Browser evidence

Checks used the separate `http://localhost:5173/` origin and the user's existing server. The user's `127.0.0.1` project was not replaced.

- Added a building; edited wall height to 4.1 m; undo restored 3.2 m and redo restored the edit. Cancelled a roof-rise preview.
- Loaded the demo tree and imported its GLB through the native file chooser; the second import reused one model source.
- Dragged the red translation handle: terrain-mode X changed from -29 to -27 m. One undo restored -29, and redo restored -27. Numeric rotation 45° and Y scale 1.2 committed together.
- Scattered eight copies; all appeared as independent selectable objects. Reload retained models, transforms, and attribution.
- Rejected a corrupt embedded GLB while a -16 m X-position preview was active. The scene and preview survived; Cancel restored -17 m.
- Drew a footprint through two snapped land clicks; seven entities were added. Cascading delete and undo restored the whole building; one further undo removed the footprint creation.
- Opened the supplied M2 example, exported it through the browser, and reopened that downloaded file. The export exactly equals the supplied example: 23 entities, one source, and the original 7,652 GLB bytes.
- Checked a 375 × 844 layout. Document width and scroll width were both 375 pixels; the scene and property panels remain scrollable.

The test scene rendered at approximately 58–60 FPS in the Windows Chromium in-app browser at 1280 × 720, high quality, on ANGLE / Intel Arc Graphics / Direct3D11. With no selection and four visible massing blocks, it reported 78 draw calls and 62,318 triangles. The final example hides those earlier blocks to emphasize the building and trees. These are observations from one small scene, not a general asset-performance guarantee. A scene-graph warning in the first transform implementation was fixed before final verification. The production bundle still reports the existing large-chunk warning.

## Limits and examples

Limits: 8 MB per GLB, 24 MB combined GLB bytes, 16 sources, 1,000 entities, 40 MB project JSON. GLBs must embed their buffers/images; Draco, Meshopt and KTX2 decoding are deferred. Imported animations remain in source bytes but are not played. Scatter uses ordinary shared-resource clones rather than GPU instancing and does not avoid overlaps or water. Building walls remain independent; openings, joined corners, linked wall/roof elevations, arbitrary slab outlines, and structural constraints are deferred.

Open `examples/coastal-architecture.olc.json` for sculpted ground, a seven-part building, and 11 trees. Regenerate it with `node scripts/create-example.mjs`. Visual evidence is `docs/evidence/m2-buildings-assets.jpg`.
