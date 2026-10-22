# Horses and people

CC0 Quaternius models, curated from the Farm Animals and Animated Characters packs.
See LICENSE.txt for source links and license records.

Run `tools/prepare-ground-characters.py` in Blender to rebuild from the downloaded
source archives under `.reference/characters`. The script runs in a separate
background Blender process and disables source file scripts.

- Horse: 2.1 m high, matte chestnut coat.
- Casual people: 1.78 m and 1.68 m high, blue and rust shirts.
- Self-contained GLBs with independently baked `Idle` and `Walk` clips.
- Editable Blender sources and transparent thumbnails are included.

Place from Assets → Animals or People on dry, gently sloping ground.

Select a person and use Properties → Walking route → Draw route. Each person owns
their own points and corridor width; the landscape path remains a separate surface.
Only the selected person's guide is shown, with draggable numbered handles. Route
points in Properties support coordinates, insertion and deletion. Routes stay in
world coordinates when moving a person's placed start; copies offset their routes.
A navigation graph stays inside that person's corridor, allowing detours around
buildings and static models where the width permits. A fully blocked corridor is
split into safe sections. People keep right, wait behind others, and yield or
turn back on narrow paths. A shared fixed-step simulation handles all people,
including different assets and sizes; swept collision checks protect the whole
step rather than just its endpoints. Feet follow terrain plus the path lift.

Properties → Animation offers Automatic, Walk and Idle. Automatic and Walk use the
person's own route; Idle stays at the placed position. Without a usable route
people idle instead of circling or borrowing someone else's route. Horses retain
reserved local orbits; their Idle option disables walking. Choices persist in
project format 17, with migration from earlier documents and undo/redo support.
Migration copies the previously followed landscape path into each existing person,
preserving the landscape surface and making subsequent character edits independent.

Terrain anchoring and an offset within 0.15 m enable walking. Fixed-elevation
characters idle. Rotation controls horse route phase and idle heading; a person
following a path faces their travel direction. Scene pause and reduced-motion
preferences freeze position and gait. Each person's open route has up to 16 points.
The shared simulation handles collision checks where different routes cross.
