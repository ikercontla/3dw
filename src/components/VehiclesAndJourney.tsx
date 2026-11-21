import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { DOCK_X, JOURNEY_STAGES } from "@/data/layout";
import type {
  JourneySeek,
  ResponsableAlmacen,
  TarimaInventoryItem,
  Transportista,
  ViewMode,
} from "@/types/wms";
import { usePlaybackClock } from "./PlaybackClock";
import {
  Block,
  SceneText,
  SelectionMark,
} from "./SceneText";
import { TayoProductMesh } from "./TayoProductMeshes";

interface VehiclesAndJourneyProps {
  mode: ViewMode;
  animate: boolean;
  journeyRunning: boolean;
  journeyStage: number;
  journeyRunId: number;
  playbackSpeed: number;
  playbackPaused: boolean;
  journeySeek: JourneySeek | null;
  journeyClock?: MutableRefObject<number>;
  journeyPalletPosRef: MutableRefObject<THREE.Vector3>;
  forkliftPositionsRef: MutableRefObject<Record<string, THREE.Vector3>>;
  responsables: ResponsableAlmacen[];
  transportistas: Transportista[];
  selectedId: string;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onJourneyStage: (stage: number) => void;
  onJourneyFinish: () => void;
}

const TOTAL_JOURNEY_DURATION = 16; // seconds at 1x speed
const TRAVEL_SPAN = 0.88; // 0.00..0.88 moves across stages 0->4; 0.88..1.00 dwells at stage 4
const STAGE_START_NORM = [0, 0.22, 0.44, 0.66, 0.88] as const;

// Piecewise waypoints between consecutive JOURNEY_STAGES so the pallet follows aisles cleanly
const JOURNEY_SEGMENTS: [number, number, number][][] = [
  // 0 -> 1: ENT [-29, 0.2, -10] -> ALM [-14, 3.05, -29.5]
  [
    [-29, 0.2, -10],
    [-29, 0.2, -21],
    [-14, 0.2, -21],
    [-14, 0.2, -26.8],
    [-14, 3.05, -26.8],
    [-14, 3.05, -29.5],
  ],
  // 1 -> 2: ALM [-14, 3.05, -29.5] -> SLO [-6, 0.25, -17.5]
  [
    [-14, 3.05, -29.5],
    [-14, 3.05, -26.8],
    [-14, 0.25, -26.8],
    [-14, 0.25, -21],
    [-6, 0.25, -21],
    [-6, 0.25, -17.5],
  ],
  // 2 -> 3: SLO [-6, 0.25, -17.5] -> STG [-3.5, 0.15, -2.2]
  [
    [-6, 0.25, -17.5],
    [-6, 0.2, -15],
    [-6, 0.2, -8.5],
    [-3.5, 0.2, -8.5],
    [-3.5, 0.15, -2.2],
  ],
  // 3 -> 4: STG [-3.5, 0.15, -2.2] -> SAL [0, 0.2, 6.2]
  [
    [-3.5, 0.15, -2.2],
    [-3.5, 0.18, 0.5],
    [0, 0.2, 0.5],
    [0, 0.2, 6.2],
  ],
];

const HERO_JOURNEY_ITEM: Pick<
  TarimaInventoryItem,
  "codigo_cat" | "codigo_col" | "codigo_mod" | "sku"
> = {
  codigo_cat: "CEL",
  codigo_mod: "HEX",
  codigo_col: "TC",
  sku: "CEL-HEX-TC-30",
};

interface SegmentLengths {
  points: THREE.Vector3[];
  cumLengths: number[];
  totalLength: number;
}

const PRECOMPUTED_SEGMENTS: SegmentLengths[] = JOURNEY_SEGMENTS.map((pts) => {
  const vectors = pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const cumLengths: number[] = [0];
  let acc = 0;
  for (let i = 1; i < vectors.length; i++) {
    acc += vectors[i].distanceTo(vectors[i - 1]);
    cumLengths.push(acc);
  }
  return { points: vectors, cumLengths, totalLength: Math.max(acc, 0.001) };
});

const FULL_ROUTE_LINE: [number, number, number][] = JOURNEY_SEGMENTS.flatMap(
  (seg, idx) => (idx === 0 ? seg : seg.slice(1))
);

function sampleJourneyPosition(progress: number, out: THREE.Vector3): THREE.Vector3 {
  const clamped = THREE.MathUtils.clamp(progress, 0, 1);
  if (clamped >= TRAVEL_SPAN) {
    const last = JOURNEY_STAGES[JOURNEY_STAGES.length - 1].position;
    return out.set(last[0], last[1], last[2]);
  }
  const travelProgress = clamped / TRAVEL_SPAN;
  const scaled = travelProgress * PRECOMPUTED_SEGMENTS.length;
  const segIdx = Math.min(PRECOMPUTED_SEGMENTS.length - 1, Math.floor(scaled));
  const segT = scaled - segIdx;
  // Smooth ease-in-out within each stage leg
  const easedT = segT * segT * (3 - 2 * segT);

  const seg = PRECOMPUTED_SEGMENTS[segIdx];
  const targetDist = easedT * seg.totalLength;

  for (let i = 1; i < seg.points.length; i++) {
    if (targetDist <= seg.cumLengths[i] || i === seg.points.length - 1) {
      const prevD = seg.cumLengths[i - 1];
      const span = Math.max(seg.cumLengths[i] - prevD, 0.0001);
      const localT = THREE.MathUtils.clamp((targetDist - prevD) / span, 0, 1);
      return out.lerpVectors(seg.points[i - 1], seg.points[i], localT);
    }
  }
  return out.copy(seg.points[0]);
}

interface ForkliftLane {
  axis: "x" | "z";
  fixed: number;
  min: number;
  max: number;
  speed: number;
  phase: number;
}

const FORKLIFT_LANES: ForkliftLane[] = [
  { axis: "x", fixed: -21.0, min: -24, max: 20, speed: 0.24, phase: 0.2 },
  { axis: "x", fixed: -8.5, min: -25, max: 20, speed: 0.21, phase: 1.7 },
  { axis: "x", fixed: -15.0, min: -20, max: 16, speed: 0.27, phase: 3.1 },
  { axis: "x", fixed: -26.8, min: -20, max: 16, speed: 0.22, phase: 4.5 },
  { axis: "z", fixed: 25.0, min: -28, max: -4, speed: 0.25, phase: 2.4 },
];

const CARRIER_ACCENT_COLORS = [
  "#2d68e8",
  "#c66b4e",
  "#0f766e",
  "#475569",
  "#b45309",
];

function shortCarrier(name: string): string {
  const clean = name.replace(/^(Transportes|Logística|Fletes|Carga)\s+/i, "");
  return clean.length > 14 ? `${clean.slice(0, 13)}…` : clean;
}

interface CargoTruckProps {
  transportista: Transportista;
  dockX: number;
  dockIndex: number;
  accentColor: string;
  isActiveDispatch: boolean;
  selected: boolean;
  hovered: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

function CargoTruck({
  transportista,
  dockX,
  dockIndex,
  accentColor,
  isActiveDispatch,
  selected,
  hovered,
  onSelect,
  onHover,
}: CargoTruckProps) {
  const truckGroupRef = useRef<THREE.Group>(null);
  const { clockRef } = usePlaybackClock();
  const id = `truck:${transportista.id_transportista}`;

  useFrame(() => {
    if (!truckGroupRef.current) return;
    if (isActiveDispatch) {
      const bob = Math.sin(clockRef.current * 4.5) * 0.035;
      truckGroupRef.current.position.y = bob;
    } else {
      truckGroupRef.current.position.y = 0;
    }
  });

  const hitMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    []
  );

  return (
    <group position={[dockX, 0, 11.4]}>
      <group ref={truckGroupRef}>
        {/* Clickable collider around entire truck */}
        <mesh
          material={hitMat}
          position={[0, 1.7, 0]}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(id);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = "pointer";
            onHover(id);
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            document.body.style.cursor = "auto";
            onHover(null);
          }}
        >
          <boxGeometry args={[3.1, 3.5, 10.6]} />
        </mesh>

        {/* Trailer box (backed up near z = 5.4 dock apron) */}
        <Block
          position={[0, 1.85, -1.6]}
          scale={[2.5, 2.7, 7.6]}
          color="#f8fafc"
          roughness={0.62}
        />
        {/* Side accent stripe */}
        <Block
          position={[0, 1.95, -1.6]}
          scale={[2.54, 0.38, 7.2]}
          color={accentColor}
          roughness={0.5}
        />
        {/* Trailer chassis */}
        <Block
          position={[0, 0.48, -1.6]}
          scale={[2.1, 0.32, 7.4]}
          color="#334155"
        />

        {/* Tractor cab (facing +Z outward from dock) */}
        <Block
          position={[0, 1.55, 3.45]}
          scale={[2.35, 2.2, 2.15]}
          color="#e2e8f0"
          roughness={0.55}
        />
        {/* Cab hood / nose */}
        <Block
          position={[0, 1.05, 4.75]}
          scale={[2.2, 1.2, 1.05]}
          color="#f1f5f9"
          roughness={0.55}
        />
        {/* Windshield & side glass */}
        <Block
          position={[0, 2.02, 4.52]}
          scale={[2.05, 0.72, 0.14]}
          color="#334155"
          roughness={0.2}
          metalness={0.35}
        />
        <Block
          position={[0, 1.95, 3.45]}
          scale={[2.4, 0.65, 1.3]}
          color="#334155"
          roughness={0.2}
          metalness={0.35}
        />
        {/* Grille */}
        <Block position={[0, 0.95, 5.3]} scale={[1.45, 0.72, 0.08]} color="#475569" />

        {/* 6 Wheels (3 axles) */}
        {[-3.6, -2.4, 3.35, 4.55].map((wz) =>
          [-1.15, 1.15].map((wx) => (
            <Block
              key={`wh-${wz}-${wx}`}
              position={[wx, 0.42, wz]}
              scale={[0.32, 0.84, 0.84]}
              color="#1e293b"
              roughness={0.8}
            />
          ))
        )}

        {/* Roof carrier badge */}
        <SceneText
          text={`D${dockIndex + 1} · ${shortCarrier(transportista.empresa_transportista)}`}
          position={[0, 3.24, -1.6]}
          rotation={[-Math.PI / 2, 0, Math.PI / 2]}
          fontSize={0.48}
          maxWidth={6.8}
          color="#1e293b"
        />
      </group>

      {selected && (
        <SelectionMark
          position={[0, 0.03, 0]}
          size={[3.5, 11.2]}
          color="#2d68e8"
          thickness={0.12}
        />
      )}
      {hovered && !selected && (
        <SelectionMark
          position={[0, 0.025, 0]}
          size={[3.4, 11.1]}
          color="#60a5fa"
          thickness={0.09}
          opacity={0.78}
        />
      )}
      {isActiveDispatch && !selected && (
        <SelectionMark
          position={[0, 0.03, 0]}
          size={[3.6, 11.4]}
          color="#10b981"
          thickness={0.11}
          opacity={0.85}
        />
      )}
    </group>
  );
}

interface ForkliftUnitProps {
  responsable: ResponsableAlmacen;
  lane: ForkliftLane;
  animate: boolean;
  selected: boolean;
  hovered: boolean;
  positionsRef: MutableRefObject<Record<string, THREE.Vector3>>;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

function ForkliftUnit({
  responsable,
  lane,
  animate,
  selected,
  hovered,
  positionsRef,
  onSelect,
  onHover,
}: ForkliftUnitProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { clockRef } = usePlaybackClock();
  const id = `forklift:${responsable.codigo_responsable}`;

  const hitMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    []
  );

  useFrame(() => {
    const t = animate ? clockRef.current : 0;
    const raw = Math.sin(t * lane.speed + lane.phase);
    const norm = (raw + 1) * 0.5;
    const posAlong = THREE.MathUtils.lerp(lane.min, lane.max, norm);
    const velocity = Math.cos(t * lane.speed + lane.phase);

    const x = lane.axis === "x" ? posAlong : lane.fixed;
    const z = lane.axis === "z" ? posAlong : lane.fixed;
    const yaw =
      lane.axis === "x"
        ? velocity >= 0
          ? Math.PI / 2
          : -Math.PI / 2
        : velocity >= 0
        ? 0
        : Math.PI;

    if (groupRef.current) {
      groupRef.current.position.set(x, 0, z);
      groupRef.current.rotation.y = yaw;
    }

    if (!positionsRef.current[responsable.codigo_responsable]) {
      positionsRef.current[responsable.codigo_responsable] = new THREE.Vector3();
    }
    positionsRef.current[responsable.codigo_responsable].set(x, 0, z);
  });

  return (
    <group ref={groupRef}>
      {/* Interactive hit collider */}
      <mesh
        material={hitMat}
        position={[0, 1.15, 0.2]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
          onHover(id);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "auto";
          onHover(null);
        }}
      >
        <boxGeometry args={[1.65, 2.3, 2.8]} />
      </mesh>

      {/* Forklift main body */}
      <Block position={[0, 0.58, -0.15]} scale={[1.18, 0.72, 1.75]} color="#d97742" />
      {/* Counterweight rear */}
      <Block position={[0, 0.62, -0.92]} scale={[1.18, 0.78, 0.45]} color="#334155" />
      {/* Overhead protective cage */}
      <Block position={[-0.48, 1.45, -0.65]} scale={[0.08, 1.15, 0.08]} color="#1e293b" />
      <Block position={[0.48, 1.45, -0.65]} scale={[0.08, 1.15, 0.08]} color="#1e293b" />
      <Block position={[-0.48, 1.45, 0.35]} scale={[0.08, 1.15, 0.08]} color="#1e293b" />
      <Block position={[0.48, 1.45, 0.35]} scale={[0.08, 1.15, 0.08]} color="#1e293b" />
      <Block position={[0, 2.02, -0.15]} scale={[1.08, 0.08, 1.12]} color="#1e293b" />
      {/* Amber safety beacon */}
      <Block
        position={[0, 2.16, -0.45]}
        scale={[0.16, 0.18, 0.16]}
        color="#f59e0b"
        emissive="#f59e0b"
        emissiveIntensity={0.65}
      />
      {/* Operator torso & helmet */}
      <Block position={[0, 1.22, -0.18]} scale={[0.42, 0.55, 0.36]} color="#2563eb" />
      <Block position={[0, 1.62, -0.18]} scale={[0.26, 0.24, 0.26]} color="#facc15" />

      {/* Vertical mast & front forks */}
      <Block position={[-0.35, 1.35, 0.86]} scale={[0.12, 2.25, 0.14]} color="#1e293b" />
      <Block position={[0.35, 1.35, 0.86]} scale={[0.12, 2.25, 0.14]} color="#1e293b" />
      <Block position={[0, 0.45, 0.88]} scale={[0.85, 0.25, 0.1]} color="#475569" />
      <Block position={[-0.28, 0.14, 1.42]} scale={[0.12, 0.06, 1.05]} color="#64748b" />
      <Block position={[0.28, 0.14, 1.42]} scale={[0.12, 0.06, 1.05]} color="#64748b" />

      {/* 4 Wheels */}
      {[-0.65, 0.45].map((wz) =>
        [-0.6, 0.6].map((wx) => (
          <Block
            key={`fwh-${wz}-${wx}`}
            position={[wx, 0.22, wz]}
            scale={[0.22, 0.44, 0.44]}
            color="#0f172a"
          />
        ))
      )}

      {/* Operator badge when selected/hovered */}
      {(selected || hovered) && (
        <SceneText
          text={responsable.codigo_responsable}
          position={[0, 2.65, 0]}
          fontSize={0.34}
          color="#ffffff"
          background="#2d68e8"
          billboard
        />
      )}

      {selected && (
        <SelectionMark
          position={[0, 0.03, 0.15]}
          size={[1.9, 3.0]}
          color="#2d68e8"
          thickness={0.09}
        />
      )}
      {hovered && !selected && (
        <SelectionMark
          position={[0, 0.025, 0.15]}
          size={[1.85, 2.95]}
          color="#60a5fa"
          thickness={0.07}
          opacity={0.78}
        />
      )}
    </group>
  );
}

export function VehiclesAndJourney({
  mode,
  animate,
  journeyRunning,
  journeyStage,
  journeyRunId,
  playbackSpeed,
  playbackPaused,
  journeySeek,
  journeyClock,
  journeyPalletPosRef,
  forkliftPositionsRef,
  responsables,
  transportistas,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  onJourneyStage,
  onJourneyFinish,
}: VehiclesAndJourneyProps) {
  const journeyPalletGroupRef = useRef<THREE.Group>(null);
  const elapsedRef = useRef(0);
  const lastEmittedStageRef = useRef(0);
  const finishedEmittedRef = useRef(false);
  const lastRunIdRef = useRef(journeyRunId);
  const lastSeekKeyRef = useRef<number | null>(null);
  const tempPosRef = useRef(new THREE.Vector3(...JOURNEY_STAGES[0].position));

  const onJourneyStageRef = useRef(onJourneyStage);
  const onJourneyFinishRef = useRef(onJourneyFinish);
  useEffect(() => {
    onJourneyStageRef.current = onJourneyStage;
    onJourneyFinishRef.current = onJourneyFinish;
  }, [onJourneyStage, onJourneyFinish]);

  const hitMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    []
  );

  // Reset journey timeline whenever a new journey run starts
  useEffect(() => {
    if (journeyRunId !== lastRunIdRef.current) {
      lastRunIdRef.current = journeyRunId;
      elapsedRef.current = 0;
      lastEmittedStageRef.current = 0;
      finishedEmittedRef.current = false;
      if (journeyClock) journeyClock.current = 0;
      const p0 = JOURNEY_STAGES[0].position;
      journeyPalletPosRef.current.set(p0[0], p0[1], p0[2]);
    }
  }, [journeyRunId, journeyClock, journeyPalletPosRef]);

  // Respond to explicit seek commands (stage pill clicks or arrow keys)
  useEffect(() => {
    if (!journeySeek) return;
    if (journeySeek.key === lastSeekKeyRef.current) return;
    lastSeekKeyRef.current = journeySeek.key;

    const clampedStage = THREE.MathUtils.clamp(
      journeySeek.stage,
      0,
      JOURNEY_STAGES.length - 1
    );
    const norm = STAGE_START_NORM[clampedStage] ?? 0;
    elapsedRef.current = norm * TOTAL_JOURNEY_DURATION;
    lastEmittedStageRef.current = clampedStage;
    finishedEmittedRef.current = false;
    if (journeyClock) journeyClock.current = norm;

    const targetPos = JOURNEY_STAGES[clampedStage].position;
    journeyPalletPosRef.current.set(targetPos[0], targetPos[1], targetPos[2]);
  }, [journeySeek, journeyClock, journeyPalletPosRef]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);

    if (journeyRunning) {
      if (!playbackPaused) {
        elapsedRef.current = Math.min(
          TOTAL_JOURNEY_DURATION,
          elapsedRef.current + dt * playbackSpeed
        );
      }
      const progress = elapsedRef.current / TOTAL_JOURNEY_DURATION;
      if (journeyClock) {
        journeyClock.current = progress;
      }

      const activeStage =
        progress >= TRAVEL_SPAN
          ? JOURNEY_STAGES.length - 1
          : Math.min(
              JOURNEY_STAGES.length - 2,
              Math.floor((progress / TRAVEL_SPAN) * 4)
            );

      if (activeStage !== lastEmittedStageRef.current) {
        lastEmittedStageRef.current = activeStage;
        onJourneyStageRef.current(activeStage);
      }

      if (progress >= 1 && !finishedEmittedRef.current) {
        finishedEmittedRef.current = true;
        onJourneyFinishRef.current();
      }

      sampleJourneyPosition(progress, tempPosRef.current);
      journeyPalletPosRef.current.copy(tempPosRef.current);
    } else {
      const clamped = THREE.MathUtils.clamp(
        journeyStage,
        0,
        JOURNEY_STAGES.length - 1
      );
      const norm = STAGE_START_NORM[clamped] ?? 0;
      if (journeyClock) {
        journeyClock.current = norm;
      }
      const stagePos = JOURNEY_STAGES[clamped].position;
      tempPosRef.current.set(stagePos[0], stagePos[1], stagePos[2]);
      journeyPalletPosRef.current.lerp(
        tempPosRef.current,
        1 - Math.exp(-dt * 9)
      );
    }

    if (journeyPalletGroupRef.current) {
      journeyPalletGroupRef.current.position.copy(journeyPalletPosRef.current);
    }
  });

  const activeForkliftOperators = useMemo(
    () => responsables.filter((r) => r.activo).slice(0, FORKLIFT_LANES.length),
    [responsables]
  );

  const journeySelected = selectedId === "journey:pallet";
  const journeyHovered = hoveredId === "journey:pallet";
  const showJourneyGuide =
    mode === "interior" && (journeyRunning || journeySelected);

  return (
    <group>
      {/* ==================== 5 TRANSPORTISTA TRUCKS AT DOCK_X ==================== */}
      {transportistas.slice(0, DOCK_X.length).map((carrier, idx) => {
        const key = `truck:${carrier.id_transportista}`;
        return (
          <CargoTruck
            key={carrier.id_transportista}
            transportista={carrier}
            dockX={DOCK_X[idx]}
            dockIndex={idx}
            accentColor={CARRIER_ACCENT_COLORS[idx % CARRIER_ACCENT_COLORS.length]}
            isActiveDispatch={journeyRunning && journeyStage === 4 && idx === 2}
            selected={selectedId === key}
            hovered={hoveredId === key}
            onSelect={onSelect}
            onHover={onHover}
          />
        );
      })}

      {/* ==================== ACTIVE FORKLIFTS IN Z-ALM & Z-STAG ==================== */}
      {activeForkliftOperators.map((op, idx) => {
        const key = `forklift:${op.codigo_responsable}`;
        return (
          <ForkliftUnit
            key={op.id_responsable_almacen}
            responsable={op}
            lane={FORKLIFT_LANES[idx]}
            animate={animate}
            selected={selectedId === key}
            hovered={hoveredId === key}
            positionsRef={forkliftPositionsRef}
            onSelect={onSelect}
            onHover={onHover}
          />
        );
      })}

      {/* ==================== GUIDED 5-STAGE TARIMA JOURNEY ==================== */}
      {showJourneyGuide && (
        <group>
          <Line
            points={FULL_ROUTE_LINE}
            color="#2d68e8"
            lineWidth={2.5}
            dashed
            dashSize={0.7}
            gapSize={0.45}
            transparent
            opacity={0.72}
          />
          {JOURNEY_STAGES.map((st) => {
            const isActive = st.index === journeyStage;
            return (
              <group key={st.code} position={st.position}>
                <SelectionMark
                  position={[0, 0.02, 0]}
                  size={[2.3, 2.3]}
                  color={isActive ? "#2d68e8" : "#93c5fd"}
                  thickness={isActive ? 0.1 : 0.06}
                  opacity={isActive ? 0.95 : 0.6}
                />
                <SceneText
                  text={`0${st.index + 1} · ${st.code}`}
                  position={[0, 1.55, 0]}
                  fontSize={0.32}
                  color={isActive ? "#ffffff" : "#1e3a8a"}
                  background={
                    isActive ? "#2d68e8" : "rgba(255,255,255,0.9)"
                  }
                  borderColor="#93c5fd"
                  billboard
                />
              </group>
            );
          })}
        </group>
      )}

      {/* Guided Hero Journey Pallet */}
      <group
        ref={journeyPalletGroupRef}
        position={JOURNEY_STAGES[0].position}
        visible={mode === "interior" || journeyRunning || journeySelected}
      >
        <mesh
          material={hitMat}
          position={[0, 0.68, 0]}
          onClick={(e) => {
            e.stopPropagation();
            onSelect("journey:pallet");
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = "pointer";
            onHover("journey:pallet");
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            document.body.style.cursor = "auto";
            onHover(null);
          }}
        >
          <boxGeometry args={[2.2, 1.4, 2.2]} />
        </mesh>

        {/* Autonomous AGV carrier sled base */}
        <Block
          position={[0, -0.05, 0]}
          scale={[1.76, 0.1, 1.76]}
          color="#1e293b"
          roughness={0.45}
          metalness={0.35}
        />
        <Block
          position={[0, -0.04, 0]}
          scale={[1.82, 0.04, 1.82]}
          color="#2d68e8"
          emissive="#2d68e8"
          emissiveIntensity={0.65}
        />

        {/* Wooden pallet deck */}
        <Block position={[-0.64, 0.045, 0]} scale={[0.14, 0.09, 1.56]} color="#a67c48" />
        <Block position={[0, 0.045, 0]} scale={[0.14, 0.09, 1.56]} color="#a67c48" />
        <Block position={[0.64, 0.045, 0]} scale={[0.14, 0.09, 1.56]} color="#a67c48" />
        <Block position={[0, 0.115, 0]} scale={[1.6, 0.05, 1.6]} color="#cea165" />

        {/* Terracotta Celosía Hero Load */}
        <TayoProductMesh item={HERO_JOURNEY_ITEM} position={[0, 0.14, 0]} />

        {(journeySelected || journeyRunning) && (
          <SelectionMark
            position={[0, 0.03, 0]}
            size={[2.35, 2.35]}
            color="#2d68e8"
            thickness={0.11}
          />
        )}
        {journeyHovered && !journeySelected && !journeyRunning && (
          <SelectionMark
            position={[0, 0.025, 0]}
            size={[2.28, 2.28]}
            color="#60a5fa"
            thickness={0.08}
            opacity={0.8}
          />
        )}
      </group>
    </group>
  );
}
