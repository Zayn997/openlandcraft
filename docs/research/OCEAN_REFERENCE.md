# Ocean water reference

## Source and relevance

Reviewed October 17, 2026 at revision `3f983df4a2d34a8c4af74cd0dffd6c0c5361ce53`: [hajimetwi3/hajimetwi3-prompt-okiba](https://github.com/hajimetwi3/hajimetwi3-prompt-okiba), specifically its [coastal simulator prompt](https://github.com/hajimetwi3/hajimetwi3-prompt-okiba/blob/3f983df4a2d34a8c4af74cd0dffd6c0c5361ce53/contents/demo/realtime_kaigan.txt). This is a design specification for a Three.js/WebGL scene, not a verified water engine.

The brief connects terrain and water through common coordinates and depth data. It describes offshore-to-shore wave changes, persistent foam, wet sand that dries over time, depth-sensitive water appearance, underwater transitions, and adjustable quality. These are useful research targets; the prompt itself does not demonstrate their implementation or performance.

## OpenLandcraft experiments

Proposed sequence:

1. Build a small editable coast and derive water depth from our terrain sampler.
2. Test procedural waves, shallow-water appearance, and shoreline stability while editing ground or water level.
3. Add optional foam and wetness state; define pause, reset, and reload behavior.
4. Measure cost at several quality levels before considering richer underwater effects.

Keep OpenLandcraft's scene model, controls, and renderer implementation independent. No reference demo has been run or benchmarked in this study.

## M0 implementation boundary

Our experiment uses the same CPU terrain sampler for land vertices and water ground-height attributes. A small vertex-wave shader displaces water; fragment depth controls shoreline clipping and shallow/deep appearance. Water settings are authored entities. Time, pause, and quality are runtime state and never enter edit history.

This establishes a rendering and data boundary. It does not implement the reference's breaking surf, refraction, underwater view, persistent foam, wet-sand history, or physical wave simulation. Changes to water level must affect the visible shore and survive undo and project reopening. A terrain sampler test and browser checks will verify our smaller experiment.
