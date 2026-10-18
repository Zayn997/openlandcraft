# M1 terrain validation

October 17, 2026. M1 is complete for a bounded editable site with local projects. Asset import, parametric building authoring, and river carving remain later milestones.

## Implementation

The landscape package implements heightfield creation, bilinear sampling, four brush operations, bounded stroke coverage, and changed-sample patches. Initial sites use 129 by 105 samples. Heights are constrained to -9 through 35 meters; brush radius and strength are adjustable. Flatten uses an explicit target elevation. Smooth reads a fixed neighborhood from the stroke baseline.

Sculpt mode owns pointer input and disables camera navigation. Release commits one history step; Escape or cancellation discards the preview. Coordinate stamps provide a keyboard path with preview, apply, and cancel. Terrain-only history stores changed samples, while object edits share unchanged terrain arrays.

Project format version 2 includes terrain data. Version 1 migrates from its coast parameters and preserves existing entities. Terrain, picking, new-object placement, and water depth share a height query. Existing block elevations remain unchanged.

## Automated checks

TypeScript and the production build pass. All 24 tests pass, including:

- Height sampling and boundary clamping; sample-count and finite-value validation.
- Raise, lower, flatten, smooth, height bounds, and repeat-dab behavior.
- Equivalent stroke results across different pointer sampling densities.
- Exact undo/redo patches, mixed terrain/object history, cancellation, and immutable committed state.
- Version 1 migration with preserved objects and water settings.
- Exact sculpted-height round trips through portable serialization and fresh fake-indexeddb storage.
- Invalid terrain imports preserving both the current document and active preview.

## Browser checks

Tests ran on the separate localhost origin so the user's 127.0.0.1 project was not used for destructive tests.

- Raised terrain with a captured drag; release committed, and undo/redo restored the change.
- Cancelled a coordinate stamp: no undo entry was added. Lower, flatten, and smooth stamps applied through the same terrain command.
- A flatten stamp at the shore changed land shape and the water boundary. Buildings retained their existing transforms.
- Saved locally and reloaded the sculpted scene; exported and successfully imported the version 2 project.
- Inspected the exported file: 13,545 samples, 936 differing from the test baseline, with all entities unchanged.
- Rejected a file with missing height samples with an actionable error while preserving the open scene.
- Checked the new controls on the desktop, narrow desktop, and 375-pixel layout; narrow document width matched viewport width.
- Final browser console inspection found no runtime errors.

## Performance and limits

The same Intel Arc / Windows in-app browser used for M0 reported approximately 58 to 60 FPS during observed terrain work. Initial command-only updates were around 1 to 2 ms. The final instrumentation measures pointer-handler input to the next render-loop callback after geometry update; one observed raise stroke reported 29.2 ms. It excludes GPU presentation latency and is not a sustained benchmark.

The 257-side upper bound, touch pointer cancellation, releasing a drag outside the window, and other browsers were not separately stress-tested. Cancellation paths have core test coverage and explicit UI behavior; pointer capture and camera isolation were observed with desktop drags. Browser import used an existing test scene; fresh storage has automated coverage.

## Evidence

- [Sculpted example](../examples/sculpted-coast.olc.json)
- [Terrain editor screenshot](evidence/m1-terrain.jpg)

The example comes from test storage and is independent of the user's saved scene. Refresh the running editor to load the complete M1 update and migrate any existing M0 project.
