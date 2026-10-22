import {createServer} from 'vite';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {cpus,platform,release,totalmem} from 'node:os';

// Run from the repository root. Generated projects and reports never replace local editor storage.
const output=resolve('.qa/m8'),root=process.cwd().replaceAll('\\','/');
mkdirSync(output,{recursive:true});
const server=await createServer({configFile:false,root:process.cwd(),server:{middlewareMode:true},appType:'custom'});
try {
  const core=await server.ssrLoadModule('/packages/core/src/index.ts');
  const landscape=await server.ssrLoadModule('/packages/landscape/src/index.ts');
  const storage=await server.ssrLoadModule('/packages/project/src/index.ts');
  const asset=(id,path,attribution)=>({id,name:id,data:core.encodeGlb(new Uint8Array(readFileSync(path))),attribution});
  const pine=asset('m8-pine','apps/web/public/models/plants/pine.glb','Kenney Nature Kit · CC0-1.0');
  const person=asset('m8-person','apps/web/public/models/characters/person-male.glb','Quaternius · CC0-1.0');
  const instance=(id,assetId,x,z)=>({id,assetId,kind:'instance',parentId:'site',name:id,visible:true,position:[x,0,z],rotation:0,scale:[1,1,1],anchor:'terrain'});
  const scenarios=[];
  for(const count of [100,500,900]) {
    const project=core.createSite({name:`M8 · ${count} pines`,width:200,depth:200,resolution:257,preset:'flat'});
    project.assets=[pine];
    const columns=Math.ceil(Math.sqrt(count));
    project.entities=Array.from({length:count},(_,i)=>({...instance(`pine-${i}`,pine.id,-90+(i%columns)*180/(columns-1),-90+Math.floor(i/columns)*180/(columns-1)),rotation:i*137.5%360}));
    scenarios.push({id:`plants-${count}`,project});
  }
  for(const count of [2,12]) {
    const project=core.createSite({name:`M8 · ${count} walking people`,width:80,depth:80,resolution:129,preset:'flat'});
    project.assets=[person];
    project.entities=Array.from({length:count},(_,i)=>({...instance(`person-${i}`,person.id,-18,-25+i*4.5),characterAnimation:'walk',walkingRoute:{points:[[-18,-25+i*4.5],[18,-25+i*4.5]],width:2}}));
    const routes=core.groundRoutes(project);
    if([...routes.values()].filter(r=>r.reason==='path').length!==count)throw new Error('Character benchmark must exercise all walking routes.');
    scenarios.push({id:`people-${count}`,project});
  }
  scenarios.push({id:'combined',project:core.parseProject(JSON.parse(readFileSync('examples/repeated-units.olc.json','utf8')))});
  const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.max(0,Math.ceil(values.length*p)-1)];
  const time=(run,n=12)=>{
    for(let i=0;i<3;i++)run();
    const samples=Array.from({length:n},()=>{const start=performance.now();run();return performance.now()-start;});
    return {samples:n,p50Ms:+percentile(samples,.5).toFixed(2),p95Ms:+percentile(samples,.95).toFixed(2)};
  };
  const manifest=[];
  for(const {id,project:source} of scenarios) {
    const project=core.parseProject(source),text=storage.serializeProject(project),editor=new core.Editor(project);
    const preview=time(()=>{const stroke=new landscape.TerrainStroke(project.site.terrain,project.site,landscape.DEFAULT_BRUSH);editor.begin('M8 CPU brush sample');stroke.move(-10,10);editor.preview({type:'terrain',field:stroke.snapshot()});core.evaluateProject(editor.getSnapshot().preview);editor.cancel();});
    const entry={id,name:project.name,entities:project.entities.length,assets:project.assets.length,site:[project.site.width,project.site.depth],grid:[project.site.terrain.columns,project.site.terrain.rows],fileBytes:Buffer.byteLength(text),sourceBytes:project.assets.reduce((sum,a)=>sum+core.decodeGlb(a.data).byteLength,0),cpu:{serialize:time(()=>storage.serializeProject(project)),deserialize:time(()=>storage.deserializeProject(text)),brushPreview:preview}};
    writeFileSync(resolve(output,`${id}.olc.json`),text);manifest.push(entry);
  }
  const report={generatedAt:new Date().toISOString(),environment:{platform:platform(),release:release(),cpu:cpus()[0]?.model,logicalCpus:cpus().length,systemMemoryBytes:totalmem(),node:process.version},note:'CPU timings exclude browser rendering/GPU and are not input-to-display latency. Brush includes snapshot, validation, evaluation and cancel; each run starts from the committed project.',scenarios:manifest};
  writeFileSync(resolve(output,'manifest.json'),JSON.stringify(report,null,2));
  writeFileSync(resolve(output,'index.html'),`<!doctype html><html><head><meta charset="UTF-8"><title>M8 performance baseline</title><link rel="stylesheet" href="/src/app.css"><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/@vite/client"></script></head><body><div id="root"></div><script type="module">import {mountBenchmark} from '/@fs/${root}/tools/performance/harness.tsx';mountBenchmark('/@fs/${root}/.qa/m8/');</script></body></html>`);
  console.log(JSON.stringify(report,null,2));
} finally {await server.close();}
