import { useEffect, useRef, useState } from 'react';
import { createPlacedInstance, DEFAULT_PLANT_BRUSH, isBirdAsset, isFishAsset, isGroundCharacterAsset, groundRoutes, fishSchools, fishHabitat, createSwimRoute, evaluateProject, layerDisplayProject, type Asset, type Editor } from '@openlandcraft/core';
import { validateModels } from '@openlandcraft/viewport';
import { loadLibraryPlant, type LibraryPlant } from './plant-library';
import { loadLibraryBird, type LibraryBird } from './bird-library';
import { loadLibraryFish, type LibraryFish } from './fish-library';
import { loadLibraryCharacter, type LibraryCharacter } from './character-library';
export type LibraryAsset = LibraryPlant | LibraryBird | LibraryFish | LibraryCharacter;

/** Shared library state; single placement commits here and brush strokes commit in the viewport. */
export function usePlantPlacement(editor: Editor, active: boolean, snapping: boolean, onError: (message: string) => void) {
  const [chosen, setChosen] = useState<LibraryAsset | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(false);
  const [grow, setGrow] = useState(true);
  const [wind, setWind] = useState(true);
  const [mode, setMode] = useState<'place' | 'paint'>('place');
  const [brush, setBrush] = useState(DEFAULT_PLANT_BRUSH);
  const [growth, setGrowth] = useState<ReadonlyMap<string, number>>(() => new Map());
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    if (!active) { generation.current++; request.current?.abort(); setChosen(null); setAsset(null); setLoading(false); }
  }, [active]);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!growth.size) return;
    const timer = window.setTimeout(() => setGrowth(current => new Map([...current].filter(([, time]) => performance.now() - time < 800))), 850);
    return () => window.clearTimeout(timer);
  }, [growth]);
  const choose = async (plant: LibraryAsset) => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const token = ++generation.current, destination = editor.getSnapshot().project;
    if (['Birds','Fish','Animals','People'].includes(plant.category)) setMode('place');
    setChosen(plant); setAsset(null); setLoading(true); onError('');
    try {
      const loaded = await (plant.category === 'Animals' || plant.category === 'People' ? loadLibraryCharacter(plant as LibraryCharacter,controller.signal) : plant.category === 'Fish' ? loadLibraryFish(plant as LibraryFish, controller.signal) : plant.category === 'Birds' ? loadLibraryBird(plant as LibraryBird, controller.signal) : loadLibraryPlant(plant as LibraryPlant, controller.signal));
      await validateModels([loaded]);
      if (controller.signal.aborted || token !== generation.current) return;
      if (editor.getSnapshot().project !== destination) throw new Error('The scene changed while loading. Choose the asset again.');
      setAsset(loaded);
    } catch (error) {
      if (!controller.signal.aborted && token === generation.current) {
        setChosen(null); onError(error instanceof Error ? error.message : 'The asset could not load.');
      }
    } finally { if (token === generation.current) setLoading(false); }
  };
  const place = (x: number, z: number) => {
    if (!active || !asset || mode === 'paint') return;
    try {
      editor.cancel();
      const project = editor.getSnapshot().project;
      // Deduplicate by content, without assuming an imported file kept its library ID.
      const existing = project.assets.find(source => source.data === asset.data);
      const source = existing ?? { ...asset, id: project.assets.some(source => source.id === asset.id) ? crypto.randomUUID() : asset.id };
      const entity = createPlacedInstance(project, source, x, z, snapping);
      const bird = isBirdAsset(source), fish = isFishAsset(source), character = isGroundCharacterAsset(source);
      if (bird) entity.position[1] = 10;
      if (character) {
        const displayed = layerDisplayProject(evaluateProject(project),editor.getSnapshot().isolatedLayerId);
        const candidate = {...project,entities:[...project.entities,entity],assets:existing ? project.assets : [...project.assets,source],
          objectLayers:{...project.objectLayers,[entity.id]:project.activeLayerId ?? 'default'}};
        const next = groundRoutes(layerDisplayProject(evaluateProject(candidate),editor.getSnapshot().isolatedLayerId));
        if (!next.has(entity.id) || [...groundRoutes(displayed).keys()].some(id => !next.has(id)))
          throw new Error('Choose dry, gently sloping ground with space away from buildings and other characters.');
      }
      if (fish) {
        const displayed = layerDisplayProject(evaluateProject(project), editor.getSnapshot().isolatedLayerId);
        const route = createSwimRoute(fishHabitat(displayed), [entity.position[0], 100, entity.position[2]]);
        if (!route) throw new Error('Choose deeper, open water with room for the fish to swim.');
        entity.anchor = 'fixed'; entity.position[1] = route.y;
        const candidate = { ...project, entities:[...project.entities,entity], assets:existing ? project.assets : [...project.assets,source],
          objectLayers:{...project.objectLayers,[entity.id]:project.activeLayerId ?? 'default'} };
        const nextSchools=fishSchools(layerDisplayProject(evaluateProject(candidate),editor.getSnapshot().isolatedLayerId));
        const currentSchools=fishSchools(displayed);
        if (!nextSchools.has(entity.id) || [...currentSchools.keys()].some(id => !nextSchools.has(id)))
          throw new Error('This school needs more open water. Place the fish farther from the shore or other schools.');
      }
      editor.execute({ type: 'insert', entities: [entity], assets: existing ? [] : [source] }, `Place ${asset.name}`);
      editor.select(entity.id);
      if (!bird && !fish && !character && grow && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setGrowth(current => new Map(current).set(entity.id, performance.now()));
      }
      onError('');
    } catch (error) { onError(error instanceof Error ? error.message : 'The asset could not be placed.'); }
  };
  const onAdded = (ids: string[]) => {
    if (grow && !matchMedia('(prefers-reduced-motion: reduce)').matches) setGrowth(current => {
      const next = new Map(current), now = performance.now();
      ids.forEach(id => next.set(id, now)); return next;
    });
  };
  return { chosen, asset, loading, grow, setGrow, wind, setWind, growth, choose, place, mode, setMode, brush, setBrush, onAdded };
}
