import manifest from './plant-manifest.json';
import { encodeGlb, inspectGlb, type Asset } from '@openlandcraft/core';

export const PLANTS = manifest;
export type LibraryPlant = typeof PLANTS[number];
export const PLANT_CREDIT = 'Kenney Nature Kit · CC0-1.0 · https://kenney.nl/assets/nature-kit · Optimized and recolored in Blender for OpenLandcraft.';

export async function loadLibraryPlant(plant: LibraryPlant, signal: AbortSignal): Promise<Asset> {
  const response = await fetch(plant.url, { signal });
  if (!response.ok) throw new Error(`${plant.name} could not load. Try again.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  inspectGlb(bytes);
  return { id: `kenney-plant-${plant.id}-v1`, name: plant.name, data: encodeGlb(bytes), attribution: PLANT_CREDIT };
}
