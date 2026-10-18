# OpenLandcraft product requirements

Status: Bounded MVP implemented; acceptance evidence and remaining release checks are in [M4 validation](M4_VALIDATION.md). October 17, 2026.

Direction updated October 18, 2026: prioritize richer manual landscape and architectural editing. AI editing and collaboration can wait. The proposed M5–M8 sequence is in the [roadmap](ROADMAP.md).

## Product purpose

OpenLandcraft will let designers shape a site and develop buildings within it using a browser. Landscape tools should feel direct: brush the ground, draw a river, place vegetation, and adjust dimensions through visible handles and properties.

OpenLandcraft owns the editing experience and underlying model. Pascal and other applications are research references for workflows and implementation ideas; the product uses its own editor architecture and project format.

The first audience is individual architectural and landscape designers exploring small sites. The initial product supports concept design. Detailed construction documentation, engineering analysis, and a complete BIM workflow belong to later releases.

## First complete workflow

1. Open a local project or create a new site.
2. Sculpt a hill with raise, lower, flatten, and smooth brushes.
3. Draw a winding river and edit its control points, width, depth, and water elevation.
4. Import a GLB asset, place trees on the ground, and adjust their transforms.
5. Create a simple building using OpenLandcraft wall, slab, and roof tools.
6. Undo and redo edits, save the project, and reopen the same scene with its assets.

## Initial scope

| Area | Required behavior |
| --- | --- |
| Navigation | Orbit, pan, zoom, frame selection, and switch between useful plan and perspective views. |
| Selection | Select authored objects, show properties, and delete or transform them. |
| Terrain | One bounded heightfield; visible brush preview; adjustable radius and strength; cancel and undo a stroke. |
| River | One unbranched spline; editable handles; constant width and depth initially; terrain carving and an animated water surface. |
| Assets | Import self-contained GLB files, place and transform instances, and preserve their source data when saving. |
| Buildings | Implement basic parametric walls, slabs, roofs, and levels; place a simple building at an explicit elevation beside the river. |
| Persistence | Local autosave, explicit portable export/import, schema versions, and readable failure messages. |
| History | Each completed gesture is one undo operation, including its terrain and geometry consequences. |

General GLTF imports with external textures and buffers follow the GLB workflow, once dependency packaging is implemented. Tree scattering follows reliable single-object placement.

## Interface direction

Use a large central viewport, a tool area for Terrain, Water, Assets, and Building, a scene hierarchy, and a property inspector. Design OpenLandcraft controls around the combined landscape and building workflow. Tool state must be visible; Escape cancels the active gesture. Brush input and transform drags must not also move the camera.

Keep dimensional fields in meters initially. Give users explicit building and river elevations; do not move a building automatically whenever the ground changes. Terrain intersections should remain visible and editable.

## MVP acceptance criteria

- A new site opens without an account or a paid service.
- All four terrain brushes visibly update the terrain and support undo/redo.
- Moving a river handle updates the water and affected ground; undo restores both.
- Removing a river removes its carving contribution while retaining independent terrain edits.
- A local GLB can be placed, selected, moved, rotated, scaled, saved, and reopened.
- A simple building and landscape render and remain independently editable in the same project.
- Exporting and importing a project in a fresh browser context preserves geometry parameters and imported asset bytes.
- Cancelling a drag or brush stroke leaves no partial edit or history entry.
- Invalid project data produces an actionable error and preserves the current project.

History must work during an editing session. Preserving the undo stack across browser restarts is deferred; reopening must preserve the latest committed project state.

## Performance targets

Use a provisional benchmark scene: a 200 m by 200 m site, about 257 by 257 terrain samples, one river with up to 16 control points, 500 vegetation instances sharing a small set of models, and one simple building. These are OpenLandcraft benchmark inputs to validate and adjust during prototyping.

Target at least 30 FPS during navigation and visible brush feedback within 100 ms on an agreed reference Windows machine at 1920 by 1080. Record browser, GPU, asset complexity, and quality settings before treating these as release gates. M0 establishes browser and renderer compatibility; later measurements may change the scene budget.

## Deferred scope

Large tiled worlds, GIS coordinates, branching rivers, hydraulic simulation, physically accurate oceans, terrain erosion, collaborative editing, cloud accounts, IFC workflows, Revit file interoperability, advanced structural elements, photorealistic offline rendering, and a public plugin marketplace are outside the first MVP.

AI scene editing and collaboration are explicitly deferred beyond the current manual-tool expansion. Natural-language operations should eventually use the same validation, history, and persistence as manual tools. REA remains an optional development investigation tool.

## Next manual workflow

Evolve the coastal example into a designed site with a convincing editable shore, a lake, a path linking the pavilion and beach, planted areas, and a building with joined walls, actual door/window openings, and dimensions. Work proceeds through ocean/shoreline/material appearance, practical landscape tools, deeper architecture, and measured scene scaling. These capabilities are planned, not part of the completed MVP acceptance record.

Each increment must preserve independent terrain edits, meaningful selection and parameters, one-step gesture history, cancellation, local save, and portable assets. Runtime foam/wetness and generated geometry must rebuild consistently from authored state. More visual richness must retain a lower-cost preview option and be checked against the recorded M4 workload. AI services, accounts, and live asset-generation connections are not dependencies of this workflow.

## Asset creation and animation direction

Blender MCP and Lux3D are optional production tools for bespoke models and prepared content. The editor should load validated exported assets without needing those tools connected. Richer imported animation can follow basic asset placement, with supported clips and playback settings defined explicitly.

Animated river flow belongs to the first water workflow. A later ocean tool should expose water level and wave controls, with visual quality scaled to the browser budget. Water remains editable scene data with runtime animation; physical fluid simulation stays outside the initial scope.
