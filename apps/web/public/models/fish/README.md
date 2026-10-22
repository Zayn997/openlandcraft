# Reef fish

CC0 fish by joyfulsquirrel: https://opengameart.org/content/fish-1

Revision 2: 788 triangles; seven-bone rig; 0.8 m long; self-contained GLB with a looping 1.2-second Swim clip. Streamlined silhouette, small lateral eyes, forked tail, and swept fins. Muted silver-green vertex colors provide a dark back and light belly. Body, tail and fins move with staggered phases. The viewer adds independent water-contained routes and respects pause/reduced motion.

Rebuild with Blender 5.2:

    blender --background --python tools/prepare-fish.py -- <absolute path to original fish.blend>

The script exports the GLB, editable Blender source and transparent catalog thumbnail. Embedded fish-swim-v1 metadata survives project exports and source renaming. Placed fish remain embedded in saved projects. When opening a project, only the exact original bundled GLB is upgraded to this revision; customized assets are preserved and a failed upgrade keeps the original.

Nearby placed fish automatically form schools of up to eight across source assets. Each school reserves a water-safe turning area; staggered slots and bounded individual sway retain body clearance. Larger or crowded groups split into smaller schools. If no safe area exists, the saved fish stays hidden until moved or resized; the inspector explains this. All schools share the pause/reduced-motion clock.
