import { Button, Panel, PanelResizeHandle, Row } from './ui';
import { useEffect, useState, type ReactNode } from 'react';
import { Box, Layers, Leaf, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

function preference(key:string,fallback:string){try{return localStorage.getItem('olc-sidebar-'+key)??fallback;}catch{return fallback;}}
export function WorkspaceSidebar({mobileActive,layers,objects,assets,actions}:{mobileActive:boolean;layers:ReactNode;objects:ReactNode;assets:ReactNode;actions:ReactNode}){
  const [tab,setTab]=useState(preference('tab','layers'));
  const [collapsed,setCollapsed]=useState(preference('collapsed','false')==='true');
  const [width,setWidth]=useState(()=>Math.max(260,Math.min(440,Number(preference('width','296'))||296)));
  useEffect(()=>{try{localStorage.setItem('olc-sidebar-tab',tab);localStorage.setItem('olc-sidebar-collapsed',String(collapsed));localStorage.setItem('olc-sidebar-width',String(width));}catch{/* Preferences are optional. */}},[tab,collapsed,width]);
  return <Panel as="aside" id="workspace-organizer" className={`scene-panel workspace-sidebar ${mobileActive?'mobile-active':''} ${collapsed?'sidebar-collapsed':''}`} style={{'--sidebar-width':`${width}px`} as React.CSSProperties} aria-label="Workspace organizer">
    <div className="sidebar-rail"><button aria-label="Expand sidebar" title="Expand sidebar" onClick={()=>setCollapsed(false)}><PanelLeftOpen size={17}/></button><button aria-label="Open Layers" title="Layers" onClick={()=>{setTab('layers');setCollapsed(false);}}><Layers size={17}/></button><button aria-label="Open Objects" title="Objects" onClick={()=>{setTab('objects');setCollapsed(false);}}><Box size={17}/></button><button aria-label="Open Assets" title="Assets" onClick={()=>{setTab('assets');setCollapsed(false);}}><Leaf size={17}/></button></div>
    <div className="sidebar-expanded">
      <Row justify="between" gap="none" className="shrink-0 min-h-10 border-0 border-b border-solid border-line pr-2">
        <div className="organizer-tabs border-b-0 gap-3 px-2" role="tablist" aria-label="Organizer view" onKeyDown={event=>{
          const tabs=['layers','objects','assets'];
          if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
          event.preventDefault();
          const next=event.key==='Home'?'layers':event.key==='End'?'assets':tabs[(tabs.indexOf(tab)+(event.key==='ArrowRight'?1:2))%3];
          setTab(next);document.getElementById(next+'-tab')?.focus();
        }}>
          {([{id:'layers',name:'Layers',Icon:Layers},{id:'objects',name:'Objects',Icon:Box},{id:'assets',name:'Assets',Icon:Leaf}]).map(({id,name,Icon})=><button key={id} id={id+'-tab'} role="tab" tabIndex={tab===id?0:-1} aria-selected={tab===id} aria-controls={id+'-tabpanel'} onClick={()=>setTab(id)}><Icon size={14}/>{name}</button>)}
        </div>
        <Button variant="ghost" size="icon-sm" className="sidebar-collapse-button max-[1000px]:hidden" aria-label="Collapse sidebar" title="Collapse sidebar" onClick={()=>setCollapsed(true)}><PanelLeftClose size={16}/></Button>
      </Row>
      <div id="layers-tabpanel" className="organizer-tabpanel" role="tabpanel" aria-labelledby="layers-tab" hidden={tab!=='layers'}>{layers}</div>
      <div id="objects-tabpanel" className="organizer-tabpanel" role="tabpanel" aria-labelledby="objects-tab" hidden={tab!=='objects'}>{objects}</div>
      <div id="assets-tabpanel" className="organizer-tabpanel" role="tabpanel" aria-labelledby="assets-tab" hidden={tab!=='assets'}>{assets}</div>
      <div className="organizer-create">{actions}</div>
    </div>
    {!collapsed && <PanelResizeHandle side="left" width={width} defaultWidth={296} label="Sidebar width" controls="workspace-organizer" onWidthChange={setWidth} />}
  </Panel>;
}
