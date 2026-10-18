import { createServer } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' });
try {
  const { parseProject, createBuilding, scatterInstances } = await server.ssrLoadModule('/packages/core/src/index.ts');
  const { serializeProject } = await server.ssrLoadModule('/packages/project/src/index.ts');
  const project = parseProject(JSON.parse(readFileSync('examples/sculpted-coast.olc.json', 'utf8')));
  project.name = 'Coastal architecture';
  project.entities.forEach((entity) => { if (entity.kind === 'block') entity.visible = false; });
  const tree = JSON.parse(readFileSync('examples/demo-tree.asset.json', 'utf8'));
  project.assets = [tree];
  const instance = { id: 'pine-main', kind: 'instance', parentId: 'site', name: 'Coastal pine', visible: true, assetId: tree.id, position: [-35, 0, -1], rotation: 15, scale: [1, 1, 1], anchor: 'terrain' };
  project.entities.push(...createBuilding(project, -25, 14, 12, 8, 'coastal-building'), instance, ...scatterInstances(instance, 10, 5, 42, 'pine-grove'));
  writeFileSync('examples/coastal-architecture.olc.json', serializeProject(project));
  console.log(`Wrote portable M2 example with ${project.entities.length} entities and ${project.assets.length} embedded model.`);
} finally { await server.close(); }
