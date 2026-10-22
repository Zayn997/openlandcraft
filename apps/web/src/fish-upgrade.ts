import { decodeGlb, type Project } from '@openlandcraft/core';
import { validateModels } from '@openlandcraft/viewport';
import { FISH, FISH_CREDIT, loadLibraryFish } from './fish-library';

const LEGACY_BYTES = 33384;
const LEGACY_SHA256 = 'abb7e0c9d1df0e1dc90bdd3a9163357cef32b69e894f37b67dccc6b067cd4d48';
const LEGACY_CREDIT = 'Fish by joyfulsquirrel · CC0-1.0 · https://opengameart.org/content/fish-1 · Optimized with a new swimming cycle in Blender for OpenLandcraft.';

/** Upgrade only the exact previously bundled file, never a customized or merely renamed fish model. */
export async function upgradeLibraryFish(project: Project): Promise<Project> {
  const ids = new Set<string>();
  for (const asset of project.assets) {
    if (asset.data.length !== Math.ceil(LEGACY_BYTES / 3) * 4) continue;
    try {
      const bytes = decodeGlb(asset.data);
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>));
      if (Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('') === LEGACY_SHA256) ids.add(asset.id);
    } catch { /* Normal project validation handles invalid embedded data. */ }
  }
  if (!ids.size) return project;
  try {
    const replacement = await loadLibraryFish(FISH[0], new AbortController().signal);
    await validateModels([replacement]);
    return { ...project, assets: project.assets.map(asset => ids.has(asset.id) ? {
      ...asset, data: replacement.data, attribution: asset.attribution === LEGACY_CREDIT ? FISH_CREDIT : asset.attribution,
    } : asset) };
  } catch {
    // Offline or a missing library file must never prevent opening a self-contained project.
    return project;
  }
}
