// Original, deliberately small GLB fixture. Run with node scripts/create-demo-tree.mjs.
import { mkdirSync, writeFileSync } from 'node:fs';
const chunks = [], views = [], accessors = [], primitives = [];
let byteLength = 0;
function part(color, rings) {
  const positions = [], normals = [];
  function triangle(a, b, c) {
    const u = b.map((v, i) => v - a[i]), v = c.map((value, i) => value - a[i]);
    const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const length = Math.hypot(...cross) || 1;
    positions.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) normals.push(...cross.map((value) => value / length));
  }
  for (const [bottom, top, radius, topRadius] of rings) for (let i = 0; i < 10; i++) {
    const point = (index, y, r) => [Math.cos(index * Math.PI / 5) * r, y, Math.sin(index * Math.PI / 5) * r];
    const a = point(i, bottom, radius), b = point(i + 1, bottom, radius), c = point(i, top, topRadius), d = point(i + 1, top, topRadius);
    triangle(a, c, b); if (topRadius > 0) triangle(b, c, d); triangle([0, bottom, 0], a, b);
  }
  const attribute = (values, bounds = false) => {
    const buffer = Buffer.from(new Float32Array(values).buffer), index = accessors.length;
    views.push({ buffer: 0, byteOffset: byteLength, byteLength: buffer.length }); chunks.push(buffer); byteLength += buffer.length;
    const accessor = { bufferView: views.length - 1, componentType: 5126, count: values.length / 3, type: 'VEC3' };
    if (bounds) { accessor.min = [0, 1, 2].map((axis) => Math.min(...values.filter((_, i) => i % 3 === axis))); accessor.max = [0, 1, 2].map((axis) => Math.max(...values.filter((_, i) => i % 3 === axis))); }
    accessors.push(accessor); return index;
  };
  primitives.push({ attributes: { POSITION: attribute(positions, true), NORMAL: attribute(normals) }, material: color });
}
part(0, [[0, 3.8, 0.18, 0.13]]);
part(1, [[1.5, 4.5, 1.5, 0], [2.8, 5.4, 1.2, 0], [4, 6.2, 0.85, 0]]);
const json = { asset: { version: '2.0', generator: 'OpenLandcraft original demo tree' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives }], materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.32, 0.20, 0.12, 1], metallicFactor: 0, roughnessFactor: 1 } }, { pbrMetallicRoughness: { baseColorFactor: [0.20, 0.34, 0.23, 1], metallicFactor: 0, roughnessFactor: 0.9 } }], buffers: [{ byteLength }], bufferViews: views, accessors };
let jsonChunk = Buffer.from(JSON.stringify(json)); jsonChunk = Buffer.concat([jsonChunk, Buffer.alloc((4 - jsonChunk.length % 4) % 4, 32)]);
const bin = Buffer.concat(chunks), header = Buffer.alloc(12), jsonHeader = Buffer.alloc(8), binHeader = Buffer.alloc(8);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + jsonChunk.length + bin.length, 8);
jsonHeader.writeUInt32LE(jsonChunk.length, 0); jsonHeader.writeUInt32LE(0x4e4f534a, 4); binHeader.writeUInt32LE(bin.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
const glb = Buffer.concat([header, jsonHeader, jsonChunk, binHeader, bin]);
mkdirSync('apps/web/public/models', { recursive: true });
writeFileSync('apps/web/public/models/openlandcraft-pine.glb', glb);
writeFileSync('examples/demo-tree.asset.json', JSON.stringify({ id: 'demo-pine', name: 'Coastal pine', data: glb.toString('base64'), attribution: 'Original OpenLandcraft procedural demo tree; CC0-1.0.' }, null, 2));
console.log(`Wrote original tree: ${glb.length} bytes, ${primitives.length} primitives.`);
