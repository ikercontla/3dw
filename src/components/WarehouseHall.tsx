import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  AISLE_X,
  BUILDING_CENTER_Z,
  BUILDING_DEPTH,
  BUILDING_WIDTH,
  ZONES_LAYOUT,
} from "@/data/layout";
import type { UbicacionState } from "@/types/wms";
import { usePlaybackClock } from "./PlaybackClock";
import {
  Block,
  SceneText,
  SelectionMark,
  UNIT_BOX,
  getCachedMaterial,
  noRaycast,
} from "./SceneText";
import { TayoProductMesh } from "./TayoProductMeshes";

interface WarehouseHallProps {
  ubicaciones: UbicacionState[];
  selectedId: string;
  hoveredId: string | null;
  highlightedUbicacionIds?: number[];
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

const RACK_ROWS = [
  { id: "A", z: -17.5 },
  { id: "B", z: -29.5 },
] as const;

const UPRIGHT_X = [-26, -18, -10, -2, 6, 14, 22] as const;
const RACK_HALF_DEPTH = 1.02;

function HighlightPulseMark() {
  const groupRef = useRef<THREE.Group>(null);
  const { clockRef } = usePlaybackClock();

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clockRef.current || clock.elapsedTime;
    const pulse = 1 + Math.sin(t * 5.2) * 0.055;
    groupRef.current.scale.set(pulse, 1, pulse);
  });

  return (
    <group ref={groupRef}>
      <SelectionMark
        position={[0, 0.04, 0]}
        size={[2.45, 2.45]}
        color="#10b981"
        thickness={0.11}
        opacity={0.95}
      />
    </group>
  );
}

function WoodenPalletDeck() {
  return (
    <group>
      {/* 3 wooden stringers / runners */}
      <Block
        position={[-0.64, 0.045, 0]}
        scale={[0.14, 0.09, 1.56]}
        color="#a67c48"
        roughness={0.88}
      />
      <Block
        position={[0, 0.045, 0]}
        scale={[0.14, 0.09, 1.56]}
        color="#a67c48"
        roughness={0.88}
      />
      <Block
        position={[0.64, 0.045, 0]}
        scale={[0.14, 0.09, 1.56]}
        color="#a67c48"
        roughness={0.88}
      />
      {/* Top timber deck (1.6 x 0.14 x 1.6 total height) */}
      <Block
        position={[0, 0.115, 0]}
        scale={[1.6, 0.05, 1.6]}
        color="#cea165"
        roughness={0.86}
      />
    </group>
  );
}

function shortFloorLabel(codigo: string): string {
  const parts = codigo.split("-");
  if (parts.length < 5) return codigo;
  const [zona, , pasillo, , pos] = parts;
  if (zona === "STAG") return `STAG-${pos}`;
  return `PIS-${pasillo}-${pos}`;
}

export function WarehouseHall({
  ubicaciones,
  selectedId,
  hoveredId,
  highlightedUbicacionIds,
  onSelect,
  onHover,
}: WarehouseHallProps) {
  const uprightRef = useRef<THREE.InstancedMesh>(null);
  const footplateRef = useRef<THREE.InstancedMesh>(null);
  const crossTieRef = useRef<THREE.InstancedMesh>(null);
  const beamRef = useRef<THREE.InstancedMesh>(null);
  const supportBarRef = useRef<THREE.InstancedMesh>(null);
  const almSlotOutlineRef = useRef<THREE.InstancedMesh>(null);
  const stagSlotOutlineRef = useRef<THREE.InstancedMesh>(null);

  const uprightMat = useMemo(
    () => getCachedMaterial("#3b4a5e", { roughness: 0.55, metalness: 0.35 }),
    []
  );
  const footplateMat = useMemo(
    () => getCachedMaterial("#1e293b", { roughness: 0.5, metalness: 0.45 }),
    []
  );
  const beamMat = useMemo(
    () => getCachedMaterial("#d9dee7", { roughness: 0.48, metalness: 0.28 }),
    []
  );
  const supportBarMat = useMemo(
    () => getCachedMaterial("#94a3b8", { roughness: 0.52, metalness: 0.35 }),
    []
  );
  const almOutlineMat = useMemo(
    () => getCachedMaterial("#94a3b8", { roughness: 0.7, metalness: 0.05 }),
    []
  );
  const stagOutlineMat = useMemo(
    () => getCachedMaterial("#d97706", { roughness: 0.6, metalness: 0.05 }),
    []
  );
  const hitMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    []
  );

  const floorAlmSlots = useMemo(
    () =>
      ubicaciones.filter(
        (u) => u.codigo_soporte === "PIS" && u.codigo_zona === "Z-ALM"
      ),
    [ubicaciones]
  );
  const floorStagSlots = useMemo(
    () =>
      ubicaciones.filter(
        (u) => u.codigo_soporte === "PIS" && u.codigo_zona === "Z-STAG"
      ),
    [ubicaciones]
  );

  const highlightSet = useMemo(
    () => new Set(highlightedUbicacionIds ?? []),
    [highlightedUbicacionIds]
  );

  const uprightCount = RACK_ROWS.length * UPRIGHT_X.length * 2;
  const crossTieCount = RACK_ROWS.length * UPRIGHT_X.length * 3;
  const beamCount = RACK_ROWS.length * AISLE_X.length * 2 * 2;
  const supportBarCount = RACK_ROWS.length * AISLE_X.length * 2 * 2;

  // Populate structural steel rack InstancedMeshes
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();

    if (uprightRef.current && footplateRef.current && crossTieRef.current) {
      let uIdx = 0;
      let cIdx = 0;
      for (const row of RACK_ROWS) {
        for (const ux of UPRIGHT_X) {
          for (const side of [-1, 1]) {
            const z = row.z + side * RACK_HALF_DEPTH;
            dummy.position.set(ux, 2.95, z);
            dummy.scale.set(0.16, 5.9, 0.16);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            uprightRef.current.setMatrixAt(uIdx, dummy.matrix);

            dummy.position.set(ux, 0.02, z);
            dummy.scale.set(0.3, 0.04, 0.3);
            dummy.updateMatrix();
            footplateRef.current.setMatrixAt(uIdx, dummy.matrix);
            uIdx++;
          }

          for (const ty of [1.4, 3.8, 5.75]) {
            dummy.position.set(ux, ty, row.z);
            dummy.scale.set(0.1, 0.1, RACK_HALF_DEPTH * 2);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            crossTieRef.current.setMatrixAt(cIdx++, dummy.matrix);
          }
        }
      }
      uprightRef.current.instanceMatrix.needsUpdate = true;
      footplateRef.current.instanceMatrix.needsUpdate = true;
      crossTieRef.current.instanceMatrix.needsUpdate = true;
    }

    if (beamRef.current && supportBarRef.current) {
      let bIdx = 0;
      let sIdx = 0;
      const levels = [
        { beamY: 0.16, beamH: 0.18, barY: 0.22 }, // top flush at 0.25
        { beamY: 2.94, beamH: 0.22, barY: 3.02 }, // top flush at 3.05
      ];
      for (const row of RACK_ROWS) {
        for (const ax of AISLE_X) {
          for (const lvl of levels) {
            for (const side of [-1, 1]) {
              dummy.position.set(ax, lvl.beamY, row.z + side * RACK_HALF_DEPTH);
              dummy.scale.set(7.84, lvl.beamH, 0.14);
              dummy.rotation.set(0, 0, 0);
              dummy.updateMatrix();
              beamRef.current.setMatrixAt(bIdx++, dummy.matrix);
            }
            for (const bxOffset of [-0.58, 0.58]) {
              dummy.position.set(ax + bxOffset, lvl.barY, row.z);
              dummy.scale.set(0.14, 0.06, RACK_HALF_DEPTH * 2 - 0.1);
              dummy.rotation.set(0, 0, 0);
              dummy.updateMatrix();
              supportBarRef.current.setMatrixAt(sIdx++, dummy.matrix);
            }
          }
        }
      }
      beamRef.current.instanceMatrix.needsUpdate = true;
      supportBarRef.current.instanceMatrix.needsUpdate = true;
    }
  }, []);

  // Populate floor slot border outlines
  useLayoutEffect(() => {
    const populateOutlines = (
      mesh: THREE.InstancedMesh | null,
      slots: UbicacionState[]
    ) => {
      if (!mesh || slots.length === 0) return;
      const dummy = new THREE.Object3D();
      const w = 2.08;
      const d = 2.08;
      const t = 0.07;
      let idx = 0;
      for (const slot of slots) {
        const [sx, , sz] = slot.position3d;
        // North / South edges
        for (const dz of [-d / 2, d / 2]) {
          dummy.position.set(sx, 0.013, sz + dz);
          dummy.scale.set(w + t, 0.014, t);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          mesh.setMatrixAt(idx++, dummy.matrix);
        }
        // West / East edges
        for (const dx of [-w / 2, w / 2]) {
          dummy.position.set(sx + dx, 0.013, sz);
          dummy.scale.set(t, 0.014, d - t);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          mesh.setMatrixAt(idx++, dummy.matrix);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
    };

    populateOutlines(almSlotOutlineRef.current, floorAlmSlots);
    populateOutlines(stagSlotOutlineRef.current, floorStagSlots);
  }, [floorAlmSlots, floorStagSlots]);

  return (
    <group>
      {/* Interior Industrial Concrete Floor Slab (top at y = 0) */}
      <Block
        position={[0, -0.07, BUILDING_CENTER_Z]}
        scale={[BUILDING_WIDTH - 0.4, 0.14, BUILDING_DEPTH - 0.4]}
        color="#e9ecef"
        roughness={0.88}
        castShadow={false}
      />

      {/* Subtle expansion joints across the floor slab */}
      {[-24, -12, 0, 12, 24].map((gx) => (
        <Block
          key={`jgx-${gx}`}
          position={[gx, 0.002, BUILDING_CENTER_Z]}
          scale={[0.04, 0.004, BUILDING_DEPTH - 1.5]}
          color="#dce3ea"
          castShadow={false}
        />
      ))}
      {[-32, -21, -8.5, 1.5].map((gz) => (
        <Block
          key={`jgz-${gz}`}
          position={[0, 0.002, gz]}
          scale={[BUILDING_WIDTH - 1.5, 0.004, 0.04]}
          color="#dce3ea"
          castShadow={false}
        />
      ))}

      {/* Receiving Bay (Stage 0 ENT at [-29, 0.2, -10]) */}
      <group position={[-29, 0.006, -10]}>
        <Block
          position={[0, 0, 0]}
          scale={[4.8, 0.012, 4.8]}
          color="#dbeafe"
          roughness={0.86}
          castShadow={false}
        />
        <SelectionMark
          position={[0, 0.01, 0]}
          size={[4.8, 4.8]}
          color="#3b82f6"
          thickness={0.07}
          opacity={0.65}
        />
        <SceneText
          text="RECEPCIÓN · ENT"
          position={[0, 0.016, 2.85]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.42}
          color="#1d4ed8"
          background="rgba(255,255,255,0.88)"
        />
      </group>

      {/* ==================== CLICKABLE FLOOR ZONES (Z-ALM & Z-STAG) ==================== */}
      {ZONES_LAYOUT.map((zone) => {
        const zoneKey = `zone:${zone.id}`;
        const isZoneSelected = selectedId === zoneKey;
        const isZoneHovered = hoveredId === zoneKey;
        const isStag = zone.id === "Z-STAG";
        const [zx, , zz] = zone.position;
        const [zw, zd] = zone.size;

        return (
          <group key={zone.id} position={[zx, 0.005, zz]}>
            {/* Clickable zone floor pad */}
            <mesh
              position={[0, 0, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              receiveShadow
              onClick={(e) => {
                e.stopPropagation();
                onSelect(zoneKey);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = "pointer";
                onHover(zoneKey);
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                document.body.style.cursor = "auto";
                onHover(null);
              }}
            >
              <planeGeometry args={[zw, zd]} />
              <meshStandardMaterial
                color={isStag ? "#dfe6ec" : "#e3e9ef"}
                roughness={0.88}
                metalness={0.02}
              />
            </mesh>

            {/* Zone perimeter border stripe (amber #f59e0b for Z-STAG, slate for Z-ALM) */}
            <SelectionMark
              position={[0, 0.008, 0]}
              size={[zw, zd]}
              color={
                isZoneSelected
                  ? "#2d68e8"
                  : isZoneHovered
                  ? "#60a5fa"
                  : isStag
                  ? "#f59e0b"
                  : "#94a3b8"
              }
              thickness={isZoneSelected ? 0.16 : isStag ? 0.12 : 0.08}
              opacity={isZoneSelected || isZoneHovered ? 0.95 : 0.85}
            />

            {/* Zone title stencil */}
            <SceneText
              text={
                isStag
                  ? "Z-STAG · MUELLE DE DESPACHO"
                  : "Z-ALM · ALMACÉN GENERAL"
              }
              position={[-zw / 2 + 5.8, 0.015, zd / 2 - 0.85]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.55}
              color={isStag ? "#b45309" : "#334155"}
              background="rgba(255,255,255,0.9)"
              borderColor={isStag ? "#f59e0b" : "#cbd5e1"}
            />
          </group>
        );
      })}

      {/* Aisle Floor Guide Labels */}
      <SceneText
        text="PASILLO A"
        position={[20.2, 0.014, -15.0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.44}
        color="#475569"
        background="rgba(255,255,255,0.85)"
      />
      <SceneText
        text="PASILLO B"
        position={[20.2, 0.014, -27.0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.44}
        color="#475569"
        background="rgba(255,255,255,0.85)"
      />

      {/* ==================== 2-LEVEL STRUCTURAL STEEL RACKS ==================== */}
      <instancedMesh
        ref={uprightRef}
        args={[UNIT_BOX, uprightMat, uprightCount]}
        castShadow
        receiveShadow
        frustumCulled={false}
        raycast={noRaycast}
      />
      <instancedMesh
        ref={footplateRef}
        args={[UNIT_BOX, footplateMat, uprightCount]}
        receiveShadow
        frustumCulled={false}
        raycast={noRaycast}
      />
      <instancedMesh
        ref={crossTieRef}
        args={[UNIT_BOX, uprightMat, crossTieCount]}
        castShadow
        frustumCulled={false}
        raycast={noRaycast}
      />
      <instancedMesh
        ref={beamRef}
        args={[UNIT_BOX, beamMat, beamCount]}
        castShadow
        receiveShadow
        frustumCulled={false}
        raycast={noRaycast}
      />
      <instancedMesh
        ref={supportBarRef}
        args={[UNIT_BOX, supportBarMat, supportBarCount]}
        castShadow
        receiveShadow
        frustumCulled={false}
        raycast={noRaycast}
      />

      {/* Rack bay labels on upper beams */}
      {RACK_ROWS.map((row) =>
        AISLE_X.map((ax, idx) => (
          <SceneText
            key={`rck-lbl-${row.id}-${idx}`}
            text={`${row.id}-0${idx + 1}`}
            position={[ax, 2.94, row.z + RACK_HALF_DEPTH + 0.1]}
            fontSize={0.34}
            color="#1e293b"
            background="rgba(255,255,255,0.9)"
            borderColor="#94a3b8"
          />
        ))
      )}

      {/* ==================== FLOOR SLOT OUTLINES & LABELS ==================== */}
      {floorAlmSlots.length > 0 && (
        <instancedMesh
          ref={almSlotOutlineRef}
          args={[UNIT_BOX, almOutlineMat, floorAlmSlots.length * 4]}
          receiveShadow
          frustumCulled={false}
          raycast={noRaycast}
        />
      )}
      {floorStagSlots.length > 0 && (
        <instancedMesh
          ref={stagSlotOutlineRef}
          args={[UNIT_BOX, stagOutlineMat, floorStagSlots.length * 4]}
          receiveShadow
          frustumCulled={false}
          raycast={noRaycast}
        />
      )}

      {ubicaciones
        .filter((u) => u.codigo_soporte === "PIS")
        .map((u) => (
          <SceneText
            key={`pis-lbl-${u.id_ubicacion}`}
            text={shortFloorLabel(u.codigo_ubicacion)}
            position={[u.position3d[0], 0.015, u.position3d[2] + 1.32]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.28}
            color={u.codigo_zona === "Z-STAG" ? "#92400e" : "#475569"}
          />
        ))}

      {/* ==================== ALL 42 INTERACTIVE UBICACIONES & TARIMAS ==================== */}
      {ubicaciones.map((u) => {
        const locId = `loc:${u.codigo_ubicacion}`;
        const tarimaId = u.tarima ? `tarima:${u.tarima.codigo_tarima}` : null;
        const clickId = tarimaId ?? locId;

        const isSelected =
          selectedId === locId || (tarimaId !== null && selectedId === tarimaId);
        const isHovered =
          hoveredId === locId || (tarimaId !== null && hoveredId === tarimaId);
        const isHighlighted = highlightSet.has(u.id_ubicacion);

        const occupied = u.tarima !== null;
        const primaryItem = u.tarima?.items[0] ?? null;

        return (
          <group key={u.id_ubicacion} position={u.position3d}>
            {/* Interactive click/hover collider */}
            <mesh
              geometry={UNIT_BOX}
              material={hitMat}
              position={[0, occupied ? 0.65 : 0.16, 0]}
              scale={[2.05, occupied ? 1.3 : 0.32, 2.05]}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(clickId);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = "pointer";
                onHover(clickId);
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                document.body.style.cursor = "auto";
                onHover(null);
              }}
            />

            {/* Active selection ring (#2d68e8) */}
            {isSelected && (
              <SelectionMark
                position={[0, 0.03, 0]}
                size={[2.22, 2.22]}
                color="#2d68e8"
                thickness={0.1}
                opacity={0.96}
              />
            )}

            {/* Hover ring */}
            {isHovered && !isSelected && (
              <SelectionMark
                position={[0, 0.025, 0]}
                size={[2.16, 2.16]}
                color="#60a5fa"
                thickness={0.07}
                opacity={0.78}
              />
            )}

            {/* SQL operation affected highlight pulse */}
            {isHighlighted && <HighlightPulseMark />}

            {/* Wooden pallet + TAYO concrete product placeholder / GLB */}
            {occupied && (
              <group>
                <WoodenPalletDeck />
                {primaryItem && (
                  <TayoProductMesh item={primaryItem} position={[0, 0.14, 0]} />
                )}
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
}
