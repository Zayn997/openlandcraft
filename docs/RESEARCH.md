# OpenLandcraft reference research

## Purpose

Study how existing tools solve relevant editing problems, then specify and implement our own solution. Pascal is one source among several. Findings inform our design choices.

## Initial research questions

| Reference | Investigation | Our output |
| --- | --- | --- |
| Pascal | Scene organization, parameter edits, selection, snapping, geometry updates, history | Entity definitions, building interactions, command requirements |
| Lumion-style landscape workflow | Brushes, placement, vegetation painting, water controls | Landscape tool behavior and interactions |
| Revit/Rhino-style modeling workflow | Numeric edits, levels, dimensions, relationships, snapping | Bounded parametric building behaviors |
| Other terrain/water tools | Spline editing, carving, bank falloff, resolution, caching | River geometry and terrain evaluation design |
| [hajimetwi3 coastal simulator prompt](https://github.com/hajimetwi3/hajimetwi3-prompt-okiba/blob/main/contents/demo/realtime_kaigan.txt) | Shared depth data, shoreline behavior, water appearance, quality controls | Ocean rendering experiments; see [ocean reference notes](research/OCEAN_REFERENCE.md) |

Select accessible applications or repositories for each investigation. These are research questions, not claims about known internal algorithms.

## Investigation workflow

1. Choose one workflow and a concrete question, such as what moving a wall endpoint changes and how undo restores it.
2. Record the repository revision or application version, access method, and inputs.
3. Observe input, visible state, output, cancellation, and history. Read available source or use REA to investigate mechanisms when useful.
4. Separate evidence from inference and record limitations that affect the design.
5. Specify OpenLandcraft behavior with acceptance examples.
6. Compare implementation choices against our combined landscape and building needs.
7. Implement a bounded experiment using our contracts; revise the design from results.

## Finding record

Each record includes reference/version, question, reproduction steps, observed behavior, source links, inferred mechanism, our proposed behavior, and a verification example. Record provenance for intentionally reused code or assets.

Save completed findings under docs/research/ when research begins. Choose tools to answer concrete questions. Reference research does not make those tools runtime dependencies.

## First deliverable

Compare scene entities, tool lifecycle, parameter editing, history, and serialization. Use the findings to specify our first selectable object and edit command. M0 succeeds when that object works in our editor with undo and save/reopen.
