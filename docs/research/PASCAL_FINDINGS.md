# Pascal source study for M0

Studied October 17, 2026 at revision `38caced0651e2a1ffb229e1d85de654fc1edf99d`. Method: read source in a shallow reference checkout. Pascal was not installed or run. OpenLandcraft imports no Pascal packages or source code.

## Scene and geometry

The scene store uses a node dictionary, root IDs, and dirty-node tracking. Node schemas carry IDs, kinds, parent references, and authored properties. Wall definitions include parameterized endpoints and dimensions rather than only final geometry. [Base schema](https://github.com/pascalorg/editor/blob/38caced0651e2a1ffb229e1d85de654fc1edf99d/packages/core/src/schema/base.ts), [wall schema](https://github.com/pascalorg/editor/blob/38caced0651e2a1ffb229e1d85de654fc1edf99d/packages/core/src/schema/nodes/wall.ts), [scene store](https://github.com/pascalorg/editor/blob/38caced0651e2a1ffb229e1d85de654fc1edf99d/packages/core/src/store/use-scene.ts).

Our choice: a smaller independent versioned document with a site and typed entities. M0 includes parameterized massing blocks and an experimental ocean surface. Building semantics arrive later. Render objects are derived; selection is session state.

## Gesture lifecycle and history

The drag service implements start, preview, commit, cancel, and disposal. React input wiring wraps this service. History control groups writes, excludes semantic no-ops, and records scene commits separately from presentation. The store's temporal configuration retains 50 actions at this revision. [Drag service](https://github.com/pascalorg/editor/blob/38caced0651e2a1ffb229e1d85de654fc1edf99d/packages/core/src/services/drag-session.ts), [React hook](https://github.com/pascalorg/editor/blob/38caced0651e2a1ffb229e1d85de654fc1edf99d/packages/editor/src/hooks/use-drag-action.ts), [history control](https://github.com/pascalorg/editor/blob/38caced0651e2a1ffb229e1d85de654fc1edf99d/packages/core/src/store/history-control.ts).

Our choice: pure validated commands plus a separate preview document. Previews never replace committed data. A completed gesture creates one history entry; cancellation discards its preview. M0 uses up to 100 immutable document snapshots because the documents are small. Terrain will need bounded patches before large editable heightfields enter history.

## Terrain

The inspected schema explicitly caps terrain sides at 257 samples and persists base64 Int16 heights with origin, spacing, and quantization step. The brush implementation describes a fixed starting snapshot, bounded coverage, and distance-spaced dabs. [Terrain schema](https://github.com/pascalorg/editor/blob/38caced0651e2a1ffb229e1d85de654fc1edf99d/packages/core/src/schema/terrain.ts), [brush implementation](https://github.com/pascalorg/editor/blob/38caced0651e2a1ffb229e1d85de654fc1edf99d/packages/core/src/lib/terrain-brush.ts).

Our choice: M0 uses an analytic coast sampler shared by land geometry and water-depth attributes. It proves coordinate consistency, not sculpting. M1 will define our heightfield and stroke patches without inheriting Pascal's storage limit or wire format.

## Acceptance examples derived for our core

- Preview ten parameter values, then commit: exactly one undo restores the initial document.
- Cancel a preview: no project change, revision increment, or history entry.
- Import invalid data: current document and active preview remain intact.
- Save committed state during a preview: the draft is excluded.
- Undo, then edit: the old redo branch is discarded.

Source observations do not prove Pascal's runtime usability or performance. Our tests and browser checks establish behavior only for OpenLandcraft's implementation.
