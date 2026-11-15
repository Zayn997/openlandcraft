import { useEffect, useRef, useState } from 'react';
import { Footprints, LoaderCircle, X } from 'lucide-react';
import type { WalkCharacter, WalkExperienceConfig, WalkExperienceStatus } from '@openlandcraft/viewport';
import { CHARACTERS, loadLibraryCharacter } from './character-library';
import { Button, FieldMessage, Row } from './ui';

const choices = [
  { id: 'boy', name: 'Boy', model: CHARACTERS[1] },
  { id: 'girl', name: 'Girl', model: CHARACTERS[2] },
] as const;

export function ExperienceSetup({ onEnter, onClose }: { onEnter: (config: WalkExperienceConfig) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), controller = useRef(new AbortController());
  const [character, setCharacter] = useState<WalkCharacter>('boy'), [loading, setLoading] = useState(false), [error, setError] = useState('');
  useEffect(() => { const abort = new AbortController(); controller.current = abort; dialog.current?.showModal(); return () => abort.abort(); }, []);
  const enter = async () => {
    setLoading(true); setError('');
    try {
      const asset = await loadLibraryCharacter(choices.find(choice => choice.id === character)!.model, controller.current.signal);
      if (!controller.current.signal.aborted) onEnter({ character, asset, firstPerson: false });
    } catch (error) { if (!controller.current.signal.aborted) { setError(error instanceof Error ? error.message : 'Character could not load.'); setLoading(false); } }
  };
  return <dialog ref={dialog} aria-labelledby="experience-title" className="experience-dialog" onCancel={event => { event.preventDefault(); onClose(); }}>
    <Row justify="between"><Footprints size={20} className="text-accent"/><Button variant="ghost" size="icon" aria-label="Close Explore setup" onClick={onClose}><X size={16}/></Button></Row>
    <h2 id="experience-title" className="mt-2 mb-2 text-title font-semibold">Step into your scene</h2>
    <p className="mt-0 mb-4 text-ui text-muted">Choose a character and explore at human scale.</p>
    <div className="grid grid-cols-2 gap-3" role="group" aria-label="Choose your character">
      {choices.map(choice => <Button key={choice.id} variant="outline" disabled={loading} aria-label={`Choose ${choice.name}`} aria-pressed={character===choice.id} onClick={() => setCharacter(choice.id)}
        className={`min-w-0 flex-col gap-2 p-3 h-auto ${character===choice.id?'border-accent bg-selected text-accent':'text-ink'}`}>
        <img src={choice.model.thumbnail} alt="" width={128} height={128} className="size-28 object-contain"/><span>{choice.name}</span><span className="text-caption text-muted">{choice.model.height} m tall</span>
      </Button>)}
    </div>
    <p className="my-4 text-ui leading-relaxed text-muted">WASD or arrow keys to move · Space to jump · Drag to look · Shift to move faster. Swim automatically in deep water; stop to tread water. Escape returns to editing.</p>
    {error&&<FieldMessage tone="error" role="alert">{error}</FieldMessage>}
    <Button className="w-full" disabled={loading} onClick={() => void enter()}>{loading?<><LoaderCircle size={15} className="animate-spin motion-reduce:animate-none"/>Loading character…</>:<><Footprints size={15}/>Enter scene</>}</Button>
  </dialog>;
}

export function ExperienceToolbar({ config, status, onChange, onExit }: { config: WalkExperienceConfig; status: WalkExperienceStatus; onChange: (config: WalkExperienceConfig) => void; onExit: () => void }) {
  const controller = useRef<AbortController | null>(null);
  const current = useRef(config); current.current = config;
  const [loading, setLoading] = useState<WalkCharacter | null>(null), [error, setError] = useState('');
  useEffect(() => () => controller.current?.abort(), []);
  const choose = async (character: WalkCharacter) => {
    if (character === config.character || loading) return;
    controller.current = new AbortController(); setLoading(character); setError('');
    const signal = controller.current.signal;
    try {
      const asset = await loadLibraryCharacter(choices.find(choice => choice.id === character)!.model, signal);
      if (!signal.aborted) { onChange({ ...current.current, character, asset }); setLoading(null); }
    } catch (error) { if (!signal.aborted) { setError(error instanceof Error ? error.message : 'Character could not load.'); setLoading(null); } }
  };
  return <div className="experience-toolbar" aria-label="Explore controls">
    <Row wrap className="gap-2 px-3 py-2">
      <Footprints size={16} className="text-accent"/><strong className="text-ui">Explore</strong>
      <Row gap="xs" role="group" aria-label="Explorer character">{choices.map(choice=><Button key={choice.id} variant={config.character===choice.id?'secondary':'ghost'} size="sm" aria-pressed={config.character===choice.id} disabled={!!loading} onClick={()=>void choose(choice.id)}>{loading===choice.id?<LoaderCircle size={14} className="animate-spin motion-reduce:animate-none"/>:null}{choice.name}</Button>)}</Row>
      <Row gap="xs" role="group" aria-label="Explorer camera"><Button variant={!config.firstPerson?'secondary':'ghost'} size="sm" aria-pressed={!config.firstPerson} onClick={()=>onChange({...config,firstPerson:false})}>Follow</Button><Button variant={config.firstPerson?'secondary':'ghost'} size="sm" aria-pressed={config.firstPerson} onClick={()=>onChange({...config,firstPerson:true})}>First person</Button></Row>
      <span role="status" className="text-caption text-muted ml-auto">{status.motion==='swim'?(status.moving?'Swimming':'Treading water'):status.motion==='air'?'Jumping':status.moving?'Walking':'Standing'} · X {status.x.toFixed(1)} · Z {status.z.toFixed(1)}</span>
      <Button variant="outline" size="sm" onClick={onExit}><X size={14}/>Back to editor</Button>
    </Row>
    {(error||status.error)&&<p className="mx-3 mt-0 mb-2 text-ui text-danger" role="alert">{error||status.error}</p>}
  </div>;
}
