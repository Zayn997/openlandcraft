import { createServer } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' });
try {
  const { Editor, parseProject, createRiver, evaluateProject } = await server.ssrLoadModule('/packages/core/src/index.ts');
  const { serializeProject } = await server.ssrLoadModule('/packages/project/src/index.ts');
  const project = parseProject(JSON.parse(readFileSync('examples/coastal-architecture.olc.json', 'utf8')));
  project.name = 'Coastal river study';
  const editor = new Editor(project), river = { ...createRiver(project), id: 'coastal-river' };
  editor.execute({ type: 'add', entity: river }, 'Add river');
  writeFileSync('examples/coastal-river.olc.json', serializeProject(editor.getSnapshot().project));
  const durations = []; editor.begin('Benchmark preview');
  for (let i = 0; i < 20; i++) {
    const start = performance.now(); editor.preview({ type: 'replace', entity: { ...river, width: 4 + i * 0.07 } });
    evaluateProject(editor.getSnapshot().preview); durations.push(performance.now() - start);
  }
  editor.cancel(); durations.sort((a, b) => a - b);
  console.log(JSON.stringify({ entities: editor.getSnapshot().project.entities.length, grid: [project.site.terrain.columns, project.site.terrain.rows], cpuPreviewMedianMs: +durations[10].toFixed(2), cpuPreviewP95Ms: +durations[18].toFixed(2), note: 'Node command validation plus derived terrain evaluation; excludes GPU and browser input.' }));
} finally { await server.close(); }
