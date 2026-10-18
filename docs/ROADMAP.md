# OpenLandcraft development roadmap

Status: M0–M4 prototype work complete with the remaining release checks recorded in M4. Updated October 18, 2026: prioritize the manual landscape and building experience; AI editing and collaboration are deferred. M5–M8 below are the proposed implementation sequence.

## M0 Research and prove our editor core

Current status: complete for the M0 prototype. Source research, implementation, build, automated tests, and initial browser acceptance checks have evidence in the [validation record](M0_VALIDATION.md).

Goal: translate selected reference workflows into our own architecture and a small working editor.

1. Follow RESEARCH.md to document relevant Pascal, landscape, and parametric modeling workflows.
2. Define our entity schemas, coordinates, command transactions, and project envelope.
3. Select and pin general-purpose application and rendering dependencies.
4. Build navigation, picking, selection, and a property inspector.
5. Edit a simple parameterized object through our commands; prove cancel, undo, and redo.
6. Save and reopen it using our project format.
7. Record browser/GPU compatibility and a rendering baseline.

Keep a small rendering experiment for animated water in the architecture work: verify the proposed scene clock and a simple flowing surface without building the complete river or ocean tools yet.

Include the [hajimetwi3 coastal reference study](research/OCEAN_REFERENCE.md) in water research. Start with a bounded coast and shared terrain-depth sampling; evaluate richer shoreline effects as later experiments.

Exit checks: reproducible startup; reference findings with versions and evidence; our scene model and command loop; one selectable object with an undoable edit and successful project round trip.

## M1 Deliver terrain and project storage

Current status: complete for the bounded terrain workflow. See the [validation record](M1_VALIDATION.md) for test coverage, browser evidence, and performance limits.

Depends on M0.

Implement a site heightfield, sampling, four brushes, brush previews, camera input arbitration, autosave, and project export/import on our transaction model.

Exit checks: sculpt, cancel, undo, redo, reload, and import into fresh storage with equivalent authored heights. Failed imports preserve the current scene. Measure brush latency and navigation performance.

## M2 Place assets and implement basic buildings

Current status: complete for the bounded GLB and basic building workflow. See the [validation record](M2_VALIDATION.md).

Depends on M1.

Implement GLB import, placement, transform handles, resource ownership, and asset bundling. Build our level, wall, slab, and roof tools with numeric properties and simple snapping. Define terrain anchoring and building elevation behavior. Add deterministic scattering after single-instance placement works.

When bespoke content is needed, use Blender MCP and/or Lux3D through the asset production path in ARCHITECTURE.md. Validate one representative exported asset in our viewport before producing a larger library. Include a simple animation clip only if the selected asset needs it; do not make model generation a prerequisite for basic editor development.

Exit checks: draw and edit a simple building beside sculpted terrain; place and transform trees; undo changes; export and reopen with imported files intact. Record asset attribution where applicable.

## M3 Complete the editable river workflow

Current status: complete for one bounded, unbranched river. See the [validation record](M3_VALIDATION.md).

Depends on M1 and the core transaction model; combine with M2 for the full demonstration.

First prove spline geometry and reversible carving on a small terrain. Add drawing, control handles, width/depth/elevation properties, animated water, validation, and previews. Support one unbranched river initially.

Exit checks: draw a river; move points; change properties; undo/redo each gesture; delete it without losing independent sculpting; save and reopen the same parameters. Reject unsupported shapes visibly.

Water animation checks: flow settings persist; motion continues independently of editing history; pausing or changing preview quality does not alter authored geometry. Prototype ocean waves separately to inform the later ocean tool.

## M4 Validate the complete MVP

Current status: validation pass complete for the bounded prototype. [Evidence](M4_VALIDATION.md) includes 54 passing tests, production build, full workflow/reload checks, recovery changes, and the 500-tree benchmark. Isolated browser-profile portability and broader hardware testing remain open release checks.

Depends on M1 through M3.

Run the complete PRD workflow. Refine editing, recovery, loading feedback, and performance. Preserve an example project and document setup and usage.

Exit checks: all acceptance criteria pass with evidence. Performance results identify hardware, browser, asset complexity, settings, frame rate, and latency. Every visible editing control performs its stated action.

## Next product target

Build a usable coastal-site design workflow: shape a beach and hills, adjust the sea, draw a lake and paths, plant vegetation areas, and create a small pavilion with joined walls, doors, windows, and dimensions. The site should remain editable and portable throughout. Carry one evolving example through these milestones so the result demonstrates a coherent project.

AI editing and collaboration are explicitly deferred at the user's direction. The proposed order below focuses on visual landscape quality, practical site tools, architectural editing, and then measured scale. IFC is also outside this phase; usable manual building tools come first.

## M5 Ocean, shoreline, and landscape appearance

Depends on the M4 authored/evaluated surface contract. Start here.

The current ocean already has basic animated displacement and depth coloring. Extend that experiment into an editable coast with stable shallow/deep appearance, directional waves, shoreline foam, and a wet-sand treatment. Establish consistent grass, sand, rock, and seabed material appearance with world-space scale. Keep the current visual style as a starting point; compare fixed camera views as effects are introduced.

Build in three reviewable increments:

1. **M5a Water foundation:** extract the ocean renderer from the viewport shell; expose wave direction, wavelength, amplitude, and speed with bounded values. Reuse the evaluated terrain for depth and shoreline queries. Make wave displacement fade in shallow water to avoid conspicuous land intersections. Add an Ocean control when a flat site has no water. Preserve old version-4 projects through explicit defaults/migration if the schema changes.
2. **M5b Shoreline treatment:** add depth/slope-aware foam and wet sand. First use effects derived from the current surface and runtime clock. Only add persistent foam/wetness buffers if the visual comparison warrants the extra state; define reset on terrain edits, water edits, undo, and load before introducing them.
3. **M5c Materials and demonstration:** add bounded terrain/water material presets and scale controls, unify river/ocean appearance, and update the coastal example. Paintable material regions belong to M6; M5 establishes the material rendering and parameters.

Exit checks: moving sea level and sculpting the shore update water clipping, foam, and beach appearance without stale data; undo restores authored parameters and consistent derived effects; pause/quality do not alter history; export/reopen preserves settings. Compare high/low quality, Top/3D views, flat and steep shores, and the 500-tree workload. Record screenshots and frame timings. Keep the provisional 30 FPS navigation/100 ms brush targets visible and report any regression.

Physical surf simulation, underwater transitions, expensive reflections/refraction, and photorealistic ocean rendering remain later experiments. The coastal prompt is a research brief, not an engine dependency or a promise to implement every effect.

## M6 Practical landscape authoring

Depends on M5 material/depth infrastructure and the existing reversible terrain evaluation.

Deliver in order:

1. **Paths:** draw and edit a centerline, width, surface, and elevation mode. Start with one unbranched path, terrain-following surface geometry, endpoint snapping, and visible dimensions. Add optional grading as a separate reversible modifier after surface placement is reliable.
2. **Lakes:** draw a simple closed boundary with a level water surface and editable depth/bank settings. Reject self-intersections and unsupported overlap. Derive basin carving without baking it into authored terrain.
3. **Material and planting regions:** paint or draw surface regions and vegetation areas with source, seed, density, scale variation, and exclusions for water, paths, and buildings. Preview regeneration before applying it. Define whether individual edits detach generated instances so regeneration cannot silently discard manual work.

Before combining lake/path/river grading, specify modifier ordering and overlap behavior, stable IDs, selection, deletion, and undo. Material painting must have explicit stored data rather than relying on transient vertex colors. Do not silently expand the existing file/entity budget to fit generated content; measure the representation first.

Exit checks: edit a path from a pavilion to the shore, place a lake inland, and regenerate a planting area while honoring exclusions. Changing terrain updates following surfaces; removing grading/water retains independent sculpting. Save/open and undo/redo preserve region parameters, generated results, materials, and source bytes. Recheck edit latency and instancing cost.

## M7 Architectural editing beyond massing

Depends on the existing level/wall/slab/roof entities. This can start once M5 is stable if architecture becomes the more immediate need.

Implement wall chains with endpoint snapping and joined corners, hosted door/window openings with width/height/sill/offset, editable floor/roof outlines, and visible dimensions. Start with one level and rectangular openings; reject invalid hosts, overlaps, and out-of-bounds cuts before committing. Define how opening positions behave when walls are shortened, joined, moved, or deleted. Add lightweight alignment/length constraints only after those operations are reliable; avoid an unrestricted constraint solver in the first pass.

Exit checks: draw a pavilion footprint, join its walls, add a door and windows, resize a wall, adjust the roof, and verify meaningful dimensions. Openings must be actual visible geometry cuts. Undo/redo and portable round trips preserve hosts and parameters. Terrain edits must leave explicit building elevations under user control. Full BIM, IFC, structural analysis, and Revit interoperability stay deferred.

## M8 Larger environments from measured limits

Depends on profiling the combined M5–M7 example and a representative larger site. This is a measured expansion rather than a prerequisite for better editing.

First identify the limiting costs: terrain geometry/normal updates, material layers, modifier evaluation, source geometry/textures, model picking, file size, and synchronous serialization. Apply chunk culling, vegetation LOD, or background computation where the evidence supports them. Introduce terrain tiles and streaming only when bounded scene optimizations no longer meet the chosen site-size target. Define seam sampling, modifier effects across tiles, selection, saving, and undo before implementing tiling.

Exit checks: publish the tested site sizes, asset complexity, hardware/browser, memory/file size, loading times, navigation FPS, and editing latency. Keep the existing small-site workflow fast and compatible. Choose the next supported size from measured results rather than promising an unbounded world.

## Deferred product tracks

| Track | Revisit when |
| --- | --- |
| AI editing: scene queries, commands, batch operations | The expanded manual workflow is useful and stable, and the user chooses to prioritize it. |
| Collaboration: accounts, synchronization, permissions, shared assets | The user requests team workflows and their data/conflict requirements are defined. |
| IFC and advanced BIM | Concrete interchange needs justify a separate scope and validation plan. |

Blender MCP and Lux3D remain optional asset-production tools for representative trees, rocks, buildings, or prepared effects when needed. Editable water, paths, terrain, and parametric buildings remain native OpenLandcraft systems. Validate a small representative asset set before expanding a library.

## Immediate work queue

- [x] Research Pascal and the coastal-water reference at pinned revisions.
- [x] Specify entity, command, and project contracts.
- [x] Scaffold our minimal editor core and viewport.
- [x] Verify transactions and serialization with automated tests.
- [x] Verify object selection, visual previews, water rendering, and save/reopen in the browser.
- [x] Record the initial browser/GPU baseline and prototype limits.
- [x] Implement the terrain field, brush transactions, and versioned persistence.
- [x] Verify four brushes, cancellation, undo/redo, water-depth updates, and project recovery.
- [x] Implement and verify M2 asset import/placement, portable model bytes, and basic building authoring.
- [x] Implement and verify an editable river spline, reversible carving, flowing water, and persistence.
- [x] Run M4 across the complete MVP workflow and refine recovery, usability, and performance.
- [ ] M5a: extend the current ocean into a controlled directional-wave/depth foundation with backwards-compatible persistence.
- [ ] M5b–c: validate shoreline foam, wet sand, terrain/water materials, and the evolving coastal example.
- [ ] M6: deliver paths, lakes, and editable material/planting regions in bounded increments.
- [ ] M7: deliver joined walls, hosted openings, editable outlines, and dimensions.
- [ ] M8: measure larger scenes and implement the scaling improvements the profiles justify.
- [ ] Verify portable import in an isolated browser profile and record a broader browser/GPU matrix before wider release.
