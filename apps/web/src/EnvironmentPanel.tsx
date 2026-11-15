import { useEffect, useRef } from 'react';
import { CloudSun, Leaf, RotateCcw, Sun, X } from 'lucide-react';
import { DEFAULT_ENVIRONMENT, type Editor, type SceneEnvironment } from '@openlandcraft/core';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Button, Field, FieldMessage, Row } from './ui';

export function EnvironmentPanel({ editor, value, onClose, onError }: { editor: Editor; value?: SceneEnvironment; onClose: () => void; onError: (message: string) => void }) {
  const environment = value ?? DEFAULT_ENVIRONMENT, close = useRef<HTMLButtonElement>(null);
  const gesture = 'Adjust sun position';
  useEffect(() => { close.current?.focus(); return () => { if (editor.getSnapshot().gestureLabel === gesture) editor.commit(); }; }, [editor]);
  const finish = () => { if (editor.getSnapshot().gestureLabel === gesture) editor.commit(); };
  const change = (patch: Partial<SceneEnvironment>, preview = false) => {
    try {
      if (!preview) finish();
      const snapshot = editor.getSnapshot(), current = (snapshot.preview ?? snapshot.project).environment ?? DEFAULT_ENVIRONMENT;
      const command = { type: 'environment' as const, environment: { ...current, ...patch } };
      if (preview) { if (!snapshot.gestureLabel) editor.begin(gesture); editor.preview(command); }
      else editor.execute(command, 'Change environment');
    } catch (error) { onError(error instanceof Error ? error.message : 'Could not change the environment.'); }
  };
  return <section id="environment-panel" className="environment-panel" aria-label="Environment settings" onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); finish(); onClose(); }
    if ((event.ctrlKey || event.metaKey) && !event.altKey && ['z','y'].includes(event.key.toLowerCase())) {
      event.preventDefault(); event.stopPropagation(); finish();
      if (event.shiftKey || event.key.toLowerCase() === 'y') editor.redo(); else editor.undo();
    }
  }}>
    <Row justify="between"><h2 className="m-0 text-title">Environment</h2><Button ref={close} variant="ghost" size="icon" aria-label="Close environment settings" onClick={() => { finish(); onClose(); }}><X size={16}/></Button></Row>
    <p className="text-caption text-muted mt-1 mb-3">Set the atmosphere for your scene. Saved with the project.</p>
    <Accordion type="multiple" defaultValue={['season','sun','weather']}>
      <AccordionItem value="season"><AccordionTrigger><span className="flex items-center gap-2"><Leaf size={15}/>Season</span></AccordionTrigger><AccordionContent className="px-2">
        <div className="environment-choices" role="group" aria-label="Season">{(['spring','summer','autumn','winter'] as const).map(season => <Button key={season} variant={environment.season === season ? 'secondary' : 'outline'} size="sm" aria-pressed={environment.season === season} onClick={() => change({ season })}>{season[0].toUpperCase()+season.slice(1)}</Button>)}</div>
        <FieldMessage>Seasonal terrain and library foliage colors. Sun position stays independent.</FieldMessage>
      </AccordionContent></AccordionItem>
      <AccordionItem value="sun"><AccordionTrigger><span className="flex items-center gap-2"><Sun size={15}/>Sun position</span></AccordionTrigger><AccordionContent className="px-2">
        <svg viewBox="0 0 160 112" className="sun-compass" role="img" aria-label={`Sun direction ${environment.sunAzimuth} degrees clockwise from north`}>
          <circle cx="80" cy="56" r="34" fill="none" stroke="currentColor" opacity=".35"/><path d="M80 22V90 M46 56H114" stroke="currentColor" opacity=".2"/>
          <text x="80" y="14" textAnchor="middle">N</text><text x="80" y="107" textAnchor="middle">S</text><text x="128" y="60" textAnchor="middle">E</text><text x="32" y="60" textAnchor="middle">W</text>
          <g transform={`rotate(${environment.sunAzimuth} 80 56)`}><path d="M80 56V22" stroke="var(--color-accent)" strokeWidth="2"/><circle cx="80" cy="22" r="5" fill="var(--color-accent)"/></g><circle cx="80" cy="56" r="3" fill="currentColor"/>
        </svg>
        {([{key:'sunAzimuth',label:'Direction',max:360},{key:'sunElevation',label:'Height above horizon',max:90}] as const).map(({key,label,max}) => <Field key={key}>
          <Row justify="between"><span>{label}</span><output>{Math.round(environment[key])}°</output></Row>
          <input type="range" aria-label={label} aria-valuetext={`${Math.round(environment[key])} degrees`} min={0} max={max} step={1} value={environment[key]} onChange={event => change({ [key]: Number(event.target.value) }, true)} onPointerUp={finish} onPointerCancel={finish} onKeyUp={finish} onBlur={finish}/>
        </Field>)}
        <div className="environment-choices" role="group" aria-label="Sun presets">{[{name:'Morning',sunAzimuth:90,sunElevation:20},{name:'Noon',sunAzimuth:180,sunElevation:65},{name:'Evening',sunAzimuth:270,sunElevation:12}].map(({name,...preset}) => <Button key={name} variant="outline" size="sm" onClick={() => change(preset)}>{name}</Button>)}</div>
        <FieldMessage>0° north · 90° east · 180° south · 270° west. Artistic sun placement, independent of a geographic date.</FieldMessage>
      </AccordionContent></AccordionItem>
      <AccordionItem value="weather"><AccordionTrigger><span className="flex items-center gap-2"><CloudSun size={15}/>Weather</span></AccordionTrigger><AccordionContent className="px-2">
        <div className="environment-choices" role="group" aria-label="Weather">{(['clear','cloudy','rain','snow','fog'] as const).map(weather => <Button key={weather} variant={environment.weather === weather ? 'secondary' : 'outline'} size="sm" aria-pressed={environment.weather === weather} onClick={() => change({ weather })}>{weather[0].toUpperCase()+weather.slice(1)}</Button>)}</div>
        <FieldMessage>Cloud cover softens the light. Rain and snow follow the scene’s Play / Pause control.</FieldMessage>
      </AccordionContent></AccordionItem>
    </Accordion>
    <Button variant="ghost" size="sm" className="mt-2" onClick={() => change(DEFAULT_ENVIRONMENT)}><RotateCcw size={14}/>Reset environment</Button>
  </section>;
}
