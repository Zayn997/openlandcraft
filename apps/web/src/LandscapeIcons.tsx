import { createLucideIcon } from 'lucide-react';

// Landscape elements share the architectural icons' 24 px grid and Lucide strokes.
export const PlantedRegionIcon = createLucideIcon('planted-region', [
  ['path', { d: 'm7 12-4 3 9 6 9-6-4-3', key: 'plot' }],
  ['path', { d: 'M12 15v-4C7 11 7 5 7 5c5 0 5 6 5 6Z', key: 'stem-and-leaf' }],
  ['path', { d: 'M12 9c0-5 6-5 6-5s0 5-6 5Z', key: 'leaf' }],
]);

export const ClippedHedgeIcon = createLucideIcon('clipped-hedge', [
  ['path', { d: 'm3 8 4-4h14v11l-4 4H3Z', key: 'clipped-canopy' }],
  ['path', { d: 'M3 8h14l4-4M17 8v11', key: 'canopy-faces' }],
  ['path', { d: 'm7 12 2 2 2-2m-2 2v3', key: 'foliage' }],
]);

export const PondWaterIcon = createLucideIcon('pond-water', [
  ['path', { d: 'M5 6c3-4 6 0 10-1s7 3 6 7-3 8-8 8S3 19 3 14s0-5 2-8Z', key: 'shoreline' }],
  ['path', { d: 'M7 10q2-2 4 0t4 0m-7 5q2-2 4 0t4 0', key: 'ripples' }],
]);

export const WindingPathIcon = createLucideIcon('winding-path', [
  ['path', { d: 'M3 21v-3c0-6 10-6 10-12V3', key: 'left-edge' }],
  ['path', { d: 'M11 21v-3c0-6 10-6 10-12V3', key: 'right-edge' }],
]);

export const PavedCourtyardIcon = createLucideIcon('paved-courtyard', [
  ['rect', { x: 3, y: 3, width: 18, height: 18, rx: 1, key: 'boundary' }],
  ['rect', { x: 9, y: 9, width: 6, height: 6, key: 'open-center' }],
  ['path', { d: 'M9 3v6m6 6v6M3 15h6m6-6h6', key: 'paving-joints' }],
]);

export const OceanWaveIcon = createLucideIcon('ocean-wave', [
  ['path', { d: 'M2 17c3 0 3-12 11-12a5 5 0 0 1 5 5c-4-2-6 1-4 4s5 3 8 3', key: 'breaking-wave' }],
  ['path', { d: 'M2 21q2.5-2 5 0t5 0 5 0 5 0', key: 'surface' }],
]);
