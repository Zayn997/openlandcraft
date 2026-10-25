import { Box, Droplets, Focus, Layers, Leaf, MousePointer2, Plus, Route, Trash2, Waves } from 'lucide-react';
import type { Project, WallShape } from '@openlandcraft/core';
import {
  Button, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from './ui';

type Asset = Project['assets'][number];
type Props = {
  project: Project;
  busy: boolean;
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
  project, busy, onAddBlock, onAddBuilding, onDrawBuilding, onDrawArchitecture,
  onRegions, onWater, onDrawPath, onDrawCourtyard, onRepeat, onMirror, onHedge, onTower, onAddOcean, onPlaceAsset, onRemoveAsset,
}: Props) {
  const pathsFull = project.entities.filter(entity => entity.kind === 'path').length>=16;
  const regionsFull = project.entities.filter(entity => entity.kind === 'materialRegion'||entity.kind==='plantingRegion').length>=8;
  const hasOcean = project.entities.some(entity => entity.kind === 'ocean');
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" className="flex-1" aria-label="Add to scene"><Plus size={15} />Add…</Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent side="top" align="start" className="w-[264px]" aria-label="Add to scene">
      <DropdownMenuGroup>
        <DropdownMenuLabel>Architecture</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onDrawArchitecture('wall')}><MousePointer2 />Wall</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onDrawArchitecture('floor')}><Layers />Floor</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onDrawArchitecture('roof')}><Focus />Roof</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onDrawArchitecture('stairs')}><Layers />Stairs</DropdownMenuItem>
        <DropdownMenuItem disabled={busy} onSelect={onTower}><Box />Tower assembly</DropdownMenuItem>
        <DropdownMenuItem disabled={busy} onSelect={onRepeat}><Route />Repeat along line / arc</DropdownMenuItem>
        <DropdownMenuItem onSelect={onAddBlock}><Box />Add massing block</DropdownMenuItem>
        <DropdownMenuItem onSelect={onAddBuilding}><Layers />Add building</DropdownMenuItem>
        <DropdownMenuItem onSelect={onDrawBuilding}><Focus />Draw footprint</DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>Landscape</DropdownMenuLabel>
        <DropdownMenuItem onSelect={onRegions}><Leaf />Landscape regions</DropdownMenuItem>
        <DropdownMenuItem disabled={busy} onSelect={onMirror}><Focus />Mirror / symmetry</DropdownMenuItem>
        <DropdownMenuItem disabled={busy||project.entities.filter(e=>e.kind==='hedge').length>=32} onSelect={onHedge}><Leaf />Draw clipped hedge</DropdownMenuItem>
        <DropdownMenuItem onSelect={onWater}><Droplets />Water System</DropdownMenuItem>
        <DropdownMenuItem disabled={busy||pathsFull} onSelect={onDrawPath}><Route />Draw path</DropdownMenuItem>
        <DropdownMenuItem disabled={busy||regionsFull} onSelect={onDrawCourtyard}><Layers />Draw courtyard</DropdownMenuItem>
        <DropdownMenuItem disabled={hasOcean} onSelect={onAddOcean}><Waves />Add ocean</DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>Models</DropdownMenuLabel>
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
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}
