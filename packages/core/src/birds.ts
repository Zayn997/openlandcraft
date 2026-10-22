import type { Asset } from './assets';
import { assetAnimation } from './asset-animation';
export const isBirdAsset = (asset: Asset): boolean => assetAnimation(asset) === 'bird-flight-v1';
