import { useEffect, useRef, useState, type RefObject } from 'react';
import { TextInput } from './ui';

/** One rename transaction; Escape cancels and blur/Enter commit only once. */
export function InlineRename({name,label,onSave,onClose,maxLength=80,className='tree-rename',returnFocus}:{name:string;label:string;onSave:(name:string)=>unknown;onClose:()=>void;maxLength?:number;className?:string;returnFocus?:RefObject<HTMLElement|null>}) {
  const [value,setValue]=useState(name);
  const input=useRef<HTMLInputElement>(null),finished=useRef(false);
  useEffect(()=>{input.current?.focus();input.current?.select();},[]);
  const finish=(cancel=false)=>{
    if(finished.current)return;
    finished.current=true;
    const trimmed=value.trim();
    if(!cancel&&trimmed&&trimmed!==name)onSave(trimmed);
    onClose();
  };
  return <TextInput ref={input} className={className} aria-label={label} title="Enter to save · Escape to cancel" value={value} maxLength={maxLength}
    onChange={e=>setValue(e.target.value)} onClick={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()}
    onBlur={()=>finish()} onKeyDown={e=>{e.stopPropagation();if(e.nativeEvent.isComposing)return;if(e.key==='Enter'||e.key==='Escape'){
      e.preventDefault();
      const row=e.currentTarget.closest<HTMLElement>('.object-row, [role="treeitem"]');
      finish(e.key==='Escape');
      requestAnimationFrame(()=>{if(returnFocus?.current?.isConnected)returnFocus.current.focus();else if(row?.isConnected)(row.querySelector<HTMLElement>('.object-select')??row).focus();});
    }}}/>;
}
