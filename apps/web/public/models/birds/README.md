# Songbird

- Source: [Bird by Fabio Gonzalez / gonzalfj](https://opengameart.org/content/bird), published September 1, 2013.
- Original mesh: [Bird basemesh by noway](https://opengameart.org/content/bird-basemesh), April 22, 2013.
- Both author pages explicitly license their assets under **CC0 1.0**. Verified October 21, 2026. Attribution is optional.
- Original download: https://opengameart.org/sites/default/files/bird_0.blend
- License: https://creativecommons.org/publicdomain/zero/1.0/

OpenLandcraft retains the mesh and skin weights, replaces the legacy material with vertex colors, scales the wingspan to 1.2 meters, and adds a new seamless Flight clip with staggered shoulder/wingtip motion. The runtime blends flapping with gliding and moves each bird along a bounded, banked flight path. No textures or external resources are required.

`songbird.glb` is the runtime asset, `songbird.png` its rendered catalog preview, and `songbird.blend` the editable Blender source. Rebuild with `tools/prepare-bird.py` and the original download. Runtime flight behavior is stored in the GLB extras (`openlandcraftAnimation: bird-flight-v1`) and persists with embedded project assets.
