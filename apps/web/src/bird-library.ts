import { encodeGlb, inspectGlb, type Asset } from '@openlandcraft/core';

export const BIRDS = [{ id: 'songbird', name: 'Songbird', category: 'Birds', height: 0.65, wingspan: 1.2,
  url: '/models/birds/songbird.glb', thumbnail: '/models/birds/songbird.png' }] as const;
export type LibraryBird = typeof BIRDS[number];
export const BIRD_CREDIT = 'Bird by Fabio Gonzalez (gonzalfj), base mesh by noway · CC0-1.0 · https://opengameart.org/content/bird · Recolored and flight cycle authored in Blender for OpenLandcraft.';
export async function loadLibraryBird(bird: LibraryBird, signal: AbortSignal): Promise<Asset> {
  const response = await fetch(bird.url, { signal });
  if (!response.ok) throw new Error(`${bird.name} could not load. Try again.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  inspectGlb(bytes);
  return { id: `cc0-bird-${bird.id}-v1`, name: bird.name, data: encodeGlb(bytes), attribution: BIRD_CREDIT };
}
