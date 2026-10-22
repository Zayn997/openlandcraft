import { decodeGlb, type Asset } from './assets';
const animations = new WeakMap<Asset, string | null>();
/** Embedded identity survives edits to a model's name and optional attribution. */
export function assetAnimation(asset: Asset): string | null {
  if (animations.has(asset)) return animations.get(asset)!;
  let animation: string | null = null;
  try {
    const bytes = decodeGlb(asset.data), view = new DataView(bytes.buffer, bytes.byteOffset);
    const doc = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + view.getUint32(12, true))));
    animation = doc.nodes?.find((node: { extras?: { openlandcraftAnimation?: string } }) =>
      ['bird-flight-v1', 'fish-swim-v1', 'horse-walk-v1', 'person-walk-v1'].includes(node.extras?.openlandcraftAnimation ?? ''))?.extras.openlandcraftAnimation ?? null;
  } catch { /* The GLB validator reports malformed assets. */ }
  animations.set(asset, animation);
  return animation;
}
