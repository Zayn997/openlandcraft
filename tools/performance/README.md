# M8 performance baselines

Run from the repository root:

```powershell
node tools/performance/create-baselines.mjs
npm run dev
```

The generator writes six validated portable projects, CPU timings and a browser harness under `.qa/m8/`. It does not read or write browser-local project storage. Close other benchmarks, tests and builds before collecting timings.

Open `http://127.0.0.1:5173/@fs/D:/Projects/openlandcraft/.qa/m8/index.html` on this checkout. On another checkout, use the checkout path embedded in `.qa/m8/index.html`, replacing the server port as needed. Regenerate after moving the repository.

The browser harness renders the production `Viewport`, including terrain, model loading, water passes, shadows, wind, character routing and animation. The surrounding application sidebar/history UI is excluded, so these measurements cannot establish end-to-end application latency. It runs without saving, opening or replacing the user's local project.

Choose a workload, wait for its models to appear and for shader compilation to settle, then choose **Record 6 windows**. Each render window is approximately 1.5 seconds. The render viewport is fixed at 1280 × 478 CSS pixels so panel/window resizing cannot skew comparisons; smaller windows scroll. Production High caps rendering DPR at 1.5; Low uses 1. Record High/Low, 3D/Axo and animation state separately. Use the same camera and gesture sequence for comparisons. Stationary rendering and navigation must be labeled separately. Check that every expected model is visible; character fixtures validate that every person has a usable personal route before export.

For brush feedback, enable **Sculpt**, start a recording and drag over terrain. The recorded `strokeMs` values come from the production pointer-to-next-frame instrumentation. They are sampled browser feedback, not hardware input-to-display latency. Scene modifications are discarded when changing workloads. Rendering metrics include production shadow and water passes; draw counts are camera dependent.

Copy the visible JSON results into an evidence file with the CPU manifest and screenshot. Record browser/GPU, viewport, DPR, sample counts, file/source size and conditions. CPU `serialize`, `deserialize` and `brushPreview` timings use three warmups and 12 samples; their nearest-rank p95 is a small-sample indicator, not a release guarantee. The Node brush transaction includes validation, carving/evaluation and cancellation, but excludes rendering. Mount age in the browser result is not model-load time.

Current fixtures keep existing limits: 200 × 200 m with 257² terrain and 100/500/900 Kenney pines; 80 × 80 m with 129² terrain and 2/12 Quaternius people following independent routes; and the existing coastal pavilion with water, regions and repeated floors. These isolate scaling costs; they do not claim a validated larger-world target or represent an all-assets mixed stress test. Cold load timing, memory, fish/bird scaling, application UI cost and broader hardware coverage remain M8 work.

## Full application, loading and memory

Run `node tools/performance/create-app-profile.mjs`, then serve this checkout on an isolated port (for example `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5177 --strictPort`). Open `/@fs/D:/Projects/openlandcraft/.qa/m8-app/index.html` on that server. Avoid the port hosting the user's project: this harness uses the real application's IndexedDB and autosave on its origin.

The host loads the actual `App` in the same React StrictMode as the normal entry point, with a fixed 1440 × 900 desktop frame and both editor sidebars. The source fixtures combine the existing three-storey coastal study, ocean/river/lake, regions and paths with 100 or 500 library plants and 12 independently routed people. Fixture generation rejects a scene unless every person has a usable walking route. `small.olc.json` is the cleanup control.

Use the editor's normal Open button once to verify native file loading. The host's Open mixed/control buttons subsequently fetch a fixture into a File and call that same import handler, including validation, history reset, rendering and autosave; fixture fetch time is outside the measured import. The extra `AppDiagnostics` sink is optional and the normal application installs no recorder. Capture settled render windows and named heap snapshots after mixed → cleanup → mixed cycles. Reload the profiling page to measure local hydration; distinguish a warm module/browser cache from a fresh origin or network-cold startup.

The visible report includes file/local read, parse, upgrade, model validation, scene-ready and save stages; per-asset load events; actual React commit render durations; main-thread long tasks; Chromium's sampled JS heap; renderer geometry/texture/program counts; and actual drawing buffer dimensions/DPR. `file-open-ready` means the document has loaded into the editor, not that models and shaders have rendered. Use the later model events and settled render counters to bound visible-scene startup separately. StrictMode can replay development loading, so these are development diagnostics, not production release timings.

Heap readings are optional, browser-specific, may be coarse or renderer-process scoped, and include garbage awaiting collection. No forced GC is requested. Renderer resource counts are allocation indicators, not GPU-memory bytes. Record both rather than claiming a total-memory or leak guarantee. Long-task and React recording are bounded to 800 samples per category; their own instrumentation has overhead. Clear recording before a controlled idle comparison and save the visible JSON before reloading or editing the harness.

## Per-frame water and character work

The full-app recorder also subscribes to the optional `observeFrameWork` sink. It times ocean/river/lake CPU history updates, shared pedestrian steering, the sum of every character's pose/mixer work, and the water capture/shadow and final rendering passes. Route planning is a nested subset of steering; do not add it to steering. Each event reports frames, wall interval, and per-frame stage mean/p95/max. A skipped history step counts as zero work, rather than being omitted. Windows are about 1.5 seconds and retain at most 240 frame samples; the recorder retains at most 800 events. Normal sessions have no observer or timing clock reads.

After loading **Open mixed 500**, allow model/shader setup and autosave to settle. Verify the drawing buffer, camera and render counts match, then clear recording and record at least 20 seconds. Save the report before changing modes. **Reference water CPU** switches only history calculations back to analytic swell evaluation and the original quiet-cell behavior; **Optimized water CPU** restores the default prepared coefficients, bounded lookup and deep-water foam shortcut. Both modes use the same visible shaders, render passes, existing history and scene. Clear recording after each switch and omit the first partial timing window when comparing. Repeat in reverse order when investigating variation. Do not run tests or builds during a timing sample.

These are CPU wall timings, including driver waits in rendering, not GPU timer queries. Separate development/GC/system interruptions from steady playback, and keep their raw evidence rather than selecting only fast windows. The reference toggle is an isolated harness diagnostic and is not an editor quality setting.

**Open horse walk** loads a validated horse orbit beside a lake and plants through the normal import handler. The horse's gait is checked separately from dense-scene timing; switching scenes resets the camera. The library regression samples the full corrected Walk clip and its seam, verifies that every interval articulates, and checks body/foot bounds. A still screenshot alone cannot establish continuous animation.
