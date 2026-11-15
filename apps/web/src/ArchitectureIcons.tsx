import { createLucideIcon } from 'lucide-react';

// Extend the editor's Lucide icon family with architectural element silhouettes.
export const FloorSlabIcon = createLucideIcon('floor-slab', [
  ['path', { d: 'm3 10 11-5 8 4-11 5Z', key: 'surface' }],
  ['path', { d: 'M3 10v5l8 4 11-5V9M11 14v5', key: 'thickness' }],
]);

export const PitchedRoofIcon = createLucideIcon('pitched-roof', [
  ['path', { d: 'm2 16 6-9 8-3 6 9-8 3Z', key: 'roof' }],
  ['path', { d: 'm8 7 6 9', key: 'gable' }],
]);

export const StairsIcon = createLucideIcon('stairs', [
  ['path', { d: 'M3 20v-5h5v-5h5V5h8v15Z', key: 'steps' }],
]);

export const TowerIcon = createLucideIcon('tower', [
  ['path', { d: 'M6 21V10H4V3h4v3h2V3h4v3h2V3h4v7h-2v11Z', key: 'tower' }],
  ['path', { d: 'M10 21v-5a2 2 0 0 1 4 0v5', key: 'entrance' }],
]);

export const RepeatElementsIcon = createLucideIcon('repeat-elements', [
  ['rect', { x: 3, y: 4, width: 4, height: 6, rx: 0.5, key: 'first' }],
  ['rect', { x: 10, y: 4, width: 4, height: 6, rx: 0.5, key: 'second' }],
  ['rect', { x: 17, y: 4, width: 4, height: 6, rx: 0.5, key: 'third' }],
  ['path', { d: 'M3 19q9-8 18 0', strokeDasharray: '2 3', key: 'guide' }],
]);

export const BuildingFootprintIcon = createLucideIcon('building-footprint', [
  ['path', { d: 'M4 4h16v7h-7v9H4Z', key: 'outline' }],
  ['circle', { cx: 4, cy: 4, r: 1.5, fill: 'currentColor', stroke: 'none', key: 'corner-start' }],
  ['circle', { cx: 20, cy: 11, r: 1.5, fill: 'currentColor', stroke: 'none', key: 'corner-end' }],
  ['circle', { cx: 13, cy: 20, r: 1.5, fill: 'currentColor', stroke: 'none', key: 'corner-bottom' }],
]);
