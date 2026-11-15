import { useState, type ReactNode } from 'react';
import { Box, BrickWall, Building2, Cuboid, FlipHorizontal2, Plus, Trash2 } from 'lucide-react';
import type { Project, WallShape } from '@openlandcraft/core';
import { BuildingFootprintIcon, FloorSlabIcon, PitchedRoofIcon, RepeatElementsIcon, StairsIcon, TowerIcon } from './ArchitectureIcons';
import { ClippedHedgeIcon, OceanWaveIcon, PavedCourtyardIcon, PlantedRegionIcon, PondWaterIcon, WindingPathIcon } from './LandscapeIcons';
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
  Button, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from './ui';

function CreationCategory({ value, title, expanded, children }: {
  value: string; title: string; expanded: boolean; children: ReactNode;
}) {
  return <AccordionItem value={value} className="py-1 first:pt-0 last:pb-0">
    <DropdownMenuItem asChild onSelect={event => event.preventDefault()}>
      <AccordionTrigger className="text-caption tracking-wide text-muted">{title}</AccordionTrigger>
    </DropdownMenuItem>
    <AccordionContent className="pb-0" inert={!expanded} aria-hidden={!expanded}>{children}</AccordionContent>
  </AccordionItem>;
}

type Asset = Project['assets'][number];
type Props = {
  project: Project;
  busy: boolean;
  canMirror: boolean;
  onAddBlock: () => void;
  onAddBuilding: () => void;
  onDrawBuilding: () => void;
  onDrawArchitecture: (kind: 'wall' | 'floor' | 'roof' | 'stairs', shape?:WallShape) => void;
  onRegions: () => void;
  onWater: () => void;
  onDrawPath: () => void;
  onDrawCourtyard: () => void;
  onRepeat: () => void;
  onMirror: () => void;
  onHedge: () => void;
  onTower: () => void;
  onAddOcean: () => void;
  onPlaceAsset: (asset: Asset) => void;
  onRemoveAsset: (id: string) => void;
};

/** Editor commands remain in App; this component only presents the creation menu. */
export function CreationMenu({
  project, busy, canMirror, onAddBlock, onAddBuilding, onDrawBuilding, onDrawArchitecture,
  onRegions, onWater, onDrawPath, onDrawCourtyard, onRepeat, onMirror, onHedge, onTower, onAddOcean, onPlaceAsset, onRemoveAsset,
}: Props) {
  const [expanded, setExpanded] = useState(['architecture', 'landscape', 'models']);
  const pathsFull = project.entities.filter(entity => entity.kind === 'path').length>=16;
  const regionsFull = project.entities.filter(entity => entity.kind === 'materialRegion'||entity.kind==='plantingRegion').length>=8;
  const hasOcean = project.entities.some(entity => entity.kind === 'ocean');
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" className="flex-1" aria-label="Add to scene"><Plus size={15} />Add…</Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent side="top" align="start" className="w-[264px]" aria-label="Add to scene">
      <Accordion type="multiple" value={expanded} onValueChange={setExpanded}>
      <CreationCategory value="architecture" title="Architecture" expanded={expanded.includes('architecture')}>
        <DropdownMenuItem onSelect={() => onDrawArchitecture('wall')}><BrickWall />Wall</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onDrawArchitecture('floor')}><FloorSlabIcon />Floor</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onDrawArchitecture('roof')}><PitchedRoofIcon />Roof</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onDrawArchitecture('stairs')}><StairsIcon />Stairs</DropdownMenuItem>
        <DropdownMenuItem disabled={busy} onSelect={onTower}><TowerIcon />Tower assembly</DropdownMenuItem>
        <DropdownMenuItem disabled={busy} onSelect={onRepeat}><RepeatElementsIcon />Repeat along line / arc</DropdownMenuItem>
        <DropdownMenuItem onSelect={onAddBlock}><Cuboid />Add massing block</DropdownMenuItem>
        <DropdownMenuItem onSelect={onAddBuilding}><Building2 />Add building</DropdownMenuItem>
        <DropdownMenuItem onSelect={onDrawBuilding}><BuildingFootprintIcon />Draw footprint</DropdownMenuItem>
      </CreationCategory>
      <CreationCategory value="landscape" title="Landscape" expanded={expanded.includes('landscape')}>
        <DropdownMenuItem onSelect={onRegions}><PlantedRegionIcon />Landscape regions</DropdownMenuItem>
        <DropdownMenuItem disabled={busy||!canMirror} title={canMirror?'Mirror the selected elements':'Select a static model, massing block, clipped hedge or repeat first'} onSelect={onMirror}><FlipHorizontal2 />Mirror / symmetry</DropdownMenuItem>
        <DropdownMenuItem disabled={busy||project.entities.filter(e=>e.kind==='hedge').length>=32} onSelect={onHedge}><ClippedHedgeIcon />Draw clipped hedge</DropdownMenuItem>
        <DropdownMenuItem onSelect={onWater}><PondWaterIcon />Water System</DropdownMenuItem>
        <DropdownMenuItem disabled={busy||pathsFull} onSelect={onDrawPath}><WindingPathIcon />Draw path</DropdownMenuItem>
        <DropdownMenuItem disabled={busy||regionsFull} onSelect={onDrawCourtyard}><PavedCourtyardIcon />Draw courtyard</DropdownMenuItem>
        <DropdownMenuItem disabled={hasOcean} onSelect={onAddOcean}><OceanWaveIcon />Add ocean</DropdownMenuItem>
      </CreationCategory>
      <CreationCategory value="models" title="Models" expanded={expanded.includes('models')}>
        {project.assets.map(asset => {
          const used = project.entities.some(entity =>
            (entity.kind === 'instance' || entity.kind === 'plantingRegion') && entity.assetId === asset.id);
          return <DropdownMenuSub key={asset.id}>
            <DropdownMenuSubTrigger><Box /><span className="min-w-0 truncate" title={asset.name}>{asset.name}</span></DropdownMenuSubTrigger>
            <DropdownMenuSubContent aria-label={asset.name}>
              <DropdownMenuItem disabled={busy} onSelect={() => onPlaceAsset(asset)} aria-label={`Place ${asset.name}`}><Plus />Place instance</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" disabled={used || busy} onSelect={() => onRemoveAsset(asset.id)}
                aria-label={`Remove source ${asset.name}`} title={used ? 'Delete its instances and planting regions before removing the source' : undefined}>
                <Trash2 />Remove source
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>;
        })}
      </CreationCategory>
      </Accordion>
    </DropdownMenuContent>
  </DropdownMenu>;
}
