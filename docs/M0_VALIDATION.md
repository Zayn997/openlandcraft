# M0 validation record

October 17, 2026. M0 is complete for the bounded editor-core prototype. This does not establish the later product acceptance criteria for sculpting, buildings, assets, or rivers.

## Source research

- Pascal revision: 38caced0651e2a1ffb229e1d85de654fc1edf99d. Source study only; Pascal was not run or imported into our implementation.
- Coastal reference revision: 3f983df4a2d34a8c4af74cd0dffd6c0c5361ce53. Prompt specification study; reference demos were not benchmarked.
- Our entity, command, preview, history, and project contracts are documented in CORE_CONTRACT.md.

## Automated validation

The final TypeScript check and Vite production build pass on Node.js 22.14.0 and npm 11.6.1. All 12 tests pass across transactions, no-op/cancel behavior, invalid commands/imports, project serialization, IndexedDB persistence using fake-indexeddb, and terrain sampling.

The production JavaScript chunk is approximately 1.30 MB before compression, 360 KB gzip. Code splitting and loading optimization remain follow-up work.

## Browser acceptance

The user started the development server. The original project on 127.0.0.1 was left intact. Tests used localhost, which provides a separate browser storage origin.

Verified in the ChatGPT in-app browser on Windows:

- Land, blocks, and animated water render; final console inspection shows no runtime errors.
- Clicking a block in the viewport updates selection and the inspector. Hierarchy selection, orbit, wheel zoom, Top view, and Frame selection work.
- Height preview changed from 4 to 7 meters; Cancel restored 4. Apply committed 6; Undo restored 4 and Redo restored 6.
- Invalid numeric values show validation feedback; Escape restores the committed value. Invalid values cannot be submitted through the property form.
- Duplication, hide/show, deletion, and undo restore the expected object state.
- Water level, amplitude, and speed edit together. After pause and a quality change, Undo reverted the water edit, confirming that playback and quality did not add document history entries.
- Local save/reload restored block height 6 and water level 1.2. Export/import restored those parameters after the working water level was changed to 0.
- A project with version 99 was rejected with a readable error; the current object and its height remained intact.
- Layouts at 1280 by 720, 843 by 884, and 375 by 844 were inspected. Phone/tablet panels switch correctly. Document width equals viewport width at checked narrow sizes. File actions retain accessible names when labels are hidden.

The water/ground-grid intersection found during visual testing was fixed by placing the reference grid below the terrain base. Camera framing now accounts for viewport aspect ratio. The shadow configuration explicitly uses PCFShadowMap rather than a removed soft-shadow mode.

## Initial rendering baseline

At 1280 by 720, High quality, with the original three-block scene and water visible, the scene reported approximately 55 to 60 FPS, 14 draw calls, and 49,070 triangles. These are short live observations from the app's frame sampler, not a sustained performance benchmark.

Reported GPU: ANGLE (Intel, Intel(R) Arc(TM) Graphics (0x00007D55) Direct3D11 vs_5_0 ps_5_0, D3D11). The in-app browser engine version was not collected.

A non-fatal Three.Clock deprecation warning comes from the current rendering dependency stack. No shader compilation errors were observed. Cross-browser behavior, sustained GPU load, right-drag pan, and actual reduced-motion OS settings were not separately exercised. Portable serialization and fresh-storage loading have automated coverage; the browser file import test used an existing test scene.

## Evidence and next scope

- [Verified editor screenshot](evidence/m0-editor.jpg)
- [Portable example project](../examples/coastal-study.olc.json)
- [Core contracts](CORE_CONTRACT.md)

The terrain is an analytic fixed coast in M0. Sculpting brushes, architectural authoring, imported assets, river carving, breaking surf, persistent foam/wetness, and underwater rendering belong to later milestones. M1 should begin with a bounded editable heightfield and brush transactions; its implementation estimate should be based on that narrower task breakdown.
