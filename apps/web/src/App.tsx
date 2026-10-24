import {joineryDraft,joineryValue} from './OpeningJoineryFields';
import {useRepeatTool,RepeatSelection} from './RepeatTools';
import {repeatSources} from '@openlandcraft/core';
import {ArchitecturalMaterialFields} from './ArchitecturalMaterialFields';
import { upgradeLibraryFish } from './fish-upgrade';
import { isBirdAsset, isFishAsset, isGroundCharacterAsset } from '@openlandcraft/core';
import { DuplicateAbovePanel } from './DuplicateAbovePanel';
import {measured,type AppDiagnostics} from './app-diagnostics';
import {createViewportMetricsSource,RendererInfo} from './viewport-metrics';
import { ProjectName } from './ProjectName';
import { ViewportToolbar, type CameraView } from './ViewportToolbar';
import type {CameraProjection} from '@openlandcraft/viewport';
import { ViewportStatusBar } from './ViewportStatusBar';
import { PathDrawingPanel } from './PathDrawingPanel';
import { CreationMenu } from './CreationMenu';
import { ArchitectureTools, type ArchitectureTool } from './ArchitectureTools';
import {createStairs,DEFAULT_STAIRS,DEFAULT_SPIRAL,createSpiralStairs,spiralStairsForTower,spiralTowerDimensions,type StairShape,type StairDrawingDimensions} from '@openlandcraft/core';
import { resolveDrawingLevel } from './drawing-level';
import { useEditorEscape } from './use-editor-escape';
import { createDrawnSurface, drawingPoint } from '@openlandcraft/core';
import {conicalRoofForTower,createConicalRoof,isCircularWall,snapRoofDrawingPoint,type RoofShape} from '@openlandcraft/core';
import { Button, ActionBar, ActionRow, CheckboxInput, ColorInput, Field, FieldGrid, FieldMessage, Input, NumberField, PanelBody, PanelForm, PanelHeading, PropertyRow, RangeInput, Row, TextInput } from './ui';
import { InspectorSection } from './InspectorSection';
import { InspectorPanel } from './InspectorPanel';
import { canEditObject, objectLayer } from '@openlandcraft/core';
import { LayersPanel } from './LayersPanel';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import { AssetsPanel } from './AssetsPanel';
import { AboutCredits } from './AboutCredits';
import { usePlantPlacement } from './use-plant-placement';
import {useStairAttachment} from './StairAttachment';
import {OutlineEditor} from './OutlineEditor';
import type {OutlineHandle} from '../../../packages/viewport/src/outline-edit';
import {WallEditor} from './WallEditor';
import {OpeningSelectionSummary} from './OpeningSelection';
import {OpeningEditor} from './OpeningEditor';
import {openingAtPoint, type OpeningSettings, type WallHit, type Level} from '@openlandcraft/core';
import {OpeningTools, type OpeningDimensions} from './OpeningTools';
import {connectCurvedWall,snapCurveDrawingPoint,createCurvedWall,createWallChain,snapWallPoint,type PlanPoint,type Wall,type WallShape} from '@openlandcraft/core';
import {applyCommand, duplicateAbove, floorHeight, isBuildingPart, ownerLevel, selectionDelete, copySelection, pasteSelection, type EditorClipboard} from '@openlandcraft/core';
import {FloorTools,ArchitectureGroupInspector} from './FloorTools';
import {
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUp,
  ArrowDown,
  Box,
  DoorOpen,
  PanelsTopLeft,
  Check,
  Copy,
  Equal,
  Focus,
  Grid2X2,
  Layers,
  Leaf,
  Mountain,
  MousePointer2,
  Plus,
  Redo2,
  RotateCcw,
  Route,
  Droplets,
  Save,
  Settings2,
  Sparkles,
  Trash2,
  Undo2,
  Waves,
  X,
} from "lucide-react";
import {
  Editor,
  createProject,
  createBuilding,
  createRiver,
  createDrawnPath,
  createCharacterRoute,
  characterWalkingPath,
  createLake,
  createRegion,
  isRegion,
  snapPathPoint,
  createOcean,
  encodeGlb,
  evaluateProject,
  layerDisplayProject,
  groundHeight,
  parseProject,
  snap,
  MAX_GLB_BYTES,
  type Asset,
  type Instance,
  type Block,
  type Entity,
  type Ocean,
  type Path,
} from "@openlandcraft/core";
import {
  deserializeProject,
  loadLocal,
  saveLocal,
  serializeProject,
  MAX_PROJECT_BYTES,
} from "@openlandcraft/project";
import {
  Viewport,
  underwaterCamera,
  inlandWaterCamera,
  validateModels,
  type TransformMode,
  type ViewportMetrics,
} from "@openlandcraft/viewport";
import {
  DEFAULT_BRUSH,
  MAX_HEIGHT,
  MIN_HEIGHT,
  TerrainStroke,
  type BrushSettings,
  type RiverPoint,
  type PathPoint,
  pathLength,
  walkingRouteIssue,
  segmentDistance,
} from "@openlandcraft/landscape";
import { WaterSystem, type InlandWaterType } from "./WaterSystem";
import {RegionTools,RegionInspector,type RegionTool} from "./RegionInspector";
import { LakeInspector } from "./LakeInspector";
import { PathInspector } from "./PathInspector";
import { RiverInspector } from "./RiverInspector";
import { SceneObjects } from "./SceneObjects";
import { Dialog, ProjectDialog } from "./ProjectDialog";
import { CoastFields } from "./CoastFields";
import { TerrainMaterialFields, WaterMaterialFields } from "./MaterialFields";

function IconButton({
  label,
  children,
  active,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      {...props}
      type="button"
      aria-label={label}
      title={label}
      className={`icon-button ${active ? "active" : ""} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

import {RouteCornerEditor} from './RouteCornerEditor';
import {RouteCornerFields} from './RouteCornerFields';
import { ConstructionInspector } from "./ConstructionInspector";

export function App({diagnostics}:{diagnostics?:AppDiagnostics}={}) {
  const [editor] = useState(() => new Editor(createProject()));
  const state = useSyncExternalStore(editor.subscribe, editor.getSnapshot);
  const project = state.preview ?? state.project;
  const stairAttachment=useStairAttachment(editor);
  const canDive=useMemo(()=>{
    const displayed=layerDisplayProject(evaluateProject(project),state.isolatedLayerId);
    const lakes=displayed.entities.filter(entity=>entity.kind==='lake');
    return displayed.entities.some(entity=>entity.kind==='ocean'&&underwaterCamera(displayed.site,entity,lakes));
  },[project,state.isolatedLayerId]);
  const inlandDives=useMemo(()=>{
    const displayed=layerDisplayProject(evaluateProject(project),state.isolatedLayerId);
    return Object.fromEntries(displayed.entities.filter(e=>e.kind==='river'||e.kind==='lake').map(water=>[water.kind,!!inlandWaterCamera(displayed.site,water)]));
  },[project,state.isolatedLayerId]);
  useEffect(() => {
    document.title = `OpenLandcraft — ${state.project.name}`;
  }, [state.project.name]);
  const selected = project.entities.find(
    (entity) => entity.id === state.selectedId,
  );
  const [selectedParts,setSelectedParts]=useState<string[]>([]);
  const clipboard = useRef<{ data: EditorClipboard; pastes: number; token: string } | null>(null);
  const [isolateFloor,setIsolateFloor]=useState(false);
  const [copyDraft,setCopyDraft]=useState<{sourceId:string;height:number;prefix:string}|null>(null);
  const [copySpacing,setCopySpacing]=useState<number|null>(null);
  const copyAnchor=useRef<HTMLDivElement>(null);
  const selectedLevel=ownerLevel(project,state.selectedId);
  const copyHeight=copySpacing??copyDraft?.height??(selectedLevel?floorHeight(project,selectedLevel):3.4);
  const copyResult=useMemo(()=>{
    if(!copyDraft||copyDraft.sourceId!==state.selectedId||state.gestureLabel)return {plan:null,error:''};
    try{const plan=duplicateAbove(state.project,copyDraft.sourceId,copyDraft.height,copyDraft.prefix);applyCommand(state.project,{type:'duplicateAbove',...copyDraft});return {plan,error:''};}
    catch(error){return {plan:null,error:error instanceof Error?error.message:'The copy cannot be placed.'};}
  },[copyDraft,state.project,state.selectedId,state.gestureLabel]);
  useEffect(()=>{setCopySpacing(null);setCopyDraft(d=>d?.sourceId===state.selectedId?d:null);setSelectedParts(ids=>ids.filter(id=>(id==='terrain'||state.project.entities.some(e=>e.id===id))&&canEditObject(state.project,id,state.isolatedLayerId)));},[state.selectedId,state.revision,state.isolatedLayerId]);
  const hasWater = project.entities.some(
    (entity) =>
      entity.visible && (entity.kind === "ocean" || entity.kind === "river" || entity.kind === "lake"),
  );
  const [grid, setGrid] = useState(true);
  const [playing, setPlaying] = useState(
    () => !matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [quality, setQuality] = useState<"low" | "high">("high");
  const [waterPreview, setWaterPreview] = useState({ reset: 0, step: 0, riverReset:0, riverStep:0, lakeReset:0, lakeStep:0 });
  const [view, setView] = useState<CameraView>(
    "perspective",
  );
  const [projection,setProjection]=useState<CameraProjection>('perspective');
  const activeProjection=view==='shore'||view.endsWith('underwater')?'perspective':projection;
  const [frameToken, setFrameToken] = useState(0);
  const [frameCancelToken, setFrameCancelToken] = useState(0);
  const [openingDimensions,setOpeningDimensions]=useState<Record<'door'|'window',OpeningDimensions>>({door:{width:'0.9',height:'2.1',sill:'0',shape:'rectangle',archRise:'.45',joinery:joineryDraft('door')},window:{width:'1.4',height:'1.2',sill:'0.9',shape:'rectangle',archRise:'.6',joinery:joineryDraft('window')}});
  const [openingFocus,setOpeningFocus]=useState<{wallId:string;openingId:string}|null>(null);
  const [openingStatus,setOpeningStatus]=useState('Point at a wall to preview an opening.');
  const [metricsSource]=useState(createViewportMetricsSource);
  const reportMetrics=useCallback((value:ViewportMetrics)=>{metricsSource.publish(value);diagnostics?.metrics(value);},[diagnostics,metricsSource]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("Opening local project…");
  const [storageReady, setStorageReady] = useState(false);
  const [opening, setOpening] = useState(true);
  const [hydrating,setHydrating]=useState(true);
  const [panel, setPanel] = useState<"scene" | "inspector">("scene");
  const [showHelp, setShowHelp] = useState(false);
  const [projectDialog, setProjectDialog] = useState<"new" | "rename" | null>(
    null,
  );
  const [storageRecovery, setStorageRecovery] = useState(false);
  const [inspectorEpoch, setInspectorEpoch] = useState(0);
  const [tool, setTool] = useState<"select" | "repeat" | "terrain" | "plant" | "building" | "wall" | "floor" | "roof" | "stairs" | "door" | "window" | "opening-edit" | "wall-edit" | "outline-edit" | "river" | "path" | "lake" | "region">(
    "select",
  );
  const [regionsOpen,setRegionsOpen]=useState(false);
  const [regionType,setRegionType]=useState<RegionTool>("material");
  const [regionDraft,setRegionDraft]=useState<PathPoint[]>([]);
  const [waterOpen,setWaterOpen]=useState(false);
  const [waterType,setWaterType]=useState<InlandWaterType>("river");
  const [lakeDraft,setLakeDraft]=useState<PathPoint[]>([]);
  const [pathDraft, setPathDraft] = useState<PathPoint[]>([]);
  const [pathDraftRounding,setPathDraftRounding]=useState<number[]>([]);
  const [pathCornerIndex,setPathCornerIndex]=useState<number|null>(null);
  const [routeCornerIndex,setRouteCornerIndex]=useState<number|null>(null);

  const [pathRedrawId,setPathRedrawId] = useState<string | null>(null);
  const [pathReturnId,setPathReturnId] = useState<string | null>(null);
  const [pathDrawWidth,setPathDrawWidth] = useState(3);
  const [pathDrawSurface,setPathDrawSurface] = useState<Path['surface']>('gravel');
  const pathDrawingError = pathDraft.length > 1 ? walkingRouteIssue({points:pathDraft,width:pathDrawWidth,cornerRounding:pathDraftRounding},project.site) : null;
  const [riverDraft, setRiverDraft] = useState<RiverPoint[]>([]);
  const [transformMode, setTransformMode] =
    useState<TransformMode>("translate");
  const [snapping, setSnapping] = useState(true);
  const repeat=useRepeatTool(editor,snapping,setSnapping,()=>chooseTool('select'),setError);
  const plants = usePlantPlacement(editor, tool === 'plant', snapping, setError);
  const [wallDraft,setWallDraft]=useState<PlanPoint[]>([]);
  const [wallShape,setWallShape]=useState<WallShape>('straight');
  const [wallHeight,setWallHeight]=useState(3.2);
  const [wallClockwise,setWallClockwise]=useState(false);
  const [roofShape,setRoofShape]=useState<RoofShape>('flat'),[roofHeight,setRoofHeight]=useState(4),[roofOverhang,setRoofOverhang]=useState(.5),[roofTowerId,setRoofTowerId]=useState('draw');
  const [stairDimensions,setStairDimensions]=useState<StairDrawingDimensions>({...DEFAULT_STAIRS,...DEFAULT_SPIRAL});
  const [stairShape,setStairShape]=useState<StairShape>('straight'),[stairTowerId,setStairTowerId]=useState('draw');
  const [drawingLevelId,setDrawingLevelId]=useState<string | null>(null);
  const [surfaceOffset,setSurfaceOffset]=useState(0);
  const [surfaceThickness,setSurfaceThickness]=useState(0.2);
  const drawingArchitecture=tool==='wall'||tool==='floor'||tool==='roof'||tool==='stairs';
  const [buildingCorner, setBuildingCorner] = useState<[number, number] | null>(
    null,
  );
  const [importingModel, setImportingModel] = useState(false);
  const modelInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selected?.kind !== "instance" && transformMode === "scale")
      setTransformMode("translate");
  }, [selected?.kind, transformMode]);
  const [brush, setBrush] = useState<BrushSettings>(DEFAULT_BRUSH);
  const [strokeTime, setStrokeTime] = useState(0);
  const reportStroke=useCallback((value:number)=>{setStrokeTime(value);diagnostics?.stroke(value);},[diagnostics]);
  const [stampPosition, setStampPosition] = useState<[number, number]>([-8, 8]);
  const fileInput = useRef<HTMLInputElement>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    let alive = true;
    measured(diagnostics,'local-read-parse',loadLocal)
      .then(async (saved) => {
        if (!alive) return;
        if (saved) { saved = await measured(diagnostics,'local-upgrade',()=>upgradeLibraryFish(saved!)); await measured(diagnostics,'local-model-validation',()=>validateModels(saved!.assets)); }
        if (!alive) return;
        if (saved) {
          editor.load(saved);
          editor.select(
            saved.entities.find((entity) => entity.kind === "block")?.id ??
              null,
          );
        }
        setStorageReady(true);
        setOpening(false);
        setHydrating(false);
        diagnostics?.event('local-ready',{entities:saved?.entities.length??0,assets:saved?.assets.length??0});
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setError(
          error instanceof Error
            ? error.message
            : "Local storage is unavailable. Export a copy to save your work.",
        );
        setSaveStatus("Local storage unavailable");
        setStorageRecovery(true);
        setOpening(false);
        setHydrating(false);
      });
    return () => {
      alive = false;
    };
  }, [editor]);

  const queueSave = useCallback(
    (manual = false) => {
      const committed = editor.getSnapshot().project;
      setSaveStatus("Saving…");
      saveQueue.current = saveQueue.current
        .catch(() => undefined)
        .then(() => measured(diagnostics,'local-save',()=>saveLocal(committed)))
        .then(() => {
          if (editor.getSnapshot().project === committed)
            setSaveStatus("Saved locally");
          setStorageReady(true);
          setStorageRecovery(false);
          if (manual)
            setNotice(
              "Project saved to this browser. Export a file for a portable copy.",
            );
        })
        .catch((error: unknown) => {
          setSaveStatus("Save failed");
          setError(
            error instanceof Error
              ? error.message
              : "Local save failed. Export a project file.",
          );
        });
    },
    [editor],
  );

  useEffect(() => {
    if (!storageReady || state.gestureLabel) return;
    setSaveStatus("Unsaved changes");
    const timer = setTimeout(() => queueSave(), 450);
    return () => clearTimeout(timer);
  }, [state.revision, state.gestureLabel, storageReady, queueSave]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const guard = useCallback((run: () => void) => {
    try {
      run();
      setError("");
      return true;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The edit could not be applied.",
      );
      return false;
    }
  }, []);
  const select = useCallback(
    (id: string | null, additive = false) => {
      setRouteCornerIndex(null);
      const before=editor.getSnapshot();
      if(id&&!canEditObject(before.project,id,before.isolatedLayerId))return;
      const entity=before.project.entities.find(e=>e.id===id);
      setCopyDraft(null);setOpeningFocus(null);
      if(additive&&entity&&isBuildingPart(entity)){
        const previous=before.project.entities.find(e=>e.id===before.selectedId);
        setSelectedParts(ids=>{const base=ids.length?ids:previous&&isBuildingPart(previous)?[previous.id]:[];return base.includes(entity.id)?base.filter(x=>x!==entity.id):[...base,entity.id];});
      }else setSelectedParts([]);
      editor.select(id);
      const water=editor.getSnapshot().project.entities.find(e=>e.id===id);
      setRegionsOpen(!!water&&isRegion(water));
      if(water&&isRegion(water))setRegionType(water.kind==="materialRegion"?"material":"planting");
      setWaterOpen(water?.kind==="river"||water?.kind==="lake");
      if(water?.kind==="river"||water?.kind==="lake")setWaterType(water.kind);
      if (id === "terrain")
        setView((current) => (current === "shore" || current.endsWith("underwater") ? "perspective" : current));
      setRiverDraft([]);
      setPathDraft([]); setPathRedrawId(null); setPathReturnId(null); setPathDraftRounding([]); setPathCornerIndex(null);
      setLakeDraft([]);
      setRegionDraft([]);setWallDraft([]);
      setBuildingCorner(null);
      setTool(id === "terrain" ? "terrain" : "select");
      setInspectorEpoch((value) => value + 1);
      if (id) setPanel("inspector");
    },
    [editor],
  );
  const cancelPreview = useCallback(() => {
    if (tool === 'path' && pathReturnId) editor.select(pathReturnId);
    setFrameCancelToken(value => value + 1);
    setCopyDraft(null);
    stairAttachment.cancel();
    setOpeningFocus(null);
    setTool('select');
    repeat.reset();
    setDrawingLevelId(null);
    editor.cancel();
    setRiverDraft([]);
      setPathDraft([]); setPathRedrawId(null); setPathReturnId(null); setPathDraftRounding([]); setPathCornerIndex(null);
      setLakeDraft([]);
      setRegionDraft([]);setWallDraft([]);
    setBuildingCorner(null);
    setInspectorEpoch((value) => value + 1);
  }, [editor,tool,pathReturnId]);
  useEditorEscape(useCallback(() => {
    if(stairAttachment.draft){stairAttachment.cancel();return;}
    if(routeCornerIndex!==null||pathCornerIndex!==null){editor.cancel();setRouteCornerIndex(null);setPathCornerIndex(null);return;}
    cancelPreview();
    setShowHelp(false);
    setProjectDialog(null);
    setNotice('');
  }, [cancelPreview,editor,routeCornerIndex,pathCornerIndex,stairAttachment.draft]), !opening && !importingModel);
  const frame = useCallback(() => setFrameToken((value) => value + 1), []);
  const placingOpening=tool==='door'||tool==='window';
  const editingOpening=tool==='opening-edit';
  const editingWall=tool==='wall-edit';
  const editingOutline=tool==='outline-edit';
  const outlineTarget=(selected?.kind==='slab'||selected?.kind==='roof')&&selected.visible?selected:undefined;
  const [outlineHandle,setOutlineHandle]=useState<OutlineHandle>({mode:'vertex',index:0});
  const [outlineStatus,setOutlineStatus]=useState('Drag the object or use its handles; edit precise dimensions in Properties.');
  const pickOutline=(id:string,doubleClick:boolean)=>{select(id);if(doubleClick){setOutlineHandle({mode:'vertex',index:0});setTool('outline-edit');setOutlineStatus(project.entities.some(e=>e.id===id&&e.kind==='roof'&&e.cone)?'Edit roof dimensions below or use the available handles.':'Drag the object or use its handles; edit precise dimensions in Properties.');}};
  const finishOutlineEdit=()=>{editor.cancel();setTool('select');};
  const wallTarget=selected?.kind==='wall'&&selected.visible?selected:undefined;
  const [wallStatus,setWallStatus]=useState('Drag the wall body or its Start / End handles.');
  const pickWall=(id:string,doubleClick:boolean)=>{select(id);if(doubleClick){setTool('wall-edit');setWallStatus(project.entities.some(e=>e.id===id&&e.kind==='wall'&&e.curve)?'Drag Center to move or Radius to resize. Use Properties for precise dimensions.':'Drag the wall body or its Start / End handles.');}};
  const finishWallEdit=()=>{editor.cancel();setTool('select');};
  const focusOpening=(focus:{wallId:string;openingId:string})=>{
    if(!canEditObject(project,focus.wallId,state.isolatedLayerId))return;
    editor.select(focus.wallId);setOpeningFocus(focus);
    if(openingFocus?.wallId!==focus.wallId||openingFocus?.openingId!==focus.openingId)setTool('select');
    setOpeningStatus('Drag the tinted opening to move; use the square handles to resize.');
  };
  const pickOpening=(focus:{wallId:string;openingId:string},doubleClick=false)=>{
    if(!canEditObject(project,focus.wallId,state.isolatedLayerId))return;
    const edit=doubleClick;
    editor.select(focus.wallId);setOpeningFocus(focus);setSelectedParts([]);setCopyDraft(null);setPanel('inspector');
    setTool(edit?'opening-edit':'select');
    setOpeningStatus(edit?'Drag the tinted opening to move; use the square handles to resize.':'Opening selected. Double-click to edit.');
  };
  const finishOpeningEdit=()=>{editor.cancel();setTool('select');};
  const placementFloors=project.entities.filter((e):e is Level=>e.kind==='level'&&e.visible&&canEditObject(project,e.id,state.isolatedLayerId)&&!project.entities.some(b=>b.kind==='building'&&b.id===e.buildingId&&!b.visible));
  const placementLevel=placementFloors.find(e=>e.id===selectedLevel?.id)??placementFloors[0];
  const drawingLevel=placementFloors.find(e=>e.id===drawingLevelId);
  const roofTowers=project.entities.filter((e):e is Wall=>e.kind==='wall'&&e.visible&&e.parentId===drawingLevel?.id&&isCircularWall(e));
  const roofTower=roofTowers.find(w=>w.id===roofTowerId);
  const stairTower=roofTowers.find(w=>w.id===stairTowerId);
  const openingHost=project.entities.find((e):e is Wall=>e.kind==='wall'&&e.visible&&canEditObject(project,e.id,state.isolatedLayerId)&&e.id===openingFocus?.wallId&&e.parentId===placementLevel?.id&&!project.entities.some(unit=>unit.kind==='unit'&&!unit.visible&&unit.memberIds.includes(e.id)));
  const focusedOpening=openingHost?.openings?.find(o=>o.id===openingFocus?.openingId);
  const openingSettings:OpeningSettings={kind:tool==='door'?'door':'window',width:NaN,height:NaN,sill:NaN,snapping};
  const dimensions=openingDimensions[openingSettings.kind];
  openingSettings.joinery=joineryValue(openingSettings.kind,dimensions.joinery);
  if(dimensions.shape==='arch'){openingSettings.shape='arch';openingSettings.archRise=dimensions.archRise.trim()===''?NaN:Number(dimensions.archRise);}
  for(const key of ['width','height','sill'] as const)openingSettings[key]=dimensions[key].trim()===''?NaN:Number(dimensions[key]);
  const placeOpening=(wallId:string,point:WallHit)=>{
    let placed=false;
    guard(()=>{
      const committed=editor.getSnapshot().project;
      const wall=committed.entities.find((e):e is Wall=>e.kind==='wall'&&e.id===wallId);
      const level=committed.entities.find((e):e is Level=>e.kind==='level'&&e.id===placementLevel?.id);
      if(!placingOpening||!wall||!level)return;
      const result=openingAtPoint(wall,level,point,openingSettings,crypto.randomUUID(),committed.entities.filter((e):e is Wall=>e.kind==='wall'));
      if(result.issue||!result.opening){setOpeningStatus(result.issue??'Choose a wall.');return;}
      editor.execute({type:'replace',entity:{...wall,openings:[...(wall.openings??[]),result.opening]}},'Place '+openingSettings.kind);
      editor.select(wall.id);
      placed=true;
      setOpeningStatus('Placed '+openingSettings.kind+' on '+wall.name+'. Point at another position to repeat.');
    });
    return placed;
  };
  const chooseTool = (next: typeof tool) => {
    if(drawingArchitecture&&wallDraft.length)setNotice('Unfinished drawing discarded. No geometry was added.');
    stairAttachment.cancel();
    setCopyDraft(null);setSelectedParts([]);setOpeningFocus(null);
    editor.cancel();
    if (next !== "select" && (view === "shore" || view.endsWith("underwater"))) setView("perspective");
    setTool(next);
    if(next!=='repeat')repeat.reset();
    if(next==='opening-edit'){setOpeningStatus('Click a tinted door or window opening to edit it.');if(placementLevel)editor.select(placementLevel.id);setPanel('inspector');}
    if(next==='door'||next==='window'){setOpeningStatus('Point at a wall to place a '+next+'.');if(placementLevel)editor.select(placementLevel.id);setPanel('inspector');}
    setBuildingCorner(null);
    setRiverDraft([]);
      setPathDraft([]); setPathRedrawId(null); setPathReturnId(null); setPathDraftRounding([]); setPathCornerIndex(null);
      setLakeDraft([]);
      setRegionDraft([]);setWallDraft([]);
    if (next === "terrain") {
      editor.select("terrain");
      setPanel("inspector");
    }
  };
  const startArchitecture = (kind: ArchitectureTool, levelId?: string, shape:WallShape='straight') => {
    const level = resolveDrawingLevel(project, state.selectedId, placementFloors, levelId);
    chooseTool(kind);
    setDrawingLevelId(level?.id ?? null);
    if (level) { editor.select(level.id); frame(); }
    setWallShape(shape);setWallHeight(3.2);setWallClockwise(false);
    setRoofShape('flat');setRoofHeight(4);setRoofOverhang(.5);setRoofTowerId(selected?.kind==='wall'&&isCircularWall(selected)?selected.id:'draw');
    setSurfaceOffset(kind==='roof'?3.4:kind==='wall'&&shape!=='straight'?0.2:0);
    setSurfaceThickness(kind==='wall'?0.25:0.2);
    if(kind==='stairs'){
      const rise=selected?.kind==='wall'&&selected.walk?selected.height-selected.walk.parapetHeight:level?.storeyHeight??DEFAULT_STAIRS.rise;
      setStairShape('straight');setStairTowerId(selected?.kind==='wall'&&isCircularWall(selected)?selected.id:'draw');
      setStairDimensions({...DEFAULT_STAIRS,...DEFAULT_SPIRAL,rise,run:Math.min(40,Math.max(5.6,rise*1.7)),steps:Math.min(128,Math.ceil(rise/.2))});
      setSurfaceOffset(selected?.kind==='wall'&&selected.walk?selected.elevation:selected?.kind==='slab'&&!selected.stairs?selected.elevation+selected.thickness:0);
    }
    setView('top');setPanel('inspector');
  };
  const chooseDrawingLevel = (id: string) => {
    if(wallDraft.length)return;
    setDrawingLevelId(id);editor.select(id);frame();
  };
  const fitConicalRoof=()=>guard(()=>{
    const wall=editor.getSnapshot().project.entities.find((e):e is Wall=>e.kind==='wall'&&e.id===roofTowerId&&e.parentId===drawingLevel?.id&&e.visible);
    if(!wall||roofShape!=='conical'||tool!=='roof')throw new Error('Choose a circular tower on the drawing level.');
    const roof=conicalRoofForTower(wall,roofHeight,roofOverhang);editor.execute({type:'add',entity:roof},'Fit conical roof to tower');chooseTool('select');select(roof.id);setView('perspective');frame();setNotice('Conical roof placed. Double-click to edit radius, height and overhang.');
  });
  const fitSpiralStairs=()=>guard(()=>{
    if(!stairTower||stairShape!=='spiral'||tool!=='stairs')throw new Error('Choose a circular tower on this level.');
    const stairs=spiralStairsForTower(stairTower,stairDimensions);editor.execute({type:'add',entity:stairs},'Fit spiral stairs inside tower');chooseTool('select');select(stairs.id);setView('perspective');frame();setNotice('Spiral stairs fitted inside the tower. Double-click to edit dimensions and railings.');
  });
  const chooseStairTower=(id:string)=>{setStairTowerId(id);setWallDraft([]);const tower=roofTowers.find(w=>w.id===id);if(tower){setStairDimensions(old=>({...old,...spiralTowerDimensions(tower)}));setSurfaceOffset(tower.elevation);}};
  const addDrawingLevel = () => guard(() => {
    if(wallDraft.length)return;
    const level:Level={id:crypto.randomUUID(),kind:'level',parentId:'site',name:`Level ${project.entities.filter(e=>e.kind==='level').length+1}`,position:[0,0,0],rotation:0,visible:true,storeyHeight:3.4};
    editor.execute({type:'add',entity:level},'Add blank level');
    chooseDrawingLevel(level.id);
  });
  const duplicateNext=()=>guard(()=>{
    if(state.gestureLabel)throw new Error('Finish or cancel the current edit first.');
    if(!selected||(selected.kind!=='level'&&selected.kind!=='unit'))return;
    if(!copyDraft){setCopyDraft({sourceId:selected.id,height:copyHeight,prefix:crypto.randomUUID()});setIsolateFloor(false);return;}
    if(!copyResult.plan)throw new Error(copyResult.error||'Start a new copy preview.');
    const nextId=copyResult.plan.selectedId;
    editor.execute({type:'duplicateAbove',...copyDraft},`Duplicate ${selected.kind} above`);
    select(nextId);
    setCopyDraft({sourceId:nextId,height:copyDraft.height,prefix:crypto.randomUUID()});
    setNotice('Copy placed. Click Place copy above again to add another storey. Escape finishes.');
  });
  const openRegions=(type:RegionTool=regionType)=>{chooseTool("select");select(null);setRegionsOpen(true);setRegionType(type);setPanel("inspector");};
  const addRegion=(points?:PathPoint[])=>guard(()=>{editor.cancel();const region=createRegion(editor.getSnapshot().project,regionType,points);editor.execute({type:"add",entity:region},"Add landscape region");select(region.id);setNotice(region.kind==="plantingRegion"?"Region added. Preview regeneration, then Apply to plant it.":"Surface region added. Edit its material or boundary.");});
  const openWaterSystem = (type:InlandWaterType=waterType) => {
    chooseTool("select");
    const existing=editor.getSnapshot().project.entities.find(e=>e.kind===type);
    select(existing?.id??null);setWaterType(type);setWaterOpen(true);setPanel("inspector");
  };
  const addLake = (points?:PathPoint[]) => guard(()=>{
    editor.cancel();const current=editor.getSnapshot().project,lake=createLake(current,points);
    editor.execute({type:"add",entity:lake},"Add lake");select(lake.id);setNotice("Lake added. Edit its boundary, level, and surface in Water System.");
  });
  const startPathDrawing = (characterId?: string) => guard(() => {
    const current = editor.getSnapshot(), character = current.project.entities.find(entity=>entity.id===characterId);
    if(characterId && (character?.kind!=='instance'||!canEditObject(current.project,characterId,current.isolatedLayerId))) throw new Error('Show and unlock this person before drawing their route.');
    const existing = character?.kind==='instance' ? characterWalkingPath(character) : current.project.entities.find(e => e.kind === 'path');
    if (!characterId && existing && !canEditObject(current.project,existing.id,current.isolatedLayerId)) throw new Error('Show and unlock the path layer before redrawing.');
    chooseTool('path');
    setPathReturnId(characterId ?? null);
    setPathRedrawId(existing?.id ?? null);
    setPathDrawWidth(existing?.width ?? 3); setPathDrawSurface(existing?.surface ?? 'gravel');
    editor.select(characterId ?? existing?.id ?? null); setView('top'); setPanel('inspector'); frame();
    setNotice(`Click the start, corners, and end on the terrain. Finish ${characterId ? 'route' : 'path'} in Properties.`);
  });
  const finishPathDrawing = () => guard(() => {
    if(pathReturnId){
      const character=createCharacterRoute(editor.getSnapshot().project,pathReturnId,pathDraft,pathDrawWidth,pathDraftRounding);
      editor.execute({type:'replace',entity:character},pathRedrawId ? 'Redraw walking route' : 'Draw walking route');
      select(character.id);setNotice('Walking route saved for this person. Drag its handles or edit Route points in Properties.');return;
    }
    const path = createDrawnPath(editor.getSnapshot().project,pathDraft,{width:pathDrawWidth,surface:pathDrawSurface,cornerRounding:pathDraftRounding},pathRedrawId ?? undefined);
    editor.execute({type:pathRedrawId ? 'replace' : 'add',entity:path},pathRedrawId ? 'Redraw path' : 'Draw path');
    select(path.id); setNotice('Landscape path ready. People’s walking routes are edited separately in their Properties.');
  });
  const cancelPathDrawing = () => { const previous = pathReturnId ?? pathRedrawId; chooseTool('select'); if (previous) select(previous); };
  const addRiver = (points?: RiverPoint[]) =>
    guard(() => {
      editor.cancel();
      const current = editor.getSnapshot().project;
      const river = createRiver(current);
      if (points) river.points = points;
      editor.execute({ type: "add", entity: river }, "Add river");
      select(river.id);
      setNotice(
        "River added. Drag numbered points or edit the river properties.",
      );
    });
  const addOcean = () =>
    guard(() => {
      editor.cancel();
      const ocean = createOcean();
      // Start above the flat-site elevation so the newly added water is visible.
      ocean.level = Math.min(
        8,
        Math.max(
          0,
          Math.min(...editor.getSnapshot().project.site.terrain.heights) + 0.5,
        ),
      );
      editor.execute({ type: "add", entity: ocean }, "Add ocean");
      select(ocean.id);
      setNotice(
        "Ocean added. Adjust its water level and wave settings in Properties.",
      );
    });
  const addBuilding = (x?: number, z?: number, width = 10, depth = 7) =>
    guard(() => {
      editor.cancel();
      const current = editor.getSnapshot().project;
      const centerX =
          x ??
          Math.max(
            -current.site.width / 2 + width / 2 + 0.5,
            -Math.min(28, current.site.width * 0.25),
          ),
        centerZ =
          z ??
          Math.min(
            current.site.depth / 2 - depth / 2 - 0.5,
            current.site.depth * 0.2,
          );
      const entities = createBuilding(current, centerX, centerZ, width, depth);
      editor.execute({ type: "insert", entities }, "Add building");
      select(entities[0].id);
      setNotice(
        "Building added. Select its level or individual walls, slab, and roof to edit.",
      );
    });
  const groundPoint = (x: number, z: number) => {
    if(tool==='repeat'){repeat.point(x,z);return;}
    if (tool === 'plant') { plants.place(x, z); return; }
    if(drawingArchitecture){
      if(!drawingLevel)return;
      const point=drawingPoint(drawingLevel,x,z);
      if(tool==='stairs'){
        if(stairShape==='spiral'&&stairTower)return;
        guard(()=>{if(!wallDraft.length){setWallDraft([snapping?point.map(v=>Math.round(v*4)/4) as PlanPoint:point]);return;}const stairs=stairShape==='spiral'?createSpiralStairs(drawingLevel.id,wallDraft[0],point,stairDimensions,surfaceOffset,snapping):createStairs(drawingLevel.id,wallDraft[0],point,stairDimensions,surfaceOffset,snapping);editor.execute({type:'add',entity:stairs},'Draw '+stairShape+' stairs');setWallDraft([]);setNotice('Stairs created. Draw another flight, or exit the tool and double-click to edit.');});return;
      }
      if(tool==='roof'&&roofShape==='conical'){
        if(roofTower)return;
        guard(()=>{const points=[...wallDraft,snapRoofDrawingPoint(point,wallDraft,snapping)];if(points.length<2){setWallDraft(points);return;}const roof=createConicalRoof(drawingLevel.id,points,roofHeight,roofOverhang,surfaceOffset);editor.execute({type:'add',entity:roof},'Draw conical roof');setWallDraft([]);setNotice('Conical roof created. Draw another, or exit the Roof tool to edit it.');});return;
      }
      if(tool==='wall'&&wallShape!=='straight'){
        guard(()=>{
          const walls=project.entities.filter((e):e is Wall=>e.kind==='wall'&&e.parentId===drawingLevel.id&&!!e.joins);
          const next=snapCurveDrawingPoint(point,wallDraft,walls,snapping);
          const points=[...wallDraft,next];
          if(points.length<(wallShape==='circle'?2:3)){setWallDraft(points);return;}
          const wall=connectCurvedWall(project,createCurvedWall(drawingLevel.id,wallShape,points,surfaceThickness,wallHeight,wallClockwise,surfaceOffset));
          editor.execute({type:'add',entity:wall},`Draw ${wallShape} wall`);setWallDraft([]);
          setNotice(`${wall.name} created. Click another center to draw again, or exit the tool to edit it.`);
        });return;
      }
      const walls=project.entities.filter((e):e is Wall=>e.kind==='wall'&&e.parentId===drawingLevel.id&&e.joins===true);
      const next=snapping?snapWallPoint(point,walls,wallDraft.at(-1)):point;
      if(wallDraft.length>=3&&Math.hypot(next[0]-wallDraft[0][0],next[1]-wallDraft[0][1])<0.2){finishArchitecture(true);return;}
      guard(()=>{
        if(wallDraft.length>=16)throw new Error('Finish this drawing with up to 16 corners.');
        if(wallDraft.length&&Math.hypot(next[0]-wallDraft.at(-1)![0],next[1]-wallDraft.at(-1)![1])<0.2)throw new Error('Choose a different corner or finish the chain.');
        setWallDraft([...wallDraft,next]);
      });return;
    }

    const next: [number, number] = [snap(x), snap(z)];
    if(tool==="region"){
      guard(()=>{if(regionDraft.length>=16)throw new Error("Finish this region with up to 16 points.");
        const p:PathPoint=snapping?[snap(x),snap(z)]:[x,z],last=regionDraft.at(-1);
        if(last&&Math.hypot(p[0]-last[0],p[1]-last[1])<0.5)throw new Error("Keep boundary points at least 0.5 m apart.");
        if(last)for(let i=1;i<regionDraft.length-1;i++)if(segmentDistance(last,p,regionDraft[i-1],regionDraft[i])<0.25)throw new Error("The boundary crosses an earlier edge.");
        setRegionDraft([...regionDraft,p]);});return;
    }
    if(tool==="lake"){
      guard(()=>{
        if(lakeDraft.length>=24)throw new Error("Finish this lake with up to 24 boundary points.");
        const p:PathPoint=snapping?[snap(x),snap(z)]:[x,z],current=editor.getSnapshot().project,last=lakeDraft.at(-1);
        if(Math.abs(p[0])+1>current.site.width/2||Math.abs(p[1])+1>current.site.depth/2)throw new Error("Keep the lake and its banks inside the site.");
        if(last&&Math.hypot(p[0]-last[0],p[1]-last[1])<1)throw new Error("Keep lake points at least 1 m apart. Finish closes the boundary.");
        if(last)for(let i=1;i<lakeDraft.length-1;i++)if(segmentDistance(last,p,lakeDraft[i-1],lakeDraft[i])<0.5)throw new Error("The boundary crosses an earlier edge. Choose another point.");
        setLakeDraft([...lakeDraft,p]);
      });return;
    }
    if (tool === "path") {
      guard(() => {
        if (pathDraft.length >= 16) throw new Error("Finish this path with up to 16 points.");
        const current = editor.getSnapshot().project;
        const snapped = snapPathPoint(current, [x, z], snapping);
        const points = [...pathDraft, snapped.point];
        if (points.length > 1) {
          if(pathReturnId)createCharacterRoute(current,pathReturnId,points,pathDrawWidth,[...pathDraftRounding,0]);
          else createDrawnPath(current,points,{width:pathDrawWidth,surface:pathDrawSurface,cornerRounding:[...pathDraftRounding,0]},pathRedrawId ?? undefined);
        }
        else if (Math.abs(snapped.point[0]) > current.site.width/2 - pathDrawWidth/2 || Math.abs(snapped.point[1]) > current.site.depth/2 - pathDrawWidth/2) throw new Error("Keep the path surface inside the site.");
        setPathDraft(points);
        setPathDraftRounding(values=>[...values,0]);
        if (snapped.target) setNotice(`Endpoint snapped to ${snapped.target}.`);
      });
      return;
    }
    if (tool === "river") {
      guard(() => {
        if (riverDraft.length >= 16)
          throw new Error("Finish this river with up to 16 control points.");
        const current = editor.getSnapshot().project,
          y = Math.max(
            -7,
            Math.min(
              riverDraft.at(-1)?.[1] ?? 30,
              groundHeight(next[0], next[1], current.site) - 0.3,
            ),
          );
        const points: RiverPoint[] = [...riverDraft, [next[0], y, next[1]]];
        if (points.length > 1)
          parseProject({
            ...current,
            entities: [
              ...current.entities,
              { ...createRiver(current), points },
            ],
          });
        setRiverDraft(points);
      });
      return;
    }
    if (!buildingCorner) {
      setBuildingCorner(next);
      return;
    }
    const width = Math.abs(next[0] - buildingCorner[0]),
      depth = Math.abs(next[1] - buildingCorner[1]);
    if (width < 1 || depth < 1 || width > 99 || depth > 99) {
      setError("Choose a footprint between 1 and 99 m on each side.");
      return;
    }
    addBuilding(
      (next[0] + buildingCorner[0]) / 2,
      (next[1] + buildingCorner[1]) / 2,
      width,
      depth,
    );
  };
  const finishArchitecture=(closed:boolean)=>guard(()=>{
    if(!drawingLevel||!drawingArchitecture)return;
    if(tool==='stairs'||tool==='roof'&&roofShape==='conical')return;
    const entities=tool==='wall'
      ? wallShape==='straight'?createWallChain(editor.getSnapshot().project,drawingLevel.id,wallDraft,closed,crypto.randomUUID(),false,surfaceThickness):[connectCurvedWall(editor.getSnapshot().project,createCurvedWall(drawingLevel.id,wallShape,wallDraft,surfaceThickness,wallHeight,wallClockwise,surfaceOffset))]
      : [createDrawnSurface(tool,drawingLevel,wallDraft,surfaceOffset,surfaceThickness)];
    editor.execute({type:'insert',entities},`Draw ${tool}`);
    setWallDraft([]);setNotice(`${tool==='wall'?'Wall chain':tool==='floor'?'Floor':'Flat roof'} created. Click to draw another, or exit the tool to edit it.`);
  });
  const placeAsset = (asset: Asset, extraAssets: Asset[] = []) =>
    guard(() => {
      editor.cancel();
      const current = editor.getSnapshot().project;
      const count = current.entities.filter(
        (entity) => entity.kind === "instance",
      ).length;
      const entity: Instance = {
        id: crypto.randomUUID(),
        parentId: "site",
        kind: "instance",
        name: `${asset.name.slice(0, 65)}${count ? ` ${count + 1}` : ""}`,
        visible: true,
        assetId: asset.id,
        position: [
          (-29 * current.site.width) / 90 +
            (count % 5) * Math.min(3, current.site.width / 15),
          0,
          (-8 * current.site.depth) / 72 +
            (Math.floor(count / 5) % 5) * Math.min(3, current.site.depth / 12),
        ],
        rotation: 0,
        scale: [1, 1, 1],
        anchor: "terrain",
      };
      editor.execute(
        { type: "insert", assets: extraAssets, entities: [entity] },
        "Place model",
      );
      select(entity.id);
    });
  const importModel = async (file: File | undefined) => {
    if (!file || importingModel) return;
    const destination = editor.getSnapshot().project;
    setImportingModel(true);
    try {
      if (file.size > MAX_GLB_BYTES)
        throw new Error("Use a GLB smaller than 8 MB.");
      const asset: Asset = {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.glb$/i, "").slice(0, 80) || "Imported model",
        data: encodeGlb(new Uint8Array(await file.arrayBuffer())),
        attribution:
          file.name === "Coastal pine.glb"
            ? "Original OpenLandcraft procedural demo tree; CC0-1.0."
            : "",
      };
      await validateModels([asset]);
      if (editor.getSnapshot().project !== destination)
        throw new Error(
          "The scene changed while the model was loading. Import it again in the current project.",
        );
      const existing = editor
        .getSnapshot()
        .project.assets.find((source) => source.data === asset.data);
      if (!placeAsset(existing ?? asset, existing ? [] : [asset])) return;
      setNotice(
        "Model embedded and placed. Use the handles or numeric properties to move it.",
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The model could not be imported.",
      );
    } finally {
      setImportingModel(false);
      if (modelInput.current) modelInput.current.value = "";
    }
  };
  const previewStamp = () =>
    guard(() => {
      editor.cancel();
      editor.select("terrain");
      const baseline = editor.getSnapshot().project;
      const stamp = new TerrainStroke(
        baseline.site.terrain,
        baseline.site,
        brush,
      );
      stamp.move(...stampPosition);
      editor.begin(
        `${brush.kind[0].toUpperCase() + brush.kind.slice(1)} stamp`,
      );
      editor.preview({ type: "terrain", field: stamp.snapshot() });
    });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (opening || importingModel || event.defaultPrevented || event.isComposing) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('[role="menu"], [role="listbox"], [role="combobox"], [aria-haspopup="menu"][aria-expanded="true"]')) return;
      if (event.key === 'Escape') return; // Handled by the capture listener.
      if (projectDialog || showHelp || target?.isContentEditable || target?.closest("input, textarea, select, [role=textbox], [contenteditable]:not([contenteditable=false])"))
        return;
      const shortcut = (event.ctrlKey || event.metaKey) && !event.altKey;
      const key = event.key.toLowerCase();
      if(target?.closest('.layers-panel')&&!shortcut)return;
      // Inspector disclosures and action buttons own their keyboard activation.
      if(target?.closest('#inspector button, #inspector summary')&&!shortcut)return;
      if ((event.key === 'Delete' || event.key === 'Backspace') && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        event.preventDefault();
        if (event.repeat || !['select','wall-edit','outline-edit','opening-edit'].includes(tool)) return;
        if (editor.getSnapshot().gestureLabel || copyDraft) { setNotice('Finish or cancel the current edit before deleting.'); return; }
        const removal = selectionDelete(editor.getSnapshot().project, editor.getSnapshot().selectedId, selectedParts, openingFocus);
        if (removal && guard(() => editor.execute(removal.command, removal.label))) {
          select(null);
          setNotice(removal.label + '. Undo restores it.');
        }
        return;
      }
      const editKey = event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && !event.repeat;
      if(editKey&&tool==='select'&&focusedOpening&&openingFocus){event.preventDefault();setTool('opening-edit');setOpeningStatus('Drag the tinted opening to move; use the square handles to resize.');return;}
      if(editKey&&tool==='select'&&wallTarget&&!focusedOpening&&!selectedParts.length){event.preventDefault();setTool('wall-edit');setWallStatus(wallTarget.curve?'Drag Center to move or Radius to resize. Use Properties for precise dimensions.':'Drag the wall body or its Start / End handles.');return;}
      if(editKey&&tool==='select'&&outlineTarget&&!selectedParts.length){event.preventDefault();setOutlineHandle({mode:'vertex',index:0});setTool('outline-edit');setOutlineStatus(outlineTarget.kind==='roof'&&outlineTarget.cone?'Edit roof dimensions below or use the available handles.':'Drag the object or use its handles; edit precise dimensions in Properties.');return;}
      if (shortcut && key === "z") {
        event.preventDefault();
        event.shiftKey ? editor.redo() : editor.undo();
      } else if (
        shortcut && !event.shiftKey &&
        event.key.toLowerCase() === "y"
      ) {
        event.preventDefault();
        editor.redo();
      } else if (
        shortcut && !event.shiftKey &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        queueSave(true);
      } else if (key === 'f' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && !event.repeat) { event.preventDefault(); if (!editor.getSnapshot().gestureLabel) frame(); }
    };
    const onClipboard = (event: ClipboardEvent) => {
      const target = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (opening || importingModel || projectDialog || showHelp || event.defaultPrevented || target?.isContentEditable || target?.closest('[role=menu], [role=listbox], [role=combobox], .layers-panel, input, textarea, select, [role=textbox], [contenteditable]:not([contenteditable=false])')) return;
      if (event.type === 'copy' && window.getSelection()?.toString()) return;
      event.preventDefault();
      if (!['select','wall-edit','outline-edit','opening-edit'].includes(tool)) return;
      if (editor.getSnapshot().gestureLabel || copyDraft) { setNotice('Finish or cancel the current edit before copying or pasting.'); return; }
      if (event.type === 'copy') guard(() => {
        const data = copySelection(editor.getSnapshot().project, editor.getSnapshot().selectedId, selectedParts, openingFocus);
        const token = 'OpenLandcraft selection: ' + crypto.randomUUID();
        event.clipboardData?.setData('text/plain', token);
        clipboard.current = { data, pastes: 0, token };
        setNotice('Selection copied. Ctrl/Cmd V pastes an independent copy in this editor.');
      });
      else if (!clipboard.current || event.clipboardData?.getData('text/plain') !== clipboard.current.token) setNotice('Copy an element in this editor with Ctrl/Cmd C first.');
      else guard(() => {
        const clip = clipboard.current!;
        const result = pasteSelection(editor.getSnapshot().project, clip.data, editor.getSnapshot().selectedId, crypto.randomUUID(), clip.pastes + 1);
        editor.execute(result.command, 'Paste selection'); clip.pastes++;
        select(result.selectedIds[0]);
        if (result.focus) setOpeningFocus(result.focus);
        else if (result.selectedIds.length > 1) setSelectedParts(result.selectedIds);
        setNotice(result.focus ? 'Opening pasted into a free gap. Undo restores the previous wall.' : 'Independent copy pasted 2 m farther along X/Z. Undo removes this paste.');
      });
    };
    window.addEventListener('copy', onClipboard);
    window.addEventListener('paste', onClipboard);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener('copy', onClipboard); window.removeEventListener('paste', onClipboard); };
  }, [editor, frame, queueSave, opening, importingModel, cancelPreview,tool,focusedOpening,openingFocus,wallTarget,outlineTarget,selectedParts,copyDraft,projectDialog,showHelp,guard,select]);

  const preview = (entity: Entity) =>
    guard(() => {
      if (!editor.getSnapshot().gestureLabel)
        editor.begin(`Edit ${entity.name}`);
      const assets = editor.getSnapshot().preview?.assets ?? [];
      editor.preview({
        type: "batch",
        commands: [
          { type: "replace", entity },
          ...assets
            .filter(
              (asset) =>
                editor
                  .getSnapshot()
                  .project.assets.find((source) => source.id === asset.id)
                  ?.attribution !== asset.attribution,
            )
            .map((asset) => ({ type: "asset" as const, asset })),
        ],
      });
    });
  const changeBlock = (changes: Partial<Block>) => {
    if (selected?.kind === "block") preview({ ...selected, ...changes });
  };
  const changeOcean = (changes: Partial<Ocean>) => {
    if (selected?.kind === "ocean") preview({ ...selected, ...changes });
  };
  const addBlock = () =>
    guard(() => {
      editor.cancel();
      setTool("select");
      const count = state.project.entities.filter(
        (entity) => entity.kind === "block",
      ).length;
      const x = Math.max(
          -state.project.site.width / 2 + 3.5,
          -state.project.site.width * 0.2 -
            (count % 3) * Math.min(5, state.project.site.width * 0.08),
        ),
        z = Math.min(
          state.project.site.depth / 2 - 3,
          state.project.site.depth * 0.1 +
            (Math.floor(count / 3) % 3) *
              Math.min(7, state.project.site.depth * 0.1),
        );
      const block: Block = {
        id: crypto.randomUUID(),
        parentId: "site",
        kind: "block",
        visible: true,
        name: `Massing ${String(count + 1).padStart(2, "0")}`,
        position: [
          x,
          groundHeight(x, z, evaluateProject(state.project).site) + 0.1,
          z,
        ],
        size: [6, 4, 5],
        rotation: 0,
        color: "#ded8ca",
      };
      editor.execute({ type: "add", entity: block }, "Add massing block");
      editor.select(block.id);
      setPanel("inspector");
      setNotice(
        "Massing block added. Edit its dimensions and position in the inspector.",
      );
    });
  const duplicate = () =>
    guard(() => {
      if (!selected || selected.kind !== "block") return;
      editor.cancel();
      const entity: Block = {
        ...selected,
        id: crypto.randomUUID(),
        name: `${selected.name.slice(0, 65)} copy`,
        position: [
          selected.position[0] - 3,
          selected.position[1],
          selected.position[2] + 4,
        ],
      };
      editor.execute({ type: "insert", entities:[entity], objectLayers:{[entity.id]:objectLayer(state.project,selected.id)} }, "Duplicate block");
      editor.select(entity.id);
    });
  const exportProject = () =>
    guard(() => {
      const committed = editor.getSnapshot().project;
      const blob = new Blob([serializeProject(committed)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${committed.name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase()}.olc.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(
        state.gestureLabel
          ? "Exported the committed scene. Apply your preview to include pending edits."
          : "Portable project exported.",
      );
    });
  const importProject = async (file: File | undefined) => {
    if (!file) return;
    const openStart=performance.now();
    diagnostics?.event('file-open-start',{fileName:file.name,bytes:file.size});
    setOpening(true);
    try {
      if (file.size > MAX_PROJECT_BYTES)
        throw new Error("This project exceeds the 40 MB limit.");
      const text=await measured(diagnostics,'file-read',()=>file.text());
      const decoded=await measured(diagnostics,'file-parse',()=>deserializeProject(text));
      const parsed=await measured(diagnostics,'file-upgrade',()=>upgradeLibraryFish(decoded));
      await measured(diagnostics,'file-model-validation',()=>validateModels(parsed.assets));
      editor.load(parsed);
      setTool("select");
      setRiverDraft([]);
      setPathDraft([]); setPathRedrawId(null); setPathReturnId(null); setPathDraftRounding([]); setPathCornerIndex(null);
      setLakeDraft([]);
      setRegionDraft([]);setWallDraft([]);
      setBuildingCorner(null);
      setFrameToken((value) => value + 1);
      setView("perspective");
      setStorageReady(true);
      queueSave();
      setError("");
      setNotice("Project opened. Session history has been reset.");
      diagnostics?.event('file-open-ready',{durationMs:performance.now()-openStart,entities:parsed.entities.length,assets:parsed.assets.length});
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The project could not be opened.",
      );
    } finally {
      setOpening(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  useEffect(()=>{diagnostics?.projectOpener?.(importProject);return()=>diagnostics?.projectOpener?.(null);},[diagnostics,importProject]);

  return (
    <div className="app">
      <a href="#inspector" className="skip-link">
        Skip to object inspector
      </a>
      <header className="app-header">
        <a
          className="brand"
          href="#"
          aria-label="OpenLandcraft home"
          onClick={(event) => event.preventDefault()}
        >
          <span className="brand-symbol">
            <Mountain size={25} strokeWidth={1.6} />
          </span>
          <span className="brand-wordmark">
            openlandcraft<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="header-divider" />
        <ProjectName name={state.project.name} disabled={!!state.gestureLabel || opening || importingModel}
          onRename={name => guard(() => editor.execute({type:'rename',name},'Rename project'))} />
        <div className="header-actions">
          <div className="history-buttons">
            <IconButton
              label="Undo (Ctrl Z)"
              disabled={!state.past.length && !state.gestureLabel}
              onClick={() => editor.undo()}
            >
              <Undo2 size={17} />
            </IconButton>
            <IconButton
              label="Redo (Ctrl Shift Z)"
              disabled={!state.future.length || !!state.gestureLabel}
              onClick={() => editor.redo()}
            >
              <Redo2 size={17} />
            </IconButton>
          </div>
          <Button variant="ghost"
            className="text-button"
            aria-label="New site"
            title="Create a new site"
            onClick={() => setProjectDialog("new")}
          >
            <Plus size={16} />
            <span>New</span>
          </Button>
          <Button variant="ghost"
            className="text-button open-button"
            aria-label="Open"
            title="Open project file"
            onClick={() => fileInput.current?.click()}
          >
            <ArrowUpFromLine size={16} />
            <span>Open</span>
          </Button>
          <Button variant="ghost"
            className="text-button"
            aria-label="Export"
            title="Export project file"
            onClick={exportProject}
          >
            <ArrowDownToLine size={16} />
            <span>Export</span>
          </Button>
          <Button variant="default"
            className="primary-button"
            aria-label="Save project"
            title="Save project locally"
            onClick={() => queueSave(true)}
          >
            <Save size={16} />
            <span>Save project</span>
          </Button>
        </div>
        <Input
          ref={fileInput}
          type="file"
          accept=".json,.olc.json,application/json"
          className="visually-hidden"
          aria-label="Open project file"
          onChange={(event) => void importProject(event.target.files?.[0])}
        />
      </header>

      <div className="workspace">
        <WorkspaceSidebar mobileActive={panel==='scene'}
          layers={<LayersPanel project={state.project} editor={editor} selectedIds={selectedParts.length?selectedParts:state.selectedId?[state.selectedId]:[]} isolatedId={state.isolatedLayerId} guard={guard} onSelectObjects={ids=>{select(ids[0]??null);setSelectedParts(ids);}}/>}
          objects={<SceneObjects project={project} selectedId={state.selectedId} selectedIds={selectedParts} editor={editor} onSelect={select} guard={guard} isolatedId={state.isolatedLayerId}/>}
          assets={<AssetsPanel chosen={tool==='plant'?plants.chosen:null} loading={plants.loading} grow={plants.grow} onGrow={plants.setGrow}
            wind={plants.wind} onWind={plants.setWind}
            mode={plants.mode} onMode={mode=>{editor.cancel();plants.setMode(mode);}} brush={plants.brush} onBrush={plants.setBrush}
            onChoose={plant=>{chooseTool('plant');setNotice('');void plants.choose(plant);}} onCancel={()=>chooseTool('select')}/>}
          actions={<>
            <CreationMenu project={project} busy={!!state.gestureLabel}
              onRepeat={()=>{const source=repeatSources(project).find(e=>e.id===state.selectedId);chooseTool('repeat');repeat.start(source?.id);setPanel('inspector');setView('top');}}
              onAddBlock={addBlock} onAddBuilding={()=>addBuilding()}
              onDrawBuilding={()=>{chooseTool('building');setView('top');}}
              onDrawArchitecture={(kind,shape)=>startArchitecture(kind,undefined,shape)}
              onRegions={()=>openRegions()} onWater={()=>openWaterSystem()}
              onDrawPath={()=>startPathDrawing()}
              onAddOcean={addOcean}
              onPlaceAsset={placeAsset}
              onRemoveAsset={id=>guard(()=>editor.execute({type:'removeAsset',id},'Remove model source'))}
            />
          <Input
            ref={modelInput}
            type="file"
            accept=".glb,model/gltf-binary"
            className="visually-hidden"
            aria-label="Import GLB model"
            onChange={(event) => void importModel(event.target.files?.[0])}
          />

            <Button variant="outline" className="flex-1" disabled={importingModel} onClick={()=>modelInput.current?.click()}>
              <ArrowUpFromLine size={14}/>{importingModel?'Reading GLB…':'Import GLB'}
            </Button>
          </>}
        />

        <main className="stage" aria-label="3D editor">
          <ViewportToolbar view={view} projection={activeProjection} onProjection={next=>{setProjection(next);setView(next==='orthographic'?'axonometric':'perspective');}}
            canShore={project.entities.some(entity => entity.kind === 'ocean' && entity.visible)} canDive={canDive}
            onView={next => { if(next === 'shore' || next.endsWith('underwater')) chooseTool('select'); if(next==='perspective'||next==='axonometric')setProjection(next==='axonometric'?'orthographic':'perspective');setView(next); }}
            transform={tool === 'select' && selected?.visible && ['instance','level','block'].includes(selected.kind) ? transformMode : undefined}
            canScale={selected?.kind === 'instance'} onTransform={mode => {editor.cancel();setTransformMode(mode);}}
            snapping={snapping} onSnapping={setSnapping} />
          <div className={`viewport-area${view.endsWith('underwater')?' underwater-view':''}`}>
            {!hydrating && <Viewport
              plantAsset={tool==='plant'?plants.asset:undefined}
              plantBrush={tool==='plant'&&plants.mode==='paint'?{settings:plants.brush,onAdded:plants.onAdded}:undefined}
              plantGrowth={plants.growth}
              plantWind={plants.wind}
              onCopyStatus={setNotice}
              onCopyPlaced={result=>{select(result.selectedIds[0]);if(result.focus)setOpeningFocus(result.focus);else if(result.selectedIds.length>1)setSelectedParts(result.selectedIds);}}
              selectedIds={selectedParts}
              isolateLevelId={tool==='stairs'||editingOutline&&outlineTarget?.kind==='slab'&&outlineTarget.stairs?null:drawingArchitecture?drawingLevel?.id:placingOpening||editingOpening||editingWall||editingOutline?placementLevel?.id:isolateFloor&&!copyDraft?selectedLevel?.id:null}
              onOutlinePick={pickOutline}
              stairAttachment={stairAttachment.draft?{end:stairAttachment.draft.end,surface:stairAttachment.draft.surface,stairId:stairAttachment.draft.id,ready:stairAttachment.draft.ready,onPick:stairAttachment.pick}:undefined}
              outlineEditing={!stairAttachment.draft&&editingOutline&&outlineTarget&&selectedLevel?{part:outlineTarget,level:selectedLevel,handle:outlineHandle,onHandle:setOutlineHandle,onStatus:setOutlineStatus}:undefined}
              onWallPick={pickWall}
              wallEditing={editingWall&&wallTarget&&selectedLevel?{wall:wallTarget,level:selectedLevel,onStatus:setWallStatus}:undefined}
              openingSelection={tool==='select'||editingWall?{focus:focusedOpening?openingFocus:null,onPick:pickOpening}:undefined}
              openingEditing={editingOpening&&placementLevel?{level:placementLevel,focus:focusedOpening?openingFocus:null,onSelect:focusOpening,onStatus:setOpeningStatus}:undefined}
              openingPlacement={placingOpening&&placementLevel?{level:placementLevel,settings:openingSettings,onStatus:setOpeningStatus,onPlace:placeOpening}:undefined}
              floorCopy={copyResult.plan}
              copyAnchor={copyAnchor}
              copying={!!copyDraft}
              isolatedLayerId={state.isolatedLayerId}
              project={project}
              selectedId={state.selectedId}
              onSelect={select}
              grid={grid}
              playing={playing}
              quality={quality}
              view={view}
              projection={activeProjection}
              onNavigationView={setView}
              frameToken={frameToken}
              frameCancelToken={frameCancelToken}
              onMetrics={reportMetrics}
              editor={editor}
              tool={tool}
              brush={brush}
              onStrokeTime={reportStroke}
              onGroundPoint={groundPoint}
              repeatDrawing={tool==='repeat'?repeat.drawing:undefined}
              wallDraft={wallDraft}
              architectureDrawing={drawingArchitecture&&drawingLevel?{level:drawingLevel,kind:tool,offset:tool==='wall'&&wallShape==='straight'?0:surfaceOffset,thickness:surfaceThickness,wallShape,height:wallHeight,clockwise:wallClockwise,roofShape,roofHeight,roofOverhang,tower:roofTower,stairDimensions,stairShape,stairTower}:undefined}
              onError={setError}
              transformMode={transformMode}
              snapping={snapping}
              riverDraft={riverDraft}
              pathDraft={pathDraft}
              pathDraftRounding={pathDraftRounding}
              draftRouteAnchor={pathCornerIndex}
              onDraftRouteAnchor={index=>{setPathCornerIndex(index);}}
              selectedRouteAnchor={routeCornerIndex}
              routeCornerControls={routeCornerIndex!==null&&selected&&(selected.kind==='path'||selected.kind==='instance'&&selected.walkingRoute)?<RouteCornerEditor key={`${selected.id}:${routeCornerIndex}`} entity={selected} index={routeCornerIndex} editor={editor} onClose={()=>setRouteCornerIndex(null)}/>:undefined}
              draftCornerControls={pathCornerIndex!==null?<RouteCornerFields route={{points:pathDraft,width:pathDrawWidth,cornerRounding:pathDraftRounding}} index={pathCornerIndex} onChange={amount=>setPathDraftRounding(values=>values.map((value,index)=>index===pathCornerIndex?amount:value))} onClose={()=>setPathCornerIndex(null)}/>:undefined}
              onRouteAnchor={index=>setRouteCornerIndex(index)}
              pathDraftWidth={pathDrawWidth}
              regionDraft={regionDraft}
              lakeDraft={lakeDraft}
              lakeDraftLevel={lakeDraft.length?createLake(project,lakeDraft).level:0}
              waterPreview={waterPreview}
            />}

            {tool==='select' && selected?.visible && (selected.kind==='level'||selected.kind==='unit') && <div
              ref={copyAnchor} className="absolute left-0 top-0 z-10 w-[220px] max-w-[calc(100%-28px)]" style={{visibility:'hidden'}}>
              <DuplicateAbovePanel
                spacing={copyHeight} busy={!!state.gestureLabel} preview={!!copyDraft} valid={!!copyResult.plan} movesRoof={!!copyResult.plan?.movedRoofIds.length} error={copyResult.error}
                onSpacing={value=>{setCopySpacing(value);setCopyDraft(d=>d?{...d,height:value}:null);}} onDuplicate={duplicateNext} onFinish={()=>setCopyDraft(null)} />
            </div>}
            <div className="viewport-tools">
              <IconButton
                label="Selection tool"
                active={tool === "select"}
                onClick={() => chooseTool("select")}
              >
                <MousePointer2 size={19} />
              </IconButton>
              <IconButton
                label="Sculpt terrain"
                active={tool === "terrain"}
                onClick={() => chooseTool("terrain")}
              >
                <Mountain size={19} />
              </IconButton>
              <div className="tool-divider" />
              <IconButton label="Place door on wall" aria-pressed={tool==='door'} active={tool==='door'} onClick={()=>chooseTool('door')}><DoorOpen size={19}/></IconButton>
              <IconButton label="Place window on wall" aria-pressed={tool==='window'} active={tool==='window'} onClick={()=>chooseTool('window')}><PanelsTopLeft size={19}/></IconButton>
              <div className="tool-divider" />
<IconButton label="Frame selection (F)" onClick={frame}>
                <Focus size={19} />
              </IconButton>
              <div className="tool-divider" />
              <IconButton
                label="Toggle ground grid"
                active={grid}
                onClick={() => setGrid((value) => !value)}
              >
                <Grid2X2 size={18} />
              </IconButton>
            </div>
            {drawingArchitecture&&<div className="building-hud river-hud" role="status"><span>{tool==='wall'?(wallShape==='straight'?'Wall':wallShape==='arc'?'Arc wall':'Circular wall'):tool==='floor'?'Floor':tool==='stairs'?'Stairs':'Roof'} · {drawingLevel?`${drawingLevel.name} · ${wallDraft.length} ${(tool==='stairs'||tool==='wall'&&wallShape!=='straight'||tool==='roof'&&roofShape==='conical')?'points':'corners'}`:'Choose a drawing level in Properties'}</span>{!(tool==='stairs'||tool==='wall'&&wallShape!=='straight'||tool==='roof'&&roofShape==='conical')&&<button disabled={!drawingLevel||wallDraft.length<(tool==='wall'?2:3)} onClick={()=>finishArchitecture(tool!=='wall')}>Finish {tool}</button>}<button onClick={()=>chooseTool('select')}>Exit tool</button></div>}
            {tool === "building" && (
              <div className="building-hud" role="status">
                <Layers size={15} />
                <span>
                  {buildingCorner
                    ? `First corner ${buildingCorner.join(", ")} m · Choose opposite corner`
                    : "Choose the first footprint corner on land"}
                </span>
                <button onClick={() => chooseTool("select")}>Cancel</button>
              </div>
            )}
            {tool==="region"&&<div className="building-hud river-hud region-hud" role="status"><Leaf size={15}/><span>{regionDraft.length} boundary points</span><Field variant="checkbox"><CheckboxInput aria-label="Snap drawing region" checked={snapping} onChange={e=>setSnapping(e.target.checked)}/>Snap</Field><button disabled={regionDraft.length<3} onClick={()=>addRegion(regionDraft)}>Finish region</button><button disabled={!regionDraft.length} onClick={()=>setRegionDraft(p=>p.slice(0,-1))}>Back</button><button onClick={()=>chooseTool("select")}>Cancel</button></div>}
            {tool==="lake"&&<div className="building-hud river-hud lake-hud" role="status"><Droplets size={15}/><span>{lakeDraft.length?`${lakeDraft.length} boundary points · Finish closes the shoreline`:"Choose the first lake boundary point on land"}</span><Field variant="checkbox"><CheckboxInput aria-label="Snap drawing lake" checked={snapping} onChange={e=>setSnapping(e.target.checked)}/>Snap</Field><button disabled={lakeDraft.length<3} onClick={()=>addLake(lakeDraft)}>Finish lake</button><button disabled={!lakeDraft.length} onClick={()=>setLakeDraft(p=>p.slice(0,-1))}>Back</button><button onClick={()=>chooseTool("select")}>Cancel</button></div>}
            {tool === 'path' && <div className="building-hud river-hud path-hud" role="status"><Route size={15}/><span>{pathDraft.length ? `${pathDraft.length} points · ${pathLength(pathDraft).toFixed(1)} m · Click next corner or finish in Properties` : 'Click the path start on the terrain'}</span></div>}
            {tool === "river" && (
              <div className="building-hud river-hud" role="status">
                <Waves size={15} />
                <span>
                  {riverDraft.length
                    ? `${riverDraft.length} points · Choose next downstream point`
                    : "Choose the first upstream point on land"}
                </span>
                <button
                  disabled={riverDraft.length < 2}
                  onClick={() => addRiver(riverDraft)}
                >
                  Finish river
                </button>
                <button
                  disabled={!riverDraft.length}
                  onClick={() => setRiverDraft((points) => points.slice(0, -1))}
                >
                  Back
                </button>
                <button onClick={() => chooseTool("select")}>Cancel</button>
              </div>
            )}
            <div className="north-marker">
              <span>N</span>
              <svg viewBox="0 0 32 42" aria-hidden="true">
                <path d="M16 2 25 31 16 24 7 31Z" fill="#465348" />
                <path d="M16 2v22l9 7Z" fill="#a1ac99" />
              </svg>
            </div>
            {tool === "terrain" && (
              <div className="brush-hud">
                <Mountain size={13} />
                <strong>
                  {brush.kind[0].toUpperCase() + brush.kind.slice(1)}
                </strong>
                <span>Radius {brush.radius} m</span>
                <kbd>Esc</kbd>
                <span>cancel</span>
              </div>
            )}
          </div>
          <ViewportStatusBar placement={tool==='plant'&&plants.chosen?{name:plants.chosen.name,loading:plants.loading,painting:plants.mode==='paint',bird:plants.chosen.category==='Birds',fish:plants.chosen.category==='Fish',onCancel:()=>chooseTool('select')}:undefined} saveStatus={saveStatus} hasAnimation={hasWater || project.assets.some(asset => isBirdAsset(asset) || isFishAsset(asset) || isGroundCharacterAsset(asset)) || (plants.wind && project.assets.some(asset => asset.attribution?.startsWith('Kenney Nature Kit')))}
            metricsSource={metricsSource} playing={playing} onPlaying={() => setPlaying(value => !value)} quality={quality} onQuality={setQuality} onHelp={() => setShowHelp(true)} />
        </main>

        <InspectorPanel
          reveal={tool === 'path'||tool==='repeat'}
          mobileActive={panel === "inspector"}
          editing={!!state.gestureLabel}
          selectionKey={focusedOpening?.id ?? state.selectedId ?? ''}
          scope={tool === 'path' ? 'draw-path' : drawingArchitecture ? 'draw-architecture' : placingOpening ? 'place-opening' : editingOpening ? 'edit-opening' : editingWall ? 'edit-wall' : editingOutline ? 'edit-outline' : state.selectedId === 'terrain' ? 'terrain' : selected?.kind ?? 'empty'}
        >
          {tool==='select'&&state.selectedId&&<RepeatSelection key={`repeat-${state.selectedId}-${state.revision}`} editor={editor} id={state.selectedId} onSelect={select} onError={setError}/>}
          {!drawingArchitecture&&!placingOpening&&!editingOpening&&!editingWall&&!editingOutline&&!focusedOpening&&((!wallTarget&&!outlineTarget)||!!selectedParts.length)&&selectedLevel&&<InspectorSection sectionId="floor-context" title="Floors & units" className="mx-panel" defaultOpen={false}><FloorTools key={selectedLevel.id} project={project} editor={editor} selectedId={state.selectedId} selectedIds={selectedParts} select={select} guard={guard} isolate={isolateFloor} onIsolate={value=>{setCopyDraft(null);setIsolateFloor(value);}} onClear={()=>select(selectedLevel.id)}/></InspectorSection>}
          {!drawingArchitecture&&!placingOpening&&!editingOpening&&!focusedOpening&&!stairAttachment.draft&&['select','wall-edit','outline-edit'].includes(tool)&&<ArchitecturalMaterialFields key={'material-'+(selectedParts.length?selectedParts:[state.selectedId]).join('|')} project={project} editor={editor} ids={selectedParts.length?selectedParts:state.selectedId?[state.selectedId]:[]}/>}
          {stairAttachment.panel??(tool === 'repeat' ? repeat.panel : tool === 'path' ? <PathDrawingPanel cornerRounding={pathDraftRounding} characterName={project.entities.find(entity=>entity.id===pathReturnId)?.name} points={pathDraft} width={pathDrawWidth} surface={pathDrawSurface} redrawing={!!pathRedrawId} error={pathDrawingError} snapping={snapping} onWidth={setPathDrawWidth} onSurface={setPathDrawSurface} onSnapping={setSnapping} onFinish={finishPathDrawing} onBack={()=>{setPathDraft(points=>points.slice(0,-1));setPathDraftRounding(values=>values.slice(0,-1).map((value,i,array)=>i===array.length-1?0:value));setPathCornerIndex(null);}} onCancel={cancelPathDrawing}/> : drawingArchitecture ? <ArchitectureTools stairShape={stairShape} onStairShape={shape=>{setStairShape(shape);setWallDraft([]);if(shape==='spiral'&&stairTower)setStairDimensions(old=>({...old,...spiralTowerDimensions(stairTower)}));}} stairTowerId={stairTower?.id??'draw'} onStairTower={chooseStairTower} onFitStairTower={fitSpiralStairs} stairDimensions={stairDimensions} onStairDimensions={setStairDimensions} roofShape={roofShape} roofHeight={roofHeight} roofOverhang={roofOverhang} roofTowerId={roofTower?.id??'draw'} roofTowers={roofTowers} onRoofShape={shape=>{setRoofShape(shape);setWallDraft([]);}} onRoofHeight={setRoofHeight} onRoofOverhang={setRoofOverhang} onRoofTower={setRoofTowerId} onFitTower={fitConicalRoof} wallShape={wallShape} wallHeight={wallHeight} clockwise={wallClockwise} onWallShape={shape=>{setWallShape(shape);setWallDraft([]);setSurfaceOffset(shape==='straight'?0:0.2);}} onWallHeight={setWallHeight} onClockwise={setWallClockwise} kind={tool} levels={placementFloors} level={drawingLevel} count={wallDraft.length} offset={surfaceOffset} thickness={surfaceThickness} snapping={snapping} onLevel={chooseDrawingLevel} onNewLevel={addDrawingLevel} onOffset={setSurfaceOffset} onThickness={setSurfaceThickness} onSnapping={setSnapping} onFinish={finishArchitecture} onBack={()=>setWallDraft(points=>points.slice(0,-1))} onCancel={()=>setWallDraft([])} onExit={()=>chooseTool('select')}/> : outlineTarget&&(tool==='select'||editingOutline)&&!selectedParts.length ? <OutlineEditor onAttachStair={end=>{setTool('outline-edit');setPanel('inspector');stairAttachment.start(outlineTarget.id,end);}} key={outlineTarget.id} part={outlineTarget} level={selectedLevel} editing={editingOutline} editor={editor} handle={outlineHandle} onHandle={setOutlineHandle} snapping={snapping} onSnapping={setSnapping} onFrame={frame} onFinish={finishOutlineEdit} onSelect={select} status={outlineStatus} onStatus={setOutlineStatus}/> : wallTarget&&!focusedOpening&&(tool==='select'||editingWall)&&!selectedParts.length ? <WallEditor wall={wallTarget} level={selectedLevel} editing={editingWall} editor={editor} snapping={snapping} onSnapping={setSnapping} onFrame={frame} onFinish={finishWallEdit} onSelect={select} status={wallStatus} onStatus={setWallStatus}/> : editingOpening ? <OpeningEditor onFrame={frame} wall={focusedOpening?openingHost:undefined} opening={focusedOpening} editor={editor} levels={placementFloors} levelId={placementLevel?.id} onLevel={id=>{editor.cancel();editor.select(id);setOpeningFocus(null);setOpeningStatus('Click a tinted opening on this floor.');frame();}} onSelect={(wallId,openingId)=>focusOpening({wallId,openingId})} snapping={snapping} onSnapping={setSnapping} onFinish={finishOpeningEdit} status={openingStatus} onStatus={setOpeningStatus}/> : tool==='select'&&focusedOpening&&openingHost ? <OpeningSelectionSummary wall={openingHost} opening={focusedOpening} level={selectedLevel} onFrame={frame}/> : placingOpening ? <OpeningTools project={project} kind={openingSettings.kind} dimensions={dimensions} onDimensions={value=>setOpeningDimensions(old=>({...old,[openingSettings.kind]:value}))} snapping={snapping} onSnapping={setSnapping} levels={placementFloors} levelId={placementLevel?.id} onLevel={id=>{editor.select(id);setOpeningStatus('Point at a wall to place a '+openingSettings.kind+'.');frame();}} onKind={chooseTool} onFinish={()=>chooseTool('select')} status={openingStatus}/> : state.selectedId === "terrain" ? (
            <PanelBody className="terrain-inspector">
              <PanelHeading title={<>Site terrain</>} icon={<><Mountain size={24} /></>} subtitle={<>Editable heightfield</>} />
              <InspectorSection sectionId="app-sculpt" title={<>Sculpt</>}>
                <div className="brush-kinds">
                  {(
                    [
                      { kind: "raise", label: "Raise", Icon: ArrowUp },
                      { kind: "lower", label: "Lower", Icon: ArrowDown },
                      { kind: "flatten", label: "Flatten", Icon: Equal },
                      { kind: "smooth", label: "Smooth", Icon: Sparkles },
                    ] as const
                  ).map(({ kind, label, Icon }) => (
                    <button
                      key={kind}
                      aria-pressed={brush.kind === kind}
                      disabled={!!state.gestureLabel}
                      className={brush.kind === kind ? "chosen" : ""}
                      onClick={() => {
                        setBrush((value) => ({ ...value, kind }));
                        setTool("terrain");
                      }}
                    >
                      <Icon size={17} />
                      {label}
                    </button>
                  ))}
                </div>
              </InspectorSection>
              <InspectorSection sectionId="app-brush" title={<>Brush settings</>}>
                <Field variant="range">
                  Radius<span>{brush.radius.toFixed(1)} m</span>
                  <RangeInput
                    aria-label="Brush radius"
                    min="1"
                    max="20"
                    step="0.5"
                    value={brush.radius}
                    disabled={!!state.gestureLabel}
                    onChange={(event) =>
                      setBrush((value) => ({
                        ...value,
                        radius: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
                <Field variant="range">
                  Strength<span>{Math.round(brush.strength * 100)}%</span>
                  <RangeInput
                    aria-label="Brush strength"
                    min="0.05"
                    max="1"
                    step="0.05"
                    value={brush.strength}
                    disabled={!!state.gestureLabel}
                    onChange={(event) =>
                      setBrush((value) => ({
                        ...value,
                        strength: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
                {brush.kind === "flatten" && (
                  <NumberField
                    label="Flatten elevation"
                    value={brush.target}
                    min={MIN_HEIGHT}
                    max={MAX_HEIGHT}
                    onChange={(target) =>
                      setBrush((value) => ({ ...value, target }))
                    }
                  />
                )}
              </InspectorSection>
              <TerrainMaterialFields key={`${state.revision}-${inspectorEpoch}`} materials={project.site.materials} editor={editor} onEdit={() => setTool("select")} cancel={cancelPreview} />
              <InspectorSection sectionId="app-terrain-data" title={<>Terrain data</>} defaultOpen={false}>
                <PropertyRow>
                  <span>Grid</span>
                  <span>
                    {project.site.terrain.columns} × {project.site.terrain.rows}
                  </span>
                </PropertyRow>
                <PropertyRow>
                  <span>Height range</span>
                  <span>
                    {MIN_HEIGHT} to {MAX_HEIGHT} m
                  </span>
                </PropertyRow>
                <PropertyRow>
                  <span>Preview latency</span>
                  <span>
                    {strokeTime ? `${strokeTime.toFixed(1)} ms` : "—"}
                  </span>
                </PropertyRow>
              </InspectorSection>
              <InspectorSection sectionId="terrain-stamp" title="Stamp coordinates" className="stamp-placement" defaultOpen={false}>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    previewStamp();
                  }}
                >
                  <fieldset disabled={!!state.gestureLabel}>
                    <NumberField
                      label="Stamp X"
                      value={stampPosition[0]}
                      min={-project.site.width / 2}
                      max={project.site.width / 2}
                      onChange={(x) =>
                        setStampPosition((value) => [x, value[1]])
                      }
                    />
                    <NumberField
                      label="Stamp Z"
                      value={stampPosition[1]}
                      min={-project.site.depth / 2}
                      max={project.site.depth / 2}
                      onChange={(z) =>
                        setStampPosition((value) => [value[0], z])
                      }
                    />
                    <Button variant="ghost" type="submit" className="text-button">
                      Preview stamp
                    </Button>
                  </fieldset>
                </form>
                {state.gestureLabel?.endsWith("stamp") && (
                  <Row className="stamp-actions">
                    <Button variant="default"
                      className="primary-button"
                      onClick={() => editor.commit()}
                    >
                      <Check size={14} />
                      Apply stamp
                    </Button>
                    <Button variant="ghost" className="text-button" onClick={cancelPreview}>
                      Cancel stamp
                    </Button>
                  </Row>
                )}
              </InspectorSection>
              <div className="terrain-instructions">
                <strong>
                  {state.gestureLabel ??
                    (tool === "terrain"
                      ? "Ready to sculpt"
                      : "Navigation mode")}
                </strong>
                <p>
                  Drag on the ground to sculpt. Release to commit one undo step.
                  Escape cancels the current stroke and exits sculpting.
                </p>
                <Button variant="default"
                  className="primary-button"
                  onClick={() =>
                    chooseTool(tool === "terrain" ? "select" : "terrain")
                  }
                >
                  {tool === "terrain" ? (
                    <MousePointer2 size={15} />
                  ) : (
                    <Mountain size={15} />
                  )}
                  {tool === "terrain"
                    ? "Switch to navigation"
                    : "Sculpt terrain"}
                </Button>
              </div>
              <InspectorSection sectionId="app-notes-1" title="About terrain" defaultOpen={false}><FieldMessage>
                Building elevations stay fixed while terrain changes. Water
                depth updates from the edited ground.
              </FieldMessage></InspectorSection>
            </PanelBody>
          ) : regionsOpen && (!selected||isRegion(selected)) ? (
            <RegionTools type={regionType} onType={openRegions} editor={editor} onSelect={select} onDraw={()=>{chooseTool("region");setView("top");}} onAdd={()=>addRegion()} drawing={tool==="region"}>
              {selected&&isRegion(selected)?<RegionInspector key={selected.id+"-"+state.revision+"-"+inspectorEpoch} region={selected} editor={editor} cancel={cancelPreview} snapping={snapping} onSnapping={setSnapping}/>:undefined}
            </RegionTools>
          ) : selected&&isRegion(selected) ? (
            <RegionInspector key={selected.id+"-"+state.revision+"-"+inspectorEpoch} region={selected} editor={editor} cancel={cancelPreview} snapping={snapping} onSnapping={setSnapping}/>
          ) : waterOpen && (!selected||selected.kind==="river"||selected.kind==="lake") ? (
            <WaterSystem type={waterType} onType={openWaterSystem} onDraw={()=>{chooseTool(waterType);setView("top");}} onAdd={()=>waterType==="river"?addRiver():addLake()} drawing={tool==="river"||tool==="lake"} existing={project.entities.find(e=>e.kind===waterType)} onSelectExisting={select}
              canDive={!!inlandDives[waterType]} diving={view===`${waterType}-underwater`} onDive={()=>{chooseTool('select');setView(`${waterType}-underwater`);setFrameToken(v=>v+1);}} onExitDive={()=>setView('perspective')}>
              {selected?.kind==="river"?<RiverInspector key={`${selected.id}-${state.revision}-${inspectorEpoch}`} river={selected} editor={editor} cancel={cancelPreview} playing={playing} onReset={()=>setWaterPreview(v=>({...v,riverReset:v.riverReset+1}))} onStep={()=>setWaterPreview(v=>({...v,riverStep:v.riverStep+1}))}/>:selected?.kind==="lake"?<LakeInspector key={`${selected.id}-${state.revision}-${inspectorEpoch}`} lake={selected} editor={editor} cancel={cancelPreview} playing={playing} onReset={()=>setWaterPreview(v=>({...v,lakeReset:v.lakeReset+1}))} onStep={()=>setWaterPreview(v=>({...v,lakeStep:v.lakeStep+1}))} snapping={snapping} onSnapping={setSnapping}/>:undefined}
            </WaterSystem>
          ) : selected?.kind === "lake" ? (
            <LakeInspector key={`${selected.id}-${state.revision}-${inspectorEpoch}`} lake={selected} editor={editor} cancel={cancelPreview} playing={playing} onReset={()=>setWaterPreview(v=>({...v,lakeReset:v.lakeReset+1}))} onStep={()=>setWaterPreview(v=>({...v,lakeStep:v.lakeStep+1}))} snapping={snapping} onSnapping={setSnapping}/>
          ) : selected?.kind === "path" ? (
            <PathInspector onCorner={index=>{setRouteCornerIndex(index);}} key={`${selected.id}-${state.revision}-${inspectorEpoch}`} path={selected} editor={editor} cancel={cancelPreview} snapping={snapping} onSnapping={setSnapping} onRedraw={()=>startPathDrawing()} />
          ) : selected?.kind === "river" ? (
            <RiverInspector
              key={`${selected.id}-${state.revision}-${inspectorEpoch}`}
              river={selected}
              editor={editor}
              cancel={cancelPreview}
              playing={playing}
              onReset={()=>setWaterPreview(value=>({...value,riverReset:value.riverReset+1}))}
              onStep={()=>setWaterPreview(value=>({...value,riverStep:value.riverStep+1}))}
            />
          ) : selected&&(selected.kind==='unit'||selected.kind==='building') ? (
            <ArchitectureGroupInspector key={`${selected.id}-${state.revision}`} id={selected.id} project={project} editor={editor} select={select} guard={guard}/>
          ) : selected &&
            selected.kind !== "block" &&
            selected.kind !== "ocean" ? (
            <ConstructionInspector
              onSelectRouteCorner={index=>setRouteCornerIndex(index)}


              onFrameRoute={()=>{setView('top');frame();}}
              onDrawPath={startPathDrawing}
              key={`${selected.id}-${state.revision}-${inspectorEpoch}`}
              selected={selected}
              project={project}
              editor={editor}
              preview={preview}
              cancel={cancelPreview}
              onSelect={select}
              guard={guard}
            />
          ) : selected ? (
            <PanelForm
              key={`${selected.id}-${state.revision}-${inspectorEpoch}`}
              onInputCapture={() =>
                guard(() => {
                  if (!editor.getSnapshot().gestureLabel)
                    editor.begin(`Edit ${selected.name}`);
                })
              }
              onSubmit={(event) => {
                event.preventDefault();
                guard(() => editor.commit());
              }}
            >
              <PanelHeading title={<>{selected.name}</>} icon={<>{selected.kind === "block" ? (
                    <Box size={23} strokeWidth={1.4} />
                  ) : (
                    <Waves size={24} strokeWidth={1.4} />
                  )}</>} subtitle={<>{selected.kind === "block"
                      ? "Massing block"
                      : "Directional ocean surface"}</>} />
              <InspectorSection sectionId="app-object" title={<>Object</>}>
                <Field>
                  Name
                  <TextInput
                    aria-label="Object name"
                    value={selected.name}
                    maxLength={80}
                    onChange={(event) => {
                      if (event.target.value.trim())
                        preview({ ...selected, name: event.target.value });
                    }}
                  />
                </Field>
                <PropertyRow>
                  <span>Parent</span>
                  <span>
                    <Mountain size={13} />
                    Site
                  </span>
                </PropertyRow>
              </InspectorSection>
              {selected.kind === "block" ? (
                <>
                  <InspectorSection sectionId="app-dimensions" title={<>Dimensions<span>METERS</span></>}>
                    <FieldGrid columns={3}>
                      {(["Width", "Height", "Depth"] as const).map(
                        (label, index) => (
                          <NumberField
                            key={label}
                            label={label}
                            value={selected.size[index]}
                            min={0.2}
                            max={100}
                            onChange={(value) => {
                              const size: Block["size"] = [...selected.size];
                              size[index] = value;
                              changeBlock({ size });
                            }}
                          />
                        ),
                      )}
                    </FieldGrid>
                  </InspectorSection>
                  <InspectorSection sectionId="app-position" title={<>Position<span>LOCAL</span></>}>
                    <FieldGrid columns={3}>
                      {(
                        ["X position", "Y position", "Z position"] as const
                      ).map((label, index) => (
                        <NumberField
                          key={label}
                          label={label}
                          value={selected.position[index]}
                          min={index === 1 ? -50 : -500}
                          max={index === 1 ? 100 : 500}
                          onChange={(value) => {
                            const position: Block["position"] = [
                              ...selected.position,
                            ];
                            position[index] = value;
                            changeBlock({ position });
                          }}
                        />
                      ))}
                    </FieldGrid>
                    <NumberField
                      label="Rotation"
                      value={selected.rotation}
                      min={-360}
                      max={360}
                      step={1}
                      unit="°"
                      onChange={(rotation) => changeBlock({ rotation })}
                    />
                  </InspectorSection>
                </>
              ) : (
                <InspectorSection sectionId="app-ocean-waves" title={<>Ocean and waves</>}>
                  <FieldGrid columns={2}>
                    <NumberField
                      label="Water level"
                      value={selected.level}
                      min={-8}
                      max={8}
                      onChange={(level) => changeOcean({ level })}
                    />
                    <NumberField
                      label="Wave amplitude"
                      value={selected.amplitude}
                      min={0}
                      max={0.8}
                      step={0.02}
                      onChange={(amplitude) => changeOcean({ amplitude })}
                    />
                    <NumberField
                      label="Wavelength"
                      value={selected.wavelength}
                      min={4}
                      max={40}
                      onChange={(wavelength) => changeOcean({ wavelength })}
                    />
                    <NumberField
                      label="Travel direction"
                      value={selected.direction}
                      min={0}
                      max={360}
                      step={1}
                      unit="°"
                      onChange={(direction) => changeOcean({ direction })}
                    />
                    <NumberField
                      label="Wave speed"
                      value={selected.speed}
                      min={0}
                      max={3}
                      step={0.1}
                      unit="×"
                      onChange={(speed) => changeOcean({ speed })}
                    />
                  </FieldGrid>
                  <FieldMessage>
                    Travel direction: 0° toward +X, 90° toward +Z. Wavelength is
                    the main crest spacing. Wave fronts follow the evaluated
                    terrain into the shoreline.
                  </FieldMessage>
                </InspectorSection>
              )}
              {selected.kind === "ocean" && (
                <CoastFields
                  ocean={selected}
                  onChange={changeOcean}
                  playing={playing}
                  editing={!!state.gestureLabel}
                  onReset={() =>
                    setWaterPreview((value) => ({
                      ...value,
                      reset: value.reset + 1,
                    }))
                  }
                  onStep={() =>
                    setWaterPreview((value) => ({
                      ...value,
                      step: value.step + 1,
                    }))
                  }
                />
              )}
              {selected.kind === "ocean" && <WaterMaterialFields appearance={selected.appearance} color={selected.color} onChange={changeOcean} />}
              <InspectorSection sectionId="app-appearance" title={<>Appearance</>} defaultOpen={false}>
                <Field variant="color">
                  <ColorInput
                    aria-label="Object color"
                    value={selected.color}
                    onChange={(event) =>
                      preview({ ...selected, color: event.target.value })
                    }
                  />
                  <span>Base color</span>
                  <code>{selected.color.toUpperCase()}</code>
                </Field>
              </InspectorSection>
              <ActionBar
                pending={!!(state.gestureLabel)}
              >
                <div>
                  <span className="status-dot" />
                  {state.gestureLabel
                    ? "Previewing changes"
                    : "All changes applied"}
                </div>
                <Button variant="default"
                  type="submit"
                  className="primary-button"
                  disabled={!state.gestureLabel}
                >
                  <Check size={15} />
                  Apply changes
                </Button>
                <Button variant="ghost"
                  type="button"
                  className="cancel-button"
                  disabled={!state.gestureLabel}
                  onClick={cancelPreview}
                >
                  <RotateCcw size={13} />
                  Cancel preview<span>Esc</span>
                </Button>
              </ActionBar>
              <ActionRow>
                {selected.kind === "block" && (
                  <Button variant="outline" size="sm"
                    type="button"
                    disabled={!!state.gestureLabel}
                    onClick={duplicate}
                  >
                    <Copy size={14} />
                    Duplicate
                  </Button>
                )}
                <Button variant="destructive" size="sm"
                  type="button"
                  disabled={!!state.gestureLabel}
                  className="delete-button"
                  onClick={() =>
                    guard(() =>
                      editor.execute(
                        { type: "remove", id: selected.id },
                        `Delete ${selected.name}`,
                      ),
                    )
                  }
                >
                  <Trash2 size={14} />
                  Delete
                </Button>
              </ActionRow>
              <InspectorSection sectionId="app-notes-2" title="About this object" defaultOpen={false}><FieldMessage>
                {selected.kind === "block"
                  ? "Concept massing. Add a building for separate levels, walls, slabs, and roofs."
                  : "Coastal motion is a visual approximation. Underwater views and physical fluid simulation remain future work."}
              </FieldMessage></InspectorSection>
            </PanelForm>
          ) : (
            <div className="empty-inspector">
              <MousePointer2 size={26} />
              <h2>Select an object</h2>
              <p>
                Pick an object in the viewport or scene list to edit its
                properties.
              </p>
            </div>
          ))}
        </InspectorPanel>
      </div>
      <nav className="mobile-panels" aria-label="Editor panels">
        <button
          className={panel === "scene" ? "chosen" : ""}
          onClick={() => setPanel("scene")}
        >
          <Layers size={15} />
          Scene
        </button>
        <button
          className={panel === "inspector" ? "chosen" : ""}
          onClick={() => setPanel("inspector")}
        >
          <Settings2 size={15} />
          Properties
        </button>
      </nav>
      {(opening || importingModel) && (
        <div className="opening-overlay" role="status">
          {importingModel
            ? "Reading and validating GLB…"
            : "Opening local project…"}
        </div>
      )}
      {storageRecovery && !opening && (
        <div className="recovery-banner" role="status">
          Autosave paused. Open a valid project, create a new site, or Save
          project to replace the unreadable local copy.
        </div>
      )}
      {projectDialog && (
        <ProjectDialog
          mode={projectDialog}
          project={state.project}
          onClose={() => setProjectDialog(null)}
          onCreate={(project) => {
            editor.replaceProject(project, "Create new site");
            select(null);
            setFrameToken((value) => value + 1);
            setView("perspective");
            setProjectDialog(null);
            setStorageReady(true);
            queueSave();
            setNotice("New site created. Undo restores the previous scene.");
          }}
          onRename={(name) => {
            editor.cancel();
            editor.execute({ type: "rename", name }, "Rename project");
            setProjectDialog(null);
          }}
        />
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {notice}
          <button
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <X size={16} />
          </button>
        </div>
      )}
      {showHelp && (
        <Dialog title="Help & About" onClose={() => setShowHelp(false)}>
          <AboutCredits />
          <span className="eyebrow">OPENLANDCRAFT / M7</span>
          <h3>{state.project.name}</h3>
          <p>
            Import a GLB or add a building from Scene. Select an object to edit
            its properties, or sculpt the terrain.
          </p>
          <dl>
            <dt>Navigate</dt>
            <dd>
              Select tool · drag to orbit · right-drag to pan · scroll to zoom
            </dd>
            <dt>Focus</dt>
            <dd>F or the frame button · smooth camera move; drag, scroll or Escape stops it</dd>
            <dt>Copy / paste selection</dt>
            <dd>Ctrl/Cmd C · Ctrl/Cmd V · independent copies in this editor; select a wall to paste a door/window</dd>
            <dt>History</dt>
            <dd>Ctrl/Cmd Z · Ctrl/Cmd Shift Z</dd>
            <dt>Drag a copy</dt>
            <dd>Alt + left-drag an element · release to place · Escape cancels</dd>
            <dt>Delete selection</dt>
            <dd>Delete or Backspace · undo restores the selection's contents</dd>
            <dt>Cancel and exit tool</dt>
            <dd>Escape · discard the current draft or preview and return to selection</dd>
            <dt>Save</dt>
            <dd>Ctrl/Cmd S · Export for a portable file</dd>
          </dl>
          <FieldMessage>
            Terrain supports raise, lower, flatten, and smooth. Drag to sculpt;
            release to commit one undo step. Coordinate stamps provide keyboard
            editing. Draw footprint creates a building from two snapped corners.
            Move, Rotate, and Scale handles commit on release. Models can follow
            the ground; buildings keep fixed elevations. Water System groups
            River and Lake tools. Draw river accepts upstream-to-downstream clicks;
            Finish commits. Drag numbered points in plan and set elevations in
            Properties. Draw lake closes a shoreline with editable level, depth,
            banks, and wind waves. Ocean has its own controls. Draw path creates a terrain-following route with editable
            points, width, and surface. Endpoints can snap to building edges. Landscape regions adds surface materials and seeded planting areas. Preview regeneration before Apply; editing an individual plant detaches it from regeneration.
          </FieldMessage>
          <RendererInfo source={metricsSource}/>
        </Dialog>
      )}
    </div>
  );
}
