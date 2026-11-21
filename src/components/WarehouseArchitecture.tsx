import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  BUILDING,
  BUILDING_CENTER_Z,
  BUILDING_DEPTH,
  BUILDING_WIDTH,
  DOCK_X,
  OFFICE,
} from "@/data/layout";
import type { ViewMode } from "@/types/wms";
import { Block, SceneText, UNIT_BOX, noRaycast } from "./SceneText";

interface WarehouseArchitectureProps {
  mode: ViewMode;
  onSelect: (id: string) => void;
}

const PILASTER_X = [-36, -24, -12, 0, 12, 24, 36];
const PILASTER_Z = [-38, -28, -18, -8, 4];

// Front wall piers along z = BUILDING.frontZ between OFFICE (x = -24) and BUILDING.maxX (36),
// leaving 3.8m openings centered at DOCK_X = [-18, -9, 0, 9, 18].
const FRONT_WALL_PIERS: { cx: number; width: number }[] = [
  { cx: -21.95, width: 4.1 },
  { cx: -13.5, width: 5.2 },
  { cx: -4.5, width: 5.2 },
  { cx: 4.5, width: 5.2 },
  { cx: 13.5, width: 5.2 },
  { cx: 27.95, width: 16.1 },
];

const SOLAR_COLS = [-24, -14, -4, 6, 16, 26];
const SOLAR_ROWS = [-28, -17, -6];

export function WarehouseArchitecture({
  mode,
  onSelect,
}: WarehouseArchitectureProps) {
  const roofGroupRef = useRef<THREE.Group>(null);
  const upperShellGroupRef = useRef<THREE.Group>(null);
  const officeUpperGroupRef = useRef<THREE.Group>(null);
  const dockDoorRefs = useRef<(THREE.Mesh | null)[]>([]);
  const progressRef = useRef(mode === "interior" ? 1 : 0);

  // Dedicated mutable materials for cutaway roof/upper shell fade
  const shellMats = useMemo(
    () => ({
      concrete: new THREE.MeshStandardMaterial({
        color: "#f1f4f7",
        roughness: 0.86,
        metalness: 0.02,
      }),
      terracotta: new THREE.MeshStandardMaterial({
        color: "#c66b4e",
        roughness: 0.78,
        metalness: 0.04,
      }),
      roofDeck: new THREE.MeshStandardMaterial({
        color: "#e6ecf2",
        roughness: 0.88,
        metalness: 0.02,
      }),
      parapet: new THREE.MeshStandardMaterial({
        color: "#cbd5e1",
        roughness: 0.82,
        metalness: 0.05,
      }),
      glass: new THREE.MeshStandardMaterial({
        color: "#9bc0de",
        roughness: 0.16,
        metalness: 0.25,
      }),
      solar: new THREE.MeshStandardMaterial({
        color: "#273b54",
        roughness: 0.35,
        metalness: 0.4,
      }),
      hvac: new THREE.MeshStandardMaterial({
        color: "#94a3b8",
        roughness: 0.6,
        metalness: 0.25,
      }),
    }),
    []
  );

  useFrame((_, delta) => {
    const target = mode === "interior" ? 1 : 0;
    const alpha = 1 - Math.exp(-Math.min(delta, 0.05) * 6.5);
    progressRef.current += (target - progressRef.current) * alpha;
    if (Math.abs(target - progressRef.current) < 0.002) {
      progressRef.current = target;
    }

    const p = progressRef.current;
    const visible = p < 0.96;
    const opacity = Math.max(0, 1 - p * 1.15);
    const transparent = p > 0.01;

    Object.values(shellMats).forEach((m) => {
      if (m.transparent !== transparent) {
        m.transparent = transparent;
        m.needsUpdate = true;
      }
      m.opacity = opacity;
      m.depthWrite = !transparent;
    });

    if (roofGroupRef.current) {
      roofGroupRef.current.visible = visible;
      roofGroupRef.current.position.y = p * 18;
    }
    if (upperShellGroupRef.current) {
      upperShellGroupRef.current.visible = visible;
      upperShellGroupRef.current.position.y = p * 14;
    }
    if (officeUpperGroupRef.current) {
      officeUpperGroupRef.current.visible = visible;
      officeUpperGroupRef.current.position.y = p * 14;
    }

    // Slide sectional dock doors smoothly open in interior mode
    dockDoorRefs.current.forEach((door) => {
      if (!door) return;
      const openFactor = p;
      door.scale.y = THREE.MathUtils.lerp(4.0, 0.35, openFactor);
      door.position.y = THREE.MathUtils.lerp(2.2, 4.02, openFactor);
    });
  });

  const officeWidth = OFFICE.maxX - OFFICE.minX;
  const officeDepth = OFFICE.frontZ - OFFICE.backZ;
  const officeCenterX = (OFFICE.minX + OFFICE.maxX) / 2;
  const officeCenterZ = (OFFICE.frontZ + OFFICE.backZ) / 2;

  const lowerWallH = 4.8;
  const lowerWallCenterY = lowerWallH / 2;
  const upperWallH = BUILDING.height - lowerWallH;
  const upperWallCenterY = lowerWallH + upperWallH / 2;

  return (
    <group>
      {/* ==================== LOWER STRUCTURAL SHELL (ALWAYS VISIBLE) ==================== */}
      {/* Back wall (z = -38) */}
      <Block
        position={[0, lowerWallCenterY, BUILDING.backZ]}
        scale={[BUILDING_WIDTH + BUILDING.wall, lowerWallH, BUILDING.wall]}
        color="#eef2f6"
      />

      {/* East wall (x = 36) */}
      <Block
        position={[BUILDING.maxX, lowerWallCenterY, BUILDING_CENTER_Z]}
        scale={[BUILDING.wall, lowerWallH, BUILDING_DEPTH]}
        color="#eef2f6"
      />

      {/* West wall (x = -36, leaving side receiving gate opening at z = -13..-8) */}
      <Block
        position={[BUILDING.minX, lowerWallCenterY, -25.5]}
        scale={[BUILDING.wall, lowerWallH, 25]}
        color="#eef2f6"
      />
      <Block
        position={[BUILDING.minX, 4.3, -10.5]}
        scale={[BUILDING.wall, 1.0, 5.0]}
        color="#cbd5e1"
      />
      <Block
        position={[BUILDING.minX, lowerWallCenterY, -7.5]}
        scale={[BUILDING.wall, lowerWallH, 1.0]}
        color="#eef2f6"
      />

      {/* Front dock wall lower piers + continuous lintel */}
      {FRONT_WALL_PIERS.map((pier) => (
        <Block
          key={pier.cx}
          position={[pier.cx, 2.1, BUILDING.frontZ]}
          scale={[pier.width, 4.2, BUILDING.wall]}
          color="#eef2f6"
        />
      ))}
      <Block
        position={[6, 4.5, BUILDING.frontZ]}
        scale={[60, 0.6, BUILDING.wall + 0.04]}
        color="#e2e8f0"
      />

      {/* Lower perimeter structural pilasters */}
      {PILASTER_X.map((px) => (
        <Block
          key={`bp-${px}`}
          position={[px, lowerWallCenterY, BUILDING.backZ - 0.14]}
          scale={[0.45, lowerWallH, 0.35]}
          color="#475569"
        />
      ))}
      {PILASTER_Z.map((pz) => (
        <Block
          key={`ep-${pz}`}
          position={[BUILDING.maxX + 0.14, lowerWallCenterY, pz]}
          scale={[0.35, lowerWallH, 0.45]}
          color="#475569"
        />
      ))}

      {/* 5 Dock Door Frames, Awnings, Safety Bollards & Animated Sectional Doors */}
      {DOCK_X.map((dx, idx) => (
        <group key={dx} position={[dx, 0, BUILDING.frontZ]}>
          {/* Dark slate door frame */}
          <Block position={[-1.98, 2.1, 0]} scale={[0.16, 4.2, 0.42]} color="#334155" />
          <Block position={[1.98, 2.1, 0]} scale={[0.16, 4.2, 0.42]} color="#334155" />
          <Block position={[0, 4.22, 0]} scale={[4.12, 0.16, 0.42]} color="#334155" />

          {/* Overhead dock canopy */}
          <Block position={[0, 4.55, 0.72]} scale={[4.4, 0.14, 1.25]} color="#475569" />

          {/* Safety yellow bollards */}
          <Block position={[-2.3, 0.65, 0.55]} scale={[0.2, 1.3, 0.2]} color="#f59e0b" />
          <Block position={[2.3, 0.65, 0.55]} scale={[0.2, 1.3, 0.2]} color="#f59e0b" />

          {/* Animated sectional roll-up door */}
          <mesh
            ref={(el) => {
              dockDoorRefs.current[idx] = el;
            }}
            geometry={UNIT_BOX}
            position={[0, 2.2, 0.04]}
            scale={[3.8, 4.0, 0.12]}
            castShadow
            receiveShadow
            raycast={noRaycast}
          >
            <meshStandardMaterial
              color="#d5dde6"
              roughness={0.58}
              metalness={0.22}
            />
          </mesh>
        </group>
      ))}

      {/* Operations Office Annex - Low footprint always visible + Ground walls cutaway in interior */}
      <group
        onClick={(e) => {
          e.stopPropagation();
          onSelect("warehouse");
        }}
      >
        <Block
          position={[officeCenterX, 0.08, officeCenterZ]}
          scale={[officeWidth, 0.16, officeDepth]}
          color="#e2e8f0"
          interactive
        />
        <Block
          position={[officeCenterX, 0.55, OFFICE.frontZ]}
          scale={[officeWidth, 1.1, 0.22]}
          color="#cbd5e1"
        />
        <Block
          position={[OFFICE.minX, 0.55, officeCenterZ]}
          scale={[0.22, 1.1, officeDepth]}
          color="#cbd5e1"
        />
      </group>

      {/* ==================== UPPER BUILDING FACADE (CUTAWAY IN INTERIOR) ==================== */}
      <group ref={upperShellGroupRef}>
        {/* Upper Back Wall */}
        <mesh
          geometry={UNIT_BOX}
          material={shellMats.concrete}
          position={[0, upperWallCenterY, BUILDING.backZ]}
          scale={[BUILDING_WIDTH + BUILDING.wall, upperWallH, BUILDING.wall]}
          castShadow
          receiveShadow
          raycast={noRaycast}
        />
        {/* Upper East Wall */}
        <mesh
          geometry={UNIT_BOX}
          material={shellMats.concrete}
          position={[BUILDING.maxX, upperWallCenterY, BUILDING_CENTER_Z]}
          scale={[BUILDING.wall, upperWallH, BUILDING_DEPTH]}
          castShadow
          receiveShadow
          raycast={noRaycast}
        />
        {/* Upper West Wall (z = -38..-7) */}
        <mesh
          geometry={UNIT_BOX}
          material={shellMats.concrete}
          position={[BUILDING.minX, upperWallCenterY, -22.5]}
          scale={[BUILDING.wall, upperWallH, 31]}
          castShadow
          receiveShadow
          raycast={noRaycast}
        />
        {/* Upper Front Wall (x = -24..36) */}
        <mesh
          geometry={UNIT_BOX}
          material={shellMats.concrete}
          position={[6, upperWallCenterY, BUILDING.frontZ]}
          scale={[60, upperWallH, BUILDING.wall]}
          castShadow
          receiveShadow
          raycast={noRaycast}
        />

        {/* TAYO Terracotta Architectural Band (y = 9.65..10.3) */}
        <mesh
          geometry={UNIT_BOX}
          material={shellMats.terracotta}
          position={[6, 9.95, BUILDING.frontZ + 0.12]}
          scale={[60.2, 0.65, 0.2]}
          raycast={noRaycast}
        />
        <mesh
          geometry={UNIT_BOX}
          material={shellMats.terracotta}
          position={[0, 9.95, BUILDING.backZ - 0.12]}
          scale={[BUILDING_WIDTH + 0.4, 0.65, 0.2]}
          raycast={noRaycast}
        />
        <mesh
          geometry={UNIT_BOX}
          material={shellMats.terracotta}
          position={[BUILDING.maxX + 0.12, 9.95, BUILDING_CENTER_Z]}
          scale={[0.2, 0.65, BUILDING_DEPTH + 0.4]}
          raycast={noRaycast}
        />
        <mesh
          geometry={UNIT_BOX}
          material={shellMats.terracotta}
          position={[BUILDING.minX - 0.12, 9.95, -22.5]}
          scale={[0.2, 0.65, 31]}
          raycast={noRaycast}
        />

        {/* Clerestory glazing strips */}
        <mesh
          geometry={UNIT_BOX}
          material={shellMats.glass}
          position={[6, 8.2, BUILDING.frontZ + 0.14]}
          scale={[52, 1.0, 0.14]}
          raycast={noRaycast}
        />
        <mesh
          geometry={UNIT_BOX}
          material={shellMats.glass}
          position={[BUILDING.maxX + 0.14, 8.2, BUILDING_CENTER_Z]}
          scale={[0.14, 1.0, 32]}
          raycast={noRaycast}
        />

        {/* TAYO CEDIS Front Fascia Brand Sign */}
        <SceneText
          text="TAYO · CEDIS CONCRETO"
          position={[6, 7.0, BUILDING.frontZ + 0.25]}
          fontSize={0.95}
          color="#1e293b"
          background="rgba(255,255,255,0.92)"
          borderColor="#cbd5e1"
        />
      </group>

      {/* ==================== OFFICE ANNEX UPPER + GROUND WALLS (CUTAWAY IN INTERIOR) ==================== */}
      <group ref={officeUpperGroupRef}>
        <mesh
          geometry={UNIT_BOX}
          material={shellMats.concrete}
          position={[officeCenterX, 6.0, officeCenterZ]}
          scale={[officeWidth, 12.0, officeDepth]}
          castShadow
          receiveShadow
          raycast={noRaycast}
        />
        <mesh
          geometry={UNIT_BOX}
          material={shellMats.glass}
          position={[officeCenterX, 2.35, OFFICE.frontZ + 0.04]}
          scale={[officeWidth - 1.8, 2.8, 0.14]}
          raycast={noRaycast}
        />
        <mesh
          geometry={UNIT_BOX}
          material={shellMats.glass}
          position={[OFFICE.minX - 0.04, 2.35, officeCenterZ]}
          scale={[0.14, 2.8, officeDepth - 2.4]}
          raycast={noRaycast}
        />
        <mesh
          geometry={UNIT_BOX}
          material={shellMats.terracotta}
          position={[officeCenterX, 3.85, OFFICE.frontZ + 0.9]}
          scale={[6.4, 0.16, 1.8]}
          raycast={noRaycast}
        />
        <mesh
          geometry={UNIT_BOX}
          material={shellMats.glass}
          position={[officeCenterX, 7.6, OFFICE.frontZ + 0.06]}
          scale={[officeWidth - 1.8, 3.0, 0.16]}
          raycast={noRaycast}
        />
        <mesh
          geometry={UNIT_BOX}
          material={shellMats.glass}
          position={[OFFICE.minX - 0.06, 7.6, officeCenterZ]}
          scale={[0.16, 3.0, officeDepth - 2.4]}
          raycast={noRaycast}
        />
        <mesh
          geometry={UNIT_BOX}
          material={shellMats.terracotta}
          position={[OFFICE.maxX - 0.3, 6.0, OFFICE.frontZ + 0.08]}
          scale={[0.65, 12.0, 0.24]}
          raycast={noRaycast}
        />
        <mesh
          geometry={UNIT_BOX}
          material={shellMats.terracotta}
          position={[officeCenterX, 11.4, OFFICE.frontZ + 0.1]}
          scale={[officeWidth + 0.2, 0.55, 0.22]}
          raycast={noRaycast}
        />
        <mesh
          geometry={UNIT_BOX}
          material={shellMats.parapet}
          position={[officeCenterX, OFFICE.height + 0.2, officeCenterZ]}
          scale={[officeWidth + 0.4, 0.4, officeDepth + 0.4]}
          castShadow
          raycast={noRaycast}
        />
        <SceneText
          text="TAYO WMS"
          position={[officeCenterX, 10.1, OFFICE.frontZ + 0.15]}
          fontSize={0.72}
          color="#1e293b"
          background="rgba(255,255,255,0.95)"
        />
      </group>

      {/* ==================== ROOF DECK, SKYLIGHTS & SOLAR ARRAY ==================== */}
      <group ref={roofGroupRef}>
        {/* Main concrete roof slab */}
        <mesh
          geometry={UNIT_BOX}
          material={shellMats.roofDeck}
          position={[0, BUILDING.height + 0.18, BUILDING_CENTER_Z]}
          scale={[BUILDING_WIDTH + 0.7, 0.36, BUILDING_DEPTH + 0.7]}
          castShadow
          receiveShadow
          raycast={noRaycast}
        />
        {/* Parapet perimeter coping */}
        <mesh
          geometry={UNIT_BOX}
          material={shellMats.parapet}
          position={[0, BUILDING.height + 0.55, BUILDING.backZ - 0.1]}
          scale={[BUILDING_WIDTH + 0.8, 0.5, 0.4]}
          raycast={noRaycast}
        />
        <mesh
          geometry={UNIT_BOX}
          material={shellMats.parapet}
          position={[0, BUILDING.height + 0.55, BUILDING.frontZ + 0.1]}
          scale={[BUILDING_WIDTH + 0.8, 0.5, 0.4]}
          raycast={noRaycast}
        />
        <mesh
          geometry={UNIT_BOX}
          material={shellMats.parapet}
          position={[BUILDING.minX - 0.1, BUILDING.height + 0.55, BUILDING_CENTER_Z]}
          scale={[0.4, 0.5, BUILDING_DEPTH + 0.6]}
          raycast={noRaycast}
        />
        <mesh
          geometry={UNIT_BOX}
          material={shellMats.parapet}
          position={[BUILDING.maxX + 0.1, BUILDING.height + 0.55, BUILDING_CENTER_Z]}
          scale={[0.4, 0.5, BUILDING_DEPTH + 0.6]}
          raycast={noRaycast}
        />

        {/* 3 Skylight strips */}
        {[-29.5, -17.5, -5.5].map((sz) => (
          <mesh
            key={sz}
            geometry={UNIT_BOX}
            material={shellMats.glass}
            position={[4, BUILDING.height + 0.42, sz]}
            scale={[50, 0.22, 2.4]}
            raycast={noRaycast}
          />
        ))}

        {/* Rooftop solar panel array */}
        {SOLAR_ROWS.map((rz) =>
          SOLAR_COLS.map((cx) => (
            <mesh
              key={`sol-${cx}-${rz}`}
              geometry={UNIT_BOX}
              material={shellMats.solar}
              position={[cx, BUILDING.height + 0.56, rz - 4.5]}
              rotation={[0.16, 0, 0]}
              scale={[7.5, 0.12, 3.8]}
              castShadow
              raycast={noRaycast}
            />
          ))
        )}

        {/* Rooftop HVAC units */}
        {[-12, 6, 22].map((hx) => (
          <mesh
            key={`hvac-${hx}`}
            geometry={UNIT_BOX}
            material={shellMats.hvac}
            position={[hx, BUILDING.height + 0.9, -34.5]}
            scale={[3.2, 1.1, 2.4]}
            castShadow
            raycast={noRaycast}
          />
        ))}
      </group>
    </group>
  );
}
