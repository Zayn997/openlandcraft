# OpenLandcraft starter plants

Six assets adapted from **Kenney Nature Kit 2.1**, licensed **CC0 1.0**.

- Creator and source: https://kenney.nl/assets/nature-kit
- Original license: [LICENSE.txt](LICENSE.txt)
- Download: https://kenney.nl/media/pages/assets/nature-kit/37ac38a37b-1677698939/kenney_nature-kit.zip
- Original filenames, final sizes and triangle counts: `apps/web/src/plant-manifest.json`

Prepared in Blender 5.2: welded coincident vertices, removed degenerate faces,
merged material colors into vertex colors and one opaque material, applied meter
scale, centered each origin on its ground contact, and exported standalone GLB 2.0.
Foliage and bark use OpenLandcraft's muted landscape palette. The pack was already
low-poly; no aggressive silhouette simplification was needed. PNG thumbnails were
rendered from the optimized meshes in Blender.

To rebuild, extract the source ZIP and run:

    blender --background --python tools/prepare-plants.py -- <extracted-pack-directory>

All GLBs are uncompressed and texture-free, so no external decoder or texture
downloads are needed. Placement embeds a source once in each project; repeated
plants reference it and use GPU instancing. The growth effect is a temporary
render transform, never stored as a smaller plant or additional undo steps.
