import { z } from 'zod';

export const MAX_GLB_BYTES = 8 * 1024 * 1024;
export const MAX_ASSET_BYTES = 24 * 1024 * 1024;
const verified: string[] = [];
let verifiedCharacters = 0;
const glbMetadataSchema = z.object({
  asset: z.object({ version: z.literal('2.0') }),
  buffers: z.array(z.object({ uri: z.string().optional() })).optional(),
  images: z.array(z.object({ uri: z.string().optional() })).optional(),
  extensionsUsed: z.array(z.string()).optional(),
  accessors: z.array(z.object({ count: z.number().int().nonnegative().max(2_000_000) })).optional(),
});
export const glbByteLength = (data: string) => data.length * 0.75 - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);

/** Validate the self-contained GLB envelope before a loader can request resources. */
export function inspectGlb(bytes: Uint8Array): void {
  if (bytes.byteLength > MAX_GLB_BYTES) throw new Error('Use a GLB smaller than 8 MB.');
  if (bytes.byteLength < 20) throw new Error('The GLB is incomplete.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.length) throw new Error('Use a valid GLB 2.0 file.');
  let offset = 12, json: z.infer<typeof glbMetadataSchema> | undefined;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new Error('The GLB chunk is incomplete.');
    const length = view.getUint32(offset, true), kind = view.getUint32(offset + 4, true);
    if (length % 4 || offset + 8 + length > bytes.length) throw new Error('The GLB chunk length is invalid.');
    if (offset === 12 && kind !== 0x4e4f534a) throw new Error('The first GLB chunk must contain JSON.');
    if (kind === 0x4e4f534a) {
      if (json) throw new Error('The GLB contains duplicate JSON chunks.');
      json = glbMetadataSchema.parse(JSON.parse(new TextDecoder().decode(bytes.subarray(offset + 8, offset + 8 + length))));
    }
    offset += 8 + length;
  }
  if (!json || json.asset?.version !== '2.0') throw new Error('Use a GLB 2.0 model.');
  if ([...(json.buffers ?? []), ...(json.images ?? [])].some((resource) => resource.uri !== undefined)) throw new Error('Bundle buffers and images inside the GLB; external files are unsupported.');
  const decoders = ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu'];
  if ((json.extensionsUsed ?? []).some((name: string) => decoders.includes(name))) throw new Error('Export an uncompressed GLB without Draco, Meshopt, or KTX2 textures.');
  if ((json.accessors ?? []).reduce((sum: number, accessor: { count: number }) => sum + accessor.count, 0) > 2_000_000) throw new Error('This model exceeds the prototype geometry budget.');
}

export function encodeGlb(bytes: Uint8Array): string {
  let binary = '';
  for (let start = 0; start < bytes.length; start += 32768) binary += String.fromCharCode(...bytes.subarray(start, start + 32768));
  return btoa(binary);
}
export function decodeGlb(data: string): Uint8Array {
  return Uint8Array.from(atob(data), (character) => character.charCodeAt(0));
}
export const assetSchema = z.object({
  id: z.string().min(1).max(100), name: z.string().trim().min(1).max(80),
  data: z.string().min(1).max(Math.ceil(MAX_GLB_BYTES / 3) * 4),
  attribution: z.string().max(500),
}).strict().superRefine((asset, context) => {
  if (verified.includes(asset.data)) return;
  try {
    if (asset.data.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(asset.data)) throw new Error('Invalid embedded GLB encoding.');
    inspectGlb(decodeGlb(asset.data));
    verified.push(asset.data); verifiedCharacters += asset.data.length;
    while (verifiedCharacters > MAX_ASSET_BYTES * 4 / 3 + 64) verifiedCharacters -= verified.shift()!.length;
  } catch (error) { context.addIssue({ code: 'custom', path: ['data'], message: error instanceof Error ? error.message : 'Invalid GLB.' }); }
});
export type Asset = z.infer<typeof assetSchema>;
