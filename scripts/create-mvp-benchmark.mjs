import { createServer } from 'vite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' });
try {
  const core = await server.ssrLoadModule('/packages/core/src/index.ts');
  const { TerrainStroke, DEFAULT_BRUSH } = await server.ssrLoadModule('/packages/landscape/src/index.ts');
  const { serializeProject } = await server.ssrLoadModule('/packages/project/src/index.ts');
  const project = core.createSite({ name: 'MVP benchmark · 500 trees', width: 200, depth: 200, resolution: 257, preset: 'coast' });
  const tree = JSON.parse(readFileSync('examples/demo-tree.asset.json', 'utf8')); project.assets = [tree];
  const trees = Array.from({ length: 500 }, (_, index) => ({ id: `benchmark-tree-${index}`, kind: 'instance', parentId: 'site', name: `Tree ${index + 1}`, visible: true, assetId: tree.id,
    position: [-92 + (index % 20) * 3.7, 0, -90 + Math.floor(index / 20) * 7.3], rotation: index * 137.5 % 360, scale: [1, 1, 1], anchor: 'terrain' }));
  let previous = 30;
  const river = { ...core.createRiver(project), id: 'benchmark-river', width: 6, bank: 3, points: Array.from({ length: 16 }, (_, index) => {
    const z = -85 + index / 15 * 170, x = -8 + Math.sin(index / 15 * Math.PI * 3) * 3;
    previous = Math.max(0, Math.min(previous, core.groundHeight(x, z, project.site) - 0.3)); return [x, previous, z];
  }) };
  const editor = new core.Editor(project); editor.execute({ type: 'insert', entities: [...trees, ...core.createBuilding(project, -35, 10, 12, 8, 'benchmark-building'), river] }, 'Build benchmark');
  mkdirSync('.qa', { recursive: true }); writeFileSync('.qa/mvp-benchmark.olc.json', serializeProject(editor.getSnapshot().project));
  const authored = editor.getSnapshot().project, stroke = new TerrainStroke(authored.site.terrain, authored.site, DEFAULT_BRUSH), durations = [];
  editor.begin('Benchmark sculpt');
  for (let i = 0; i < 30; i++) { const start = performance.now(); stroke.move(-15 + i * 0.3, 15); editor.preview({ type: 'terrain', field: stroke.snapshot() }); core.evaluateProject(editor.getSnapshot().preview); durations.push(performance.now() - start); }
  editor.cancel(); durations.sort((a, b) => a - b);
  console.log(JSON.stringify({ entities: authored.entities.length, trees: trees.length, riverPoints: river.points.length, grid: [257, 257], cpuBrushMedianMs: +durations[15].toFixed(2), cpuBrushP95Ms: +durations[28].toFixed(2), note: 'Node brush + core preview + evaluated carving; excludes browser/GPU.' }));
} finally { await server.close(); }
