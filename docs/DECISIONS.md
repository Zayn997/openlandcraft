# OpenLandcraft planning decisions

October 17, 2026. User-directed decisions establish direction; proposed defaults remain open to prototype evidence.

## Product direction

| Decision | Status | Reason |
| --- | --- | --- |
| Use the name OpenLandcraft | User directed | Selected identity. |
| Build our own editor and architecture | User directed | Our implementation and product direction must be independent. |
| Study Pascal as one reference source | User directed | Reverse engineering informs workflows and architectural choices. |
| Own scene data, UI, commands, geometry systems, and project format | Follows independent editor direction | Core behavior must be under our control. |
| Prove a small landscape and building workflow first | Proposed | Exercises terrain, architecture, water, and storage. |
| Start locally; add AI after reliable manual editing | Proposed | Both need dependable commands and persistence. |
| Defer AI editing and collaboration during manual-tool expansion | User directed October 18, 2026 | Prioritize getting closer to the intended landscape and building editor. |
| Follow ocean/shoreline appearance with landscape tools, architecture, then measured scale | Proposed October 18, 2026 | Deliver a coherent coastal-site workflow in bounded increments; see M5–M8 in the roadmap. |

## Technical defaults

| Decision | Status | Revisit when |
| --- | --- | --- |
| Use general-purpose React and Three.js tooling | Proposed | M0 identifies a better fit. |
| Use one authored model and command history | Proposed | An alternative proves equivalent atomicity and consistency. |
| Derive render meshes from editable parameters | Proposed | Explicit mesh editing becomes necessary. |
| Separate river carving from authored ground | Proposed | Measurements suggest another reversible representation. |
| Begin with GLB and bounded terrain | Proposed | Wider formats or scale become necessary after the first workflow passes. |
| Use Blender MCP and Lux3D when bespoke assets require them | User identified available tools; optional use | An actual content task establishes the required capabilities and output format. |
| Implement editable water animation in our renderer | Proposed | Specific effects warrant imported or baked content alongside runtime rendering. |

Blender and Lux3D are production aids. Existing project editing remains independent of their live connections. Store water and animation parameters as authored settings; evaluate motion using a runtime clock without adding per-frame history entries.

## Reference study policy

Research records observed behavior, implementation evidence, tradeoffs, and our implementation choices. Record revisions or application versions. Distinguish running-app observations from source/documentation inferences.

Pascal package embedding and compatibility with its internal model are outside our foundation plan. General-purpose libraries remain available. Any deliberate reuse of reference code must identify provenance and applicable license; independent implementation is the default.

Use REA when it helps inspect an available reference. Source reading, browser observation, and controlled experiments also serve the research. See [Reference research](RESEARCH.md).

## Assumptions requiring evidence

- Our viewport approach supports the required picking, input, and performance.
- Terrain, rivers, and buildings can share one efficient transaction model.
- The bounded benchmark represents a useful initial workload.
- Portable bundles preserve authored parameters and imported asset bytes.

## Risks and responses

| Risk | Planned response |
| --- | --- |
| Independent editor scope grows too quickly | Prove core commands, then build a small version of each tool. |
| Reference details become accidental requirements | Write our behavior specifications and reasons for each feature. |
| River edits destroy sculpting | Preserve authored ground and evaluate reversible carving. |
| UI and agent edits diverge | Route both through shared commands. |
| Export keeps temporary asset URLs | Bundle bytes by stable IDs and test fresh-storage import. |
| Browser budget is exceeded | Measure bounded workloads, share resources, and instance repeated models. |

## Questions for later review

Confirm professional workflows, site sizes, hardware/browser targets, interchange formats, and team-sharing needs before expansion. Choose the license before public distribution and preserve dependency and asset notices.
