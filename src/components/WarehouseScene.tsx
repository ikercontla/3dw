import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  MapControls,
  PerformanceMonitor,
} from "@react-three/drei";
import { EffectComposer, N8AO, Vignette } from "@react-three/postprocessing";
import type { MapControls as MapControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { CAMERA, DOCK_X, JOURNEY_STAGES, ZONES_LAYOUT } from "@/data/layout";
import type {
  QualityMode,
  Transportista,
  UbicacionState,
  ViewMode,
  WarehouseSceneProps,
} from "@/types/wms";
import { PlaybackClockProvider } from "./PlaybackClock";
import { WarehouseArchitecture } from "./WarehouseArchitecture";
import { WarehouseCampus } from "./WarehouseCampus";
import { WarehouseHall } from "./WarehouseHall";
import { VehiclesAndJourney } from "./VehiclesAndJourney";

export { Block, SelectionMark, SceneText } from "./SceneText";

interface LightingProps {
  mode: ViewMode;
  quality: QualityMode;
}

function Lighting({ mode, quality }: LightingProps) {
  const interior = mode === "interior";

  return (
    <>
      <color attach="background" args={["#e9f0f4"]} />
      <fog
        attach="fog"
        args={["#e9f0f4", interior ? 120 : 150, interior ? 260 : 330]}
      />
      <ambientLight intensity={interior ? 0.22 : 0.26} />
      <hemisphereLight
        args={["#ffffff", "#9fb1bd", interior ? 0.46 : 0.55]}
      />
      <directionalLight
        position={[-48, 92, 40]}
        intensity={interior ? 1.7 : 1.85}
        color="#fff5e6"
        castShadow
        shadow-mapSize={quality === "high" ? [4096, 4096] : [2048, 2048]}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-camera-near={10}
        shadow-camera-far={240}
        shadow-bias={-0.00022}
        shadow-normalBias={0.045}
      />
      <directionalLight
        position={[60, 40, -50]}
        intensity={0.28}
        color="#d8e8ff"
      />
      <Environment resolution={128} environmentIntensity={0.32} frames={1}>
        <Lightformer
          form="rect"
          intensity={1.8}
          position={[0, 40, -10]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[80, 60, 1]}
          color="#ffffff"
        />
        <Lightformer
          form="rect"
          intensity={0.9}
          position={[-60, 22, 0]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[60, 28, 1]}
          color="#dbeafe"
        />
        <Lightformer
          form="rect"
          intensity={0.9}
          position={[60, 22, 0]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[60, 28, 1]}
          color="#fef3c7"
        />
      </Environment>
    </>
  );
}

function Effects({ quality }: { quality: QualityMode }) {
  if (quality !== "high") return null;

  return (
    <EffectComposer multisampling={4} enableNormalPass={false}>
      <N8AO
        aoRadius={2.6}
        distanceFalloff={1.4}
        intensity={2.2}
        color="#26394a"
        halfRes
        quality="medium"
      />
      <Vignette offset={0.32} darkness={0.32} eskil={false} />
    </EffectComposer>
  );
}

interface FocusPose {
  target: [number, number, number];
  position: [number, number, number];
}

function resolveFocusPose(
  mode: ViewMode,
  selectedId: string,
  ubicaciones: UbicacionState[],
  transportistas: Transportista[],
  forkliftPositions: Record<string, THREE.Vector3>,
  journeyPalletPos: THREE.Vector3
): FocusPose {
  if (!selectedId || selectedId === "warehouse") {
    return CAMERA[mode];
  }

  if (selectedId.startsWith("zone:")) {
    const zonaCode = selectedId.slice(5);
    const zone = ZONES_LAYOUT.find((z) => z.id === zonaCode);
    if (zone) {
      const [zx, , zz] = zone.position;
      if (zonaCode === "Z-STAG") {
        return {
          target: [zx, 0.5, zz],
          position: [zx + 18, 24, zz + 24],
        };
      }
      return {
        target: [zx, 0.5, zz],
        position: [zx + 28, 36, zz + 30],
      };
    }
  }

  if (selectedId.startsWith("loc:")) {
    const locCode = selectedId.slice(4);
    const ubi = ubicaciones.find((u) => u.codigo_ubicacion === locCode);
    if (ubi) {
      const [x, y, z] = ubi.position3d;
      return {
        target: [x, y + 0.6, z],
        position: [x + 11, y + 13, z + 14],
      };
    }
  }

  if (selectedId.startsWith("tarima:")) {
    const tarCode = selectedId.slice(7);
    const ubi = ubicaciones.find(
      (u) => u.tarima?.codigo_tarima === tarCode
    );
    if (ubi) {
      const [x, y, z] = ubi.position3d;
      return {
        target: [x, y + 0.7, z],
        position: [x + 10.5, y + 12.5, z + 13.5],
      };
    }
    return {
      target: [-29, 0.6, -10],
      position: [-16, 14, 4],
    };
  }

  if (selectedId.startsWith("forklift:")) {
    const opCode = selectedId.slice(9);
    const pos = forkliftPositions[opCode];
    if (pos) {
      return {
        target: [pos.x, pos.y + 0.8, pos.z],
        position: [pos.x + 11, pos.y + 13, pos.z + 14],
      };
    }
  }

  if (selectedId.startsWith("truck:")) {
    const carrierId = selectedId.slice(6);
    const idx = transportistas.findIndex(
      (t) => String(t.id_transportista) === carrierId
    );
    const dockX = DOCK_X[idx >= 0 ? idx : 2] ?? 0;
    return {
      target: [dockX, 1.5, 11.4],
      position: [dockX + 14, 16, 28],
    };
  }

  if (selectedId === "journey:pallet") {
    return {
      target: [
        journeyPalletPos.x,
        journeyPalletPos.y + 0.7,
        journeyPalletPos.z,
      ],
      position: [
        journeyPalletPos.x + 12,
        journeyPalletPos.y + 14,
        journeyPalletPos.z + 15,
      ],
    };
  }

  return CAMERA[mode];
}

interface CameraRigProps {
  mode: ViewMode;
  selectedId: string;
  focusKey: number;
  following: boolean;
  ubicaciones: UbicacionState[];
  transportistas: Transportista[];
  forkliftPositionsRef: MutableRefObject<Record<string, THREE.Vector3>>;
  journeyPalletPosRef: MutableRefObject<THREE.Vector3>;
  onManualCamera: () => void;
}

function CameraRig({
  mode,
  selectedId,
  focusKey,
  following,
  ubicaciones,
  transportistas,
  forkliftPositionsRef,
  journeyPalletPosRef,
  onManualCamera,
}: CameraRigProps) {
  const { camera } = useThree();
  const controlsRef = useRef<MapControlsImpl | null>(null);
  const desiredTargetRef = useRef(new THREE.Vector3(...CAMERA.exterior.target));
  const desiredPosRef = useRef(new THREE.Vector3(...CAMERA.exterior.position));
  const followOffsetRef = useRef(new THREE.Vector3(12, 14, 16));
  const followTargetGoalRef = useRef(new THREE.Vector3());
  const followPosGoalRef = useRef(new THREE.Vector3());
  const transitionActiveRef = useRef(false);
  const wasFollowingRef = useRef(false);
  const prevModeRef = useRef<ViewMode>(mode);

  // Keep latest ubicaciones, transportistas, and onManualCamera in refs so camera only transitions on mode/selectedId/focusKey changes
  const ubicacionesRef = useRef(ubicaciones);
  const transportistasRef = useRef(transportistas);
  const onManualCameraRef = useRef(onManualCamera);
  useEffect(() => {
    ubicacionesRef.current = ubicaciones;
    transportistasRef.current = transportistas;
    onManualCameraRef.current = onManualCamera;
  }, [ubicaciones, transportistas, onManualCamera]);

  const handleControlStart = useCallback(() => {
    transitionActiveRef.current = false;
    onManualCameraRef.current();
  }, []);

  // Recompute desired camera pose whenever mode, selectedId, or focusKey changes
  useEffect(() => {
    const modeChanged = prevModeRef.current !== mode;
    prevModeRef.current = mode;

    // Closing the inspector card (selectedId === "") keeps the user's current camera unless mode switched
    if (!selectedId && !modeChanged) {
      return;
    }

    const pose = resolveFocusPose(
      mode,
      selectedId,
      ubicacionesRef.current,
      transportistasRef.current,
      forkliftPositionsRef.current,
      journeyPalletPosRef.current
    );
    desiredTargetRef.current.set(...pose.target);
    desiredPosRef.current.set(...pose.position);
    transitionActiveRef.current = true;
  }, [mode, selectedId, focusKey, forkliftPositionsRef, journeyPalletPosRef]);

  // Establish clean follow offset when follow mode activates
  useEffect(() => {
    if (following && !wasFollowingRef.current) {
      followOffsetRef.current.set(12, 14, 16);
    }
    wasFollowingRef.current = following;
  }, [following]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    const dt = Math.min(delta, 0.05);
    const alpha = 1 - Math.exp(-dt * 3.4);

    if (following) {
      const palletPos = journeyPalletPosRef.current;
      followTargetGoalRef.current.set(palletPos.x, palletPos.y + 0.65, palletPos.z);
      followPosGoalRef.current
        .copy(followTargetGoalRef.current)
        .add(followOffsetRef.current);

      controls.target.lerp(followTargetGoalRef.current, alpha);
      camera.position.lerp(followPosGoalRef.current, alpha);
      transitionActiveRef.current = false;
    } else if (transitionActiveRef.current) {
      controls.target.lerp(desiredTargetRef.current, alpha);
      camera.position.lerp(desiredPosRef.current, alpha);

      if (
        controls.target.distanceTo(desiredTargetRef.current) < 0.06 &&
        camera.position.distanceTo(desiredPosRef.current) < 0.06
      ) {
        controls.target.copy(desiredTargetRef.current);
        camera.position.copy(desiredPosRef.current);
        transitionActiveRef.current = false;
      }
    }

    controls.update();

    // Clamp target within active mode pan bounds and shift camera uniformly
    const bounds = CAMERA.bounds[mode];
    const clampedX = THREE.MathUtils.clamp(
      controls.target.x,
      bounds.minX,
      bounds.maxX
    );
    const clampedZ = THREE.MathUtils.clamp(
      controls.target.z,
      bounds.minZ,
      bounds.maxZ
    );
    const clampedY = THREE.MathUtils.clamp(controls.target.y, 0, 8);

    const dx = clampedX - controls.target.x;
    const dy = clampedY - controls.target.y;
    const dz = clampedZ - controls.target.z;

    if (dx !== 0 || dy !== 0 || dz !== 0) {
      controls.target.set(clampedX, clampedY, clampedZ);
      camera.position.x += dx;
      camera.position.y += dy;
      camera.position.z += dz;
    }
  });

  return (
    <MapControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.1}
      minDistance={9}
      maxDistance={165}
      minPolarAngle={0.42}
      maxPolarAngle={1.2}
      target={CAMERA.exterior.target}
      onStart={handleControlStart}
    />
  );
}

export default function WarehouseScene(props: WarehouseSceneProps) {
  const {
    mode,
    selectedId,
    hoveredId,
    focusKey,
    animate,
    following,
    journeyRunning,
    journeyStage,
    journeyRunId,
    playbackSpeed,
    playbackPaused,
    quality,
    journeySeek,
    journeyClock,
    ubicaciones,
    responsables,
    transportistas,
    highlightedUbicacionIds,
    onReady,
    onJourneyStage,
    onJourneyFinish,
    onManualCamera,
    onSelect,
    onHover,
  } = props;

  const [dpr, setDpr] = useState<[number, number]>(
    quality === "high" ? [1, 2] : [1, 1.5]
  );

  useEffect(() => {
    setDpr(quality === "high" ? [1, 2] : [1, 1.5]);
  }, [quality]);

  const journeyPalletPosRef = useRef(
    new THREE.Vector3(...JOURNEY_STAGES[0].position)
  );
  const forkliftPositionsRef = useRef<Record<string, THREE.Vector3>>({});

  return (
    <Canvas
      shadows="soft"
      dpr={dpr}
      camera={{
        fov: 40,
        near: 0.5,
        far: 420,
        position: CAMERA.exterior.position,
      }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={() => onReady?.()}
      onPointerMissed={(e) => {
        if (e.type === "click") {
          onSelect("warehouse");
        }
      }}
    >
      <PerformanceMonitor
        onDecline={() => setDpr([1, 1.15])}
        onIncline={() => setDpr(quality === "high" ? [1, 2] : [1, 1.5])}
      />

      <PlaybackClockProvider speed={playbackSpeed} paused={playbackPaused}>
        <Lighting mode={mode} quality={quality} />

        <WarehouseCampus
          transportistas={transportistas}
          onSelect={onSelect}
          onHover={onHover}
        />

        <WarehouseArchitecture mode={mode} onSelect={onSelect} />

        <WarehouseHall
          ubicaciones={ubicaciones}
          selectedId={selectedId}
          hoveredId={hoveredId}
          highlightedUbicacionIds={highlightedUbicacionIds}
          onSelect={onSelect}
          onHover={onHover}
        />

        <VehiclesAndJourney
          mode={mode}
          animate={animate}
          journeyRunning={journeyRunning}
          journeyStage={journeyStage}
          journeyRunId={journeyRunId}
          playbackSpeed={playbackSpeed}
          playbackPaused={playbackPaused}
          journeySeek={journeySeek}
          journeyClock={journeyClock}
          journeyPalletPosRef={journeyPalletPosRef}
          forkliftPositionsRef={forkliftPositionsRef}
          responsables={responsables}
          transportistas={transportistas}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelect={onSelect}
          onHover={onHover}
          onJourneyStage={onJourneyStage}
          onJourneyFinish={onJourneyFinish}
        />

        <CameraRig
          mode={mode}
          selectedId={selectedId}
          focusKey={focusKey}
          following={following}
          ubicaciones={ubicaciones}
          transportistas={transportistas}
          forkliftPositionsRef={forkliftPositionsRef}
          journeyPalletPosRef={journeyPalletPosRef}
          onManualCamera={onManualCamera}
        />

        <Effects quality={quality} />
      </PlaybackClockProvider>
    </Canvas>
  );
}
