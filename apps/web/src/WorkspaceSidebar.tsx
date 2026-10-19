import { useEffect, useState, type ReactNode } from 'react';
import { Box, Layers, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

function preference(key:string,fallback:string){try{return localStorage.getItem('olc-sidebar-'+key)??fallback;}catch{return fallback;}}
export function WorkspaceSidebar({name,mobileActive,onRename,layers,objects,actions}:{name:string;mobileActive:boolean;onRename:()=>void;layers:ReactNode;objects:ReactNode;actions:ReactNode}){
  const [tab,setTab]=useState(preference('tab','layers'));
  const [collapsed,setCollapsed]=useState(preference('collapsed','false')==='true');
  const [width,setWidth]=useState(()=>Math.max(260,Math.min(440,Number(preference('width','296'))||296)));
  useEffect(()=>{try{localStorage.setItem('olc-sidebar-tab',tab);localStorage.setItem('olc-sidebar-collapsed',String(collapsed));localStorage.setItem('olc-sidebar-width',String(width));}catch{/* Preferences are optional. */}},[tab,collapsed,width]);
  return <aside className={`scene-panel workspace-sidebar ${mobileActive?'mobile-active':''} ${collapsed?'sidebar-collapsed':''}`} style={{'--sidebar-width':`${width}px`} as React.CSSProperties} aria-label="Workspace organizer">
    <div className="sidebar-rail"><button aria-label="Expand sidebar" title="Expand sidebar" onClick={()=>setCollapsed(false)}><PanelLeftOpen size={17}/></button><button aria-label="Open Layers" title="Layers" onClick={()=>{setTab('layers');setCollapsed(false);}}><Layers size={17}/></button><button aria-label="Open Objects" title="Objects" onClick={()=>{setTab('objects');setCollapsed(false);}}><Box size={17}/></button></div>
    <div className="sidebar-expanded">
      <div className="organizer-header"><button className="organizer-project" onClick={onRename} title="Rename project">{name}</button><button className="sidebar-collapse-button" aria-label="Collapse sidebar" title="Collapse sidebar" onClick={()=>setCollapsed(true)}><PanelLeftClose size={16}/></button></div>
      <div className="organizer-tabs" role="tablist" aria-label="Organizer view"><button id="layers-tab" role="tab" aria-selected={tab==='layers'} aria-controls="layers-tabpanel" onClick={()=>setTab('layers')}><Layers size={14}/>Layers</button><button id="objects-tab" role="tab" aria-selected={tab==='objects'} aria-controls="objects-tabpanel" onClick={()=>setTab('objects')}><Box size={14}/>Objects</button></div>
      <div id="layers-tabpanel" className="organizer-tabpanel" role="tabpanel" aria-labelledby="layers-tab" hidden={tab!=='layers'}>{layers}</div>
      <div id="objects-tabpanel" className="organizer-tabpanel" role="tabpanel" aria-labelledby="objects-tab" hidden={tab!=='objects'}>{objects}</div>
      <div className="organizer-create">{actions}</div>
    </div>
    <div className="sidebar-resizer" role="separator" aria-label="Sidebar width" aria-orientation="vertical" aria-valuemin={260} aria-valuemax={440} aria-valuenow={width} tabIndex={0} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setWidth(w=>Math.max(260,Math.min(440,w+(e.key==='ArrowRight'?12:-12))));}}} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId)){const left=e.currentTarget.parentElement!.getBoundingClientRect().left;setWidth(Math.max(260,Math.min(440,e.clientX-left)));}}} onPointerUp={e=>e.currentTarget.releasePointerCapture(e.pointerId)}/>
  </aside>;
}
