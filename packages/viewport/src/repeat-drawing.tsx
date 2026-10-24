import { useMemo, useState } from "react";
import { Line } from "@react-three/drei";
import { DoubleSide } from "three";
import {
  groundHeight,
  repeatLayout,
  repeatMember,
  repeatPathFromPoints,
  repeatSample,
  type Instance,
  type Project,
  type RepeatPattern,
} from "@openlandcraft/core";
import { ModelInstances } from "./objects";
import { ArchitectureLabel } from "./architecture-label";

export type RepeatDrawingProps = {
  settings: RepeatPattern;
  shape: "line" | "arc";
  points: [number, number][];
  clockwise: boolean;
  snapping: boolean;
};
export function RepeatDrawing({
  project,
  draft,
  onPoint,
  onError,
}: {
  project: Project;
  draft: RepeatDrawingProps;
  onPoint: (x: number, z: number) => void;
  onError: (error: string) => void;
}) {
  const [cursor, setCursor] = useState<[number, number] | null>(null),
    { points, shape, settings, clockwise } = draft;
  const preview = useMemo(() => {
    try {
      const needed = shape === "line" ? 2 : 3,
        ps =
          points.length === needed
            ? points
            : cursor
              ? [...points, cursor]
              : points;
      if (ps.length < needed) return null;
      const pattern = {
          ...settings,
          path: repeatPathFromPoints(shape, ps, clockwise),
        },
        layout = repeatLayout(pattern),
        source = project.entities.find((e) => e.id === settings.sourceId);
      if (!source || (source.kind !== "block" && source.kind !== "instance"))
        return null;
      const members = Array.from({ length: layout.count }, (_, i) =>
        repeatMember(source, pattern, i),
      );
      const line = Array.from({ length: shape === "line" ? 2 : 97 }, (_, i) => {
        const s = repeatSample(
          pattern,
          (layout.length * i) / (shape === "line" ? 1 : 96),
        );
        return [
          s.point[0],
          groundHeight(...s.point, project.site) + 0.12,
          s.point[1],
        ] as [number, number, number];
      });
      return { members, line, layout };
    } catch {
      return null;
    }
  }, [project, draft, cursor]);
  const centerY = groundHeight(0, 0, project.site) + 0.02;
  return (
    <group userData={{ waterCaptureExclude: true }}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, centerY, 0]}
        onPointerMove={(e) => {
          e.stopPropagation();
          setCursor(
            draft.snapping
              ? [Math.round(e.point.x * 4) / 4, Math.round(e.point.z * 4) / 4]
              : [e.point.x, e.point.z],
          );
        }}
        onPointerOut={() => setCursor(null)}
        onClick={(e) => {
          if (e.button === 0 && e.delta <= 4) {
            e.stopPropagation();
            onPoint(e.point.x, e.point.z);
          }
        }}
      >
        <planeGeometry args={[project.site.width, project.site.depth]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
      {points.map((p, i) => (
        <ArchitectureLabel
          key={i}
          position={[p[0], groundHeight(...p, project.site) + 0.4, p[1]]}
          text={shape === "arc" && i === 0 ? "Center" : `Point ${i + 1}`}
        />
      ))}
      {preview && (
        <>
          <Line
            points={preview.line}
            color="#e3b349"
            depthTest={false}
            raycast={() => undefined}
          />
          {preview.members
            .filter((e) => e.kind === "block")
            .map(
              (e) =>
                e.kind === "block" && (
                  <mesh
                    key={e.id}
                    position={[
                      e.position[0],
                      e.position[1] + e.size[1] / 2,
                      e.position[2],
                    ]}
                    rotation={[0, (e.rotation * Math.PI) / 180, 0]}
                    raycast={() => undefined}
                  >
                    <boxGeometry args={e.size} />
                    <meshStandardMaterial
                      color={e.color}
                      transparent
                      opacity={0.6}
                    />
                  </mesh>
                ),
            )}
          {project.assets.map((asset) => {
            const instances = preview.members.filter(
              (e): e is Instance =>
                e.kind === "instance" && e.assetId === asset.id,
            );
            return instances.length ? (
              <ModelInstances
                key={asset.id}
                asset={asset}
                instances={instances}
                project={project}
                selectedId={null}
                onSelect={() => {}}
                onError={onError}
                interactive={false}
                windEnabled={false}
                playing={false}
              />
            ) : null;
          })}
          <ArchitectureLabel
            position={preview.line[Math.floor(preview.line.length / 2)]}
            text={`${preview.layout.count} copies · ${preview.layout.spacing.toFixed(2)} m`}
          />
        </>
      )}
    </group>
  );
}
