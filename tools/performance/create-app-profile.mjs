import {createServer} from 'vite';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=process.cwd().replaceAll('\\','/'),output=resolve('.qa/m8-app');mkdirSync(output,{recursive:true});
const server=await createServer({configFile:false,root:process.cwd(),server:{middlewareMode:true},appType:'custom'});
try {
  const core=await server.ssrLoadModule('/packages/core/src/index.ts'),{serializeProject}=await server.ssrLoadModule('/packages/project/src/index.ts');
  const load=(id,path,attribution)=>({id,name:id,data:core.encodeGlb(new Uint8Array(readFileSync(path))),attribution});
  const pine=load('m8-pine','apps/web/public/models/plants/pine.glb','Kenney Nature Kit · CC0-1.0');
  const person=load('m8-person','apps/web/public/models/characters/person-male.glb','Quaternius · CC0-1.0');
  const base=core.parseProject(JSON.parse(readFileSync('examples/repeated-units.olc.json','utf8')));
  base.entities=base.entities.filter(e=>e.kind!=='instance');
  base.objectLayers=Object.fromEntries(Object.entries(base.objectLayers).filter(([id])=>id==='terrain'||base.entities.some(e=>e.id===id)));
  base.assets.push(pine,person);
  const evaluated=core.evaluateProject(base),habitat=core.groundHabitat(evaluated),people=[];
  for(let z=-50;z<=50&&people.length<12;z+=6)for(let x=-66;x<=-30&&people.length<12;x+=12){
    if(!Array.from({length:21},(_,i)=>habitat.clear(x+i*.5,z,1.2)).every(Boolean))continue;
    const actor={...core.createPlacedInstance(base,person,x,z,false,`mixed-person-${people.length}`),characterAnimation:'walk',walkingRoute:{points:[[x,z],[x+10,z]],width:2}};
    if(people.some(other=>Math.hypot(x-other.position[0],z-other.position[2])<3))continue;
    people.push(actor);
  }
  if(people.length!==12)throw new Error(`Only ${people.length} valid character corridors found`);
  const plants=[];
  for(let z=-56;z<=56;z+=2.5)for(let x=-70;x<10;x+=2.5){
    if(!habitat.clear(x,z,.35))continue;
    if(people.some(p=>{const [a,b]=p.walkingRoute.points;return z>a[1]-2.5&&z<a[1]+2.5&&x>a[0]-2.5&&x<b[0]+2.5;}))continue;
    plants.push({...core.createPlacedInstance(base,pine,x,z,false,`mixed-pine-${plants.length}`),rotation:plants.length*137.5%360});
  }
  if(plants.length<500)throw new Error(`Only ${plants.length} valid plant positions`);
  for(const count of [100,500]){
    const project=core.parseProject({...base,name:`M8 mixed · ${count} plants · 12 people · water`,entities:[...base.entities,...plants.slice(0,count),...people]});
    const routes=core.groundRoutes(core.evaluateProject(project));
    if([...routes.values()].filter(r=>r.reason==='path').length!==12)throw new Error('Every mixed-scene person must have a usable route');
    writeFileSync(resolve(output,`mixed-${count}.olc.json`),serializeProject(project));
    console.log(JSON.stringify({count,entities:project.entities.length,people:routes.size,bytes:Buffer.byteLength(serializeProject(project))}));
  }
  writeFileSync(resolve(output,'small.olc.json'),serializeProject(core.createSite({name:'M8 cleanup control',width:40,depth:40,resolution:129,preset:'flat'})));
  const horse=load('m8-horse','apps/web/public/models/characters/horse.glb','Quaternius · CC0-1.0');
  const horseStudy=core.createSite({name:'M8 continuous horse walk',width:40,depth:40,resolution:129,preset:'flat'});
  horseStudy.assets=[horse,pine];
  horseStudy.entities=[core.createPlacedInstance(horseStudy,horse,-7,0,false,'m8-horse-walking'),core.createLake(horseStudy,[[6,-7],[17,-7],[17,7],[6,7]])];
  for(const [x,z] of [[-16,-15],[-8,-15],[0,-15],[-16,15],[-8,15],[0,15]])horseStudy.entities.push(core.createPlacedInstance(horseStudy,pine,x,z,false,`horse-pine-${x}-${z}`));
  if(!core.groundRoutes(core.evaluateProject(horseStudy)).get('m8-horse-walking')?.radius)throw new Error('Horse study needs a safe moving orbit');
  writeFileSync(resolve(output,'horse-walk.olc.json'),serializeProject(horseStudy));
  const preamble=`<script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/@vite/client"></script>`;
  writeFileSync(resolve(output,'app.html'),`<!doctype html><html><head><meta charset="UTF-8"><title>Actual app profiling</title>${preamble}</head><body><div id="root"></div><script type="module" src="/@fs/${root}/tools/performance/app-recorder.tsx"></script></body></html>`);
  writeFileSync(resolve(output,'index.html'),readFileSync('tools/performance/app-host.html','utf8'));
} finally {await server.close();}
