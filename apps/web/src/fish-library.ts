import { encodeGlb, inspectGlb, type Asset } from '@openlandcraft/core';

export const FISH = [{ id: 'reef-fish', name: 'Reef fish', category: 'Fish', height: 0.31, length: 0.8,
  url: '/models/fish/reef-fish.glb?v=2', thumbnail: '/models/fish/reef-fish.png?v=2' }] as const;
export type LibraryFish = typeof FISH[number];
export const FISH_CREDIT = 'Fish by joyfulsquirrel · CC0-1.0 · https://opengameart.org/content/fish-1 · Reshaped with a streamlined body and a seven-joint swimming rig in Blender for OpenLandcraft.';
export async function loadLibraryFish(fish: LibraryFish, signal: AbortSignal): Promise<Asset> {
  const response = await fetch(fish.url, { signal });
  if (!response.ok) throw new Error(`${fish.name} could not load. Try again.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  inspectGlb(bytes);
  return { id: `cc0-fish-${fish.id}-v2`, name: fish.name, data: encodeGlb(bytes), attribution: FISH_CREDIT };
}
