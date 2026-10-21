import {
  useLayoutEffect,
  useRef,
  type PointerEvent,
  type RefObject,
} from "react";
import { Home } from "lucide-react";
import { Matrix4, Quaternion, Vector3 } from "three";
import { orientationDirections, type OrientationView } from "./navigation";
import "./view-navigator.css";

export type NavigationBridge = {
  snap?: (view: OrientationView) => void;
  rotate?: (dx: number, dy: number) => void;
  stop?: () => void;
  sync?: (rotation: Quaternion) => void;
};
const faces = ["front", "back", "left", "right", "top", "bottom"] as const;

export function ViewNavigator({
  bridge,
}: {
  bridge: RefObject<NavigationBridge>;
}) {
  const cube = useRef<HTMLDivElement>(null);
  const ball = useRef<HTMLDivElement>(null);
  const buttons = useRef<Partial<Record<OrientationView, HTMLButtonElement>>>(
    {},
  );
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    startX: number;
    startY: number;
    moved: boolean;
    capture: HTMLElement;
  } | null>(null);
  const suppressClick = useRef(false);
  useLayoutEffect(() => {
    const inverse = new Quaternion(),
      previous = new Quaternion(0, 0, 0, 0),
      matrix = new Matrix4(),
      normal = new Vector3();
    bridge.current.sync = (rotation) => {
      if (previous.equals(rotation)) return;
      previous.copy(rotation);
      inverse.copy(rotation).invert();
      matrix.makeRotationFromQuaternion(inverse);
      // CSS has a downward Y axis; convert both input and output coordinates.
      const values = matrix.elements.map(
        (value, index) =>
          value *
          (index % 4 === 1 ? -1 : 1) *
          (Math.floor(index / 4) === 1 ? -1 : 1),
      );
      if (cube.current)
        cube.current.style.transform = `matrix3d(${values.join(",")})`;
      for (const face of faces) {
        const button = buttons.current[face];
        if (!button) continue;
        const z = normal
          .fromArray(orientationDirections[face])
          .applyQuaternion(inverse).z;
        button.style.visibility = z > 0.015 ? "visible" : "hidden";
        button.tabIndex = z > 0.015 ? 0 : -1;
        button.setAttribute("aria-pressed", String(z > 0.9999));
      }
    };
    return () => {
      delete bridge.current.sync;
    };
  }, [bridge]);
  const finish = () => {
    const active = drag.current;
    drag.current = null;
    ball.current?.removeAttribute("data-dragging");
    if (active?.capture.hasPointerCapture(active.id))
      active.capture.releasePointerCapture(active.id);
  };
  useLayoutEffect(() => {
    window.addEventListener("blur", finish);
    return () => {
      window.removeEventListener("blur", finish);
      finish();
    };
  }, []);
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || drag.current) return;
    bridge.current.stop?.();
    suppressClick.current = false;
    const capture = event.target as HTMLElement;
    capture.setPointerCapture(event.pointerId);
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      capture,
    };
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    if (
      !active.moved &&
      Math.hypot(event.clientX - active.startX, event.clientY - active.startY) <
        4
    )
      return;
    if (!active.moved) ball.current?.focus({ preventScroll: true });
    active.moved = true;
    suppressClick.current = true;
    ball.current?.setAttribute("data-dragging", "true");
    bridge.current.rotate?.(event.clientX - active.x, event.clientY - active.y);
    active.x = event.clientX;
    active.y = event.clientY;
  };
  return (
    <div
      className="view-navigator"
      role="group"
      aria-label="View navigator"
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        const offsets: Record<string, [number, number]> = {
          ArrowLeft: [-12, 0],
          ArrowRight: [12, 0],
          ArrowUp: [0, -12],
          ArrowDown: [0, 12],
        };
        if (offsets[event.key]) {
          event.preventDefault();
          ball.current?.focus({ preventScroll: true });
          bridge.current.rotate?.(...offsets[event.key]);
        }
        if (event.key === "Home") {
          event.preventDefault();
          bridge.current.snap?.("perspective");
        }
        if (event.key === "Escape") {
          bridge.current.stop?.();
          finish();
        }
      }}
    >
      <button
        className="navigator-home"
        type="button"
        aria-label="Home view"
        title="Home view"
        onClick={() => bridge.current.snap?.("perspective")}
      >
        <Home size={15} />
      </button>
      <div
        ref={ball}
        className="navigator-ball"
        tabIndex={0}
        role="group"
        aria-label="Drag to orbit; arrow keys rotate; Home resets orientation"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={(event) => {
          if (drag.current?.id === event.pointerId) finish();
        }}
        onPointerCancel={(event) => {
          if (drag.current?.id === event.pointerId) {
            suppressClick.current = true;
            finish();
          }
        }}
        onLostPointerCapture={finish}
        onClickCapture={(event) => {
          if (suppressClick.current && event.detail !== 0) {
            event.stopPropagation();
            event.preventDefault();
          }
        }}
      >
        <div className="navigator-ring" aria-hidden="true" />
        <div className="navigator-cube" ref={cube}>
          {faces.map((face) => (
            <button
              key={face}
              ref={(element) => {
                if (element) buttons.current[face] = element;
              }}
              type="button"
              className={`navigator-face navigator-face-${face}`}
              aria-label={`${face[0].toUpperCase() + face.slice(1)} view`}
              title={`${face[0].toUpperCase() + face.slice(1)} view`}
              onClick={() => bridge.current.snap?.(face)}
            >
              {face}
            </button>
          ))}
        </div>
      </div>
      <div className="navigator-presets" aria-label="Quick views">
        {(["front", "back", "top"] as const).map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => bridge.current.snap?.(view)}
          >
            {view}
          </button>
        ))}
      </div>
      {/* <span className="navigator-hint">Drag to orbit</span> */}
    </div>
  );
}
