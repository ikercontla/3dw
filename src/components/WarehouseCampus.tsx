import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BUILDING, CAMPUS, DOCK_X } from "@/data/layout";
import type { Transportista } from "@/types/wms";
import {
  Block,
  SceneText,
  UNIT_BOX,
  getCachedMaterial,
  noRaycast,
} from "./SceneText";

interface WarehouseCampusProps {
  transportistas: Transportista[];
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

const TREE_POSITIONS: [number, number, number][] = [
  [-56, 0, -48],
  [-56, 0, -34],
  [-56, 0, -20],
  [-56, 0, -6],
  [-56, 0, 8],
  [-56, 0, 22],
  [56, 0, -48],
  [56, 0, -34],
  [56, 0, -20],
  [56, 0, -6],
  [56, 0, 8],
  [56, 0, 22],
  [-44, 0, -49],
  [-28, 0, -49],
  [-12, 0, -49],
  [4, 0, -49],
  [20, 0, -49],
  [36, 0, -49],
  [-44, 0, 36.5],
  [-26, 0, 36.5],
  [26, 0, 36.5],
  [44, 0, 36.5],
];

function computeFencePosts(): [number, number, number][] {
  const posts: [number, number, number][] = [];
  const step = 6;
  const { fenceX, fenceBackZ, fenceFrontZ, gateHalfWidth } = CAMPUS;

  for (let x = -fenceX; x <= fenceX; x += step) {
    posts.push([x, 1.0, fenceBackZ]);
    if (Math.abs(x) >= gateHalfWidth) {
      posts.push([x, 1.0, fenceFrontZ]);
    }
  }
  for (let z = fenceBackZ + step; z < fenceFrontZ; z += step) {
    posts.push([-fenceX, 1.0, z]);
    posts.push([fenceX, 1.0, z]);
  }
  return posts;
}

const FENCE_POSTS = computeFencePosts();

const CAR_PARK_X = [-44, -40, -36, -32, -28];
const TRAILER_PARK_X = [31, 37, 43, 49];

function shortCarrierName(name: string): string {
  const clean = name.replace(/^(Transportes|Logística|Fletes|Carga)\s+/i, "");
  return clean.length > 16 ? `${clean.slice(0, 15)}…` : clean;
}

export function WarehouseCampus({
  transportistas,
  onSelect,
  onHover,
}: WarehouseCampusProps) {
  const fenceMeshRef = useRef<THREE.InstancedMesh>(null);
  const trunkMeshRef = useRef<THREE.InstancedMesh>(null);
  const canopyMeshRef = useRef<THREE.InstancedMesh>(null);
  const stripeMeshRef = useRef<THREE.InstancedMesh>(null);

  const trunkGeo = useMemo(
    () => new THREE.CylinderGeometry(0.18, 0.24, 1.4, 10),
    []
  );
  const canopyGeo = useMemo(() => new THREE.DodecahedronGeometry(1.35, 1), []);

  const fenceMat = useMemo(
    () => getCachedMaterial("#64748b", { roughness: 0.55, metalness: 0.45 }),
    []
  );
  const trunkMat = useMemo(
    () => getCachedMaterial("#7a6855", { roughness: 0.9, metalness: 0.02 }),
    []
  );
  const canopyMat = useMemo(
    () => getCachedMaterial("#7da688", { roughness: 0.85, metalness: 0.02 }),
    []
  );
  const stripeMat = useMemo(
    () => getCachedMaterial("#f8fafc", { roughness: 0.7, metalness: 0.02 }),
    []
  );
  const terrainMat = useMemo(
    () => getCachedMaterial("#dce5ec", { roughness: 0.94, metalness: 0.0 }),
    []
  );

  const roadStripes = useMemo(() => {
    const items: { pos: [number, number, number]; scale: [number, number, number] }[] = [];
    // Boulevard dashed centerline along z = 41
    for (let x = -80; x <= 80; x += 8) {
      items.push({ pos: [x, 0.005, 41], scale: [3.6, 0.015, 0.22] });
    }
    // Car parking stall dividers (west lot)
    for (let i = 0; i <= CAR_PARK_X.length; i++) {
      const x = -46 + i * 4;
      items.push({ pos: [x, 0.005, 18.5], scale: [0.12, 0.015, 5.2] });
    }
    // Trailer staging stall dividers (east lot)
    for (let i = 0; i <= TRAILER_PARK_X.length; i++) {
      const x = 28 + i * 6;
      items.push({ pos: [x, 0.005, 19.5], scale: [0.14, 0.015, 9.0] });
    }
    // Dock bay stall guide lines
    for (const dx of DOCK_X) {
      items.push({ pos: [dx - 2.4, 0.004, 12.2], scale: [0.12, 0.015, 15.0] });
      items.push({ pos: [dx + 2.4, 0.004, 12.2], scale: [0.12, 0.015, 15.0] });
    }
    return items;
  }, []);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();

    if (fenceMeshRef.current) {
      FENCE_POSTS.forEach((p, idx) => {
        dummy.position.set(p[0], p[1], p[2]);
        dummy.scale.set(0.14, 2.0, 0.14);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        fenceMeshRef.current!.setMatrixAt(idx, dummy.matrix);
      });
      fenceMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    if (trunkMeshRef.current && canopyMeshRef.current) {
      TREE_POSITIONS.forEach((p, idx) => {
        const scaleVar = 0.85 + ((idx * 37) % 10) * 0.03;
        dummy.position.set(p[0], 0.7 * scaleVar, p[2]);
        dummy.scale.set(scaleVar, scaleVar, scaleVar);
        dummy.rotation.set(0, (idx * 0.9) % Math.PI, 0);
        dummy.updateMatrix();
        trunkMeshRef.current!.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(p[0], 2.2 * scaleVar, p[2]);
        dummy.scale.set(scaleVar * 1.1, scaleVar * 1.25, scaleVar * 1.1);
        dummy.updateMatrix();
        canopyMeshRef.current!.setMatrixAt(idx, dummy.matrix);
      });
      trunkMeshRef.current.instanceMatrix.needsUpdate = true;
      canopyMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    if (stripeMeshRef.current) {
      roadStripes.forEach((s, idx) => {
        dummy.position.set(s.pos[0], s.pos[1], s.pos[2]);
        dummy.scale.set(s.scale[0], s.scale[1], s.scale[2]);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        stripeMeshRef.current!.setMatrixAt(idx, dummy.matrix);
      });
      stripeMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [roadStripes]);

  const yardWidth = CAMPUS.fenceX * 2;
  const yardDepth = CAMPUS.fenceFrontZ - CAMPUS.fenceBackZ;
  const yardCenterZ = (CAMPUS.fenceFrontZ + CAMPUS.fenceBackZ) / 2;

  return (
    <group>
      {/* Surrounding campus grounds */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.14, -8]}
        material={terrainMat}
        receiveShadow
        raycast={noRaycast}
      >
        <planeGeometry args={[360, 360]} />
      </mesh>

      {/* Paved operational yard inside perimeter */}
      <Block
        position={[0, -0.08, yardCenterZ]}
        scale={[yardWidth, 0.12, yardDepth]}
        color="#d5dde5"
        roughness={0.92}
        castShadow={false}
      />

      {/* Exterior boulevard road */}
      <Block
        position={[0, -0.075, 41]}
        scale={[220, 0.11, 10]}
        color="#c4ced8"
        roughness={0.92}
        castShadow={false}
      />

      {/* Entry driveway apron through main gate */}
      <Block
        position={[0, -0.07, 29.5]}
        scale={[CAMPUS.gateHalfWidth * 2 - 1, 0.11, 14]}
        color="#cdd6df"
        roughness={0.9}
        castShadow={false}
      />

      {/* Concrete loading dock apron in front of dock wall */}
      <Block
        position={[0, -0.06, 12.2]}
        scale={[46, 0.1, 16.5]}
        color="#dfe6ed"
        roughness={0.88}
        castShadow={false}
      />

      {/* Perimeter low curb wall + fence rails */}
      <Block
        position={[0, 0.18, CAMPUS.fenceBackZ]}
        scale={[yardWidth, 0.36, 0.25]}
        color="#cbd5e1"
      />
      <Block
        position={[-CAMPUS.fenceX, 0.18, yardCenterZ]}
        scale={[0.25, 0.36, yardDepth]}
        color="#cbd5e1"
      />
      <Block
        position={[CAMPUS.fenceX, 0.18, yardCenterZ]}
        scale={[0.25, 0.36, yardDepth]}
        color="#cbd5e1"
      />
      {/* Front perimeter fence segments flanking the main gate */}
      <Block
        position={[-(CAMPUS.fenceX + CAMPUS.gateHalfWidth) / 2, 0.18, CAMPUS.fenceFrontZ]}
        scale={[CAMPUS.fenceX - CAMPUS.gateHalfWidth, 0.36, 0.25]}
        color="#cbd5e1"
      />
      <Block
        position={[(CAMPUS.fenceX + CAMPUS.gateHalfWidth) / 2, 0.18, CAMPUS.fenceFrontZ]}
        scale={[CAMPUS.fenceX - CAMPUS.gateHalfWidth, 0.36, 0.25]}
        color="#cbd5e1"
      />

      {/* Top fence rails */}
      <Block
        position={[0, 1.85, CAMPUS.fenceBackZ]}
        scale={[yardWidth, 0.08, 0.08]}
        color="#64748b"
        metalness={0.4}
      />
      <Block
        position={[-CAMPUS.fenceX, 1.85, yardCenterZ]}
        scale={[0.08, 0.08, yardDepth]}
        color="#64748b"
        metalness={0.4}
      />
      <Block
        position={[CAMPUS.fenceX, 1.85, yardCenterZ]}
        scale={[0.08, 0.08, yardDepth]}
        color="#64748b"
        metalness={0.4}
      />
      <Block
        position={[-(CAMPUS.fenceX + CAMPUS.gateHalfWidth) / 2, 1.85, CAMPUS.fenceFrontZ]}
        scale={[CAMPUS.fenceX - CAMPUS.gateHalfWidth, 0.08, 0.08]}
        color="#64748b"
        metalness={0.4}
      />
      <Block
        position={[(CAMPUS.fenceX + CAMPUS.gateHalfWidth) / 2, 1.85, CAMPUS.fenceFrontZ]}
        scale={[CAMPUS.fenceX - CAMPUS.gateHalfWidth, 0.08, 0.08]}
        color="#64748b"
        metalness={0.4}
      />

      {/* Instanced fence posts */}
      <instancedMesh
        ref={fenceMeshRef}
        args={[UNIT_BOX, fenceMat, FENCE_POSTS.length]}
        castShadow
        frustumCulled={false}
        raycast={noRaycast}
      />

      {/* Instanced perimeter trees */}
      <instancedMesh
        ref={trunkMeshRef}
        args={[trunkGeo, trunkMat, TREE_POSITIONS.length]}
        castShadow
        frustumCulled={false}
        raycast={noRaycast}
      />
      <instancedMesh
        ref={canopyMeshRef}
        args={[canopyGeo, canopyMat, TREE_POSITIONS.length]}
        castShadow
        receiveShadow
        frustumCulled={false}
        raycast={noRaycast}
      />

      {/* Instanced road & parking stall markings */}
      <instancedMesh
        ref={stripeMeshRef}
        args={[UNIT_BOX, stripeMat, roadStripes.length]}
        receiveShadow
        frustumCulled={false}
        raycast={noRaycast}
      />

      {/* Access Gatehouse (Caseta de Vigilancia) */}
      <group position={[-12.8, 0, CAMPUS.fenceFrontZ]}>
        <Block position={[0, 1.45, 0]} scale={[3.4, 2.9, 3.0]} color="#f1f5f9" />
        <Block position={[0, 2.95, 0]} scale={[4.2, 0.28, 3.8]} color="#475569" />
        <Block position={[0, 2.55, 0]} scale={[3.5, 0.25, 3.1]} color="#c66b4e" />
        <Block
          position={[0, 1.65, 0]}
          scale={[3.46, 0.95, 2.4]}
          color="#7ea3c4"
          roughness={0.18}
          metalness={0.3}
        />
        {/* Entry/exit barrier gates */}
        <Block position={[4.5, 0.95, 0.4]} scale={[6.8, 0.1, 0.1]} color="#ef4444" />
        <Block position={[1.2, 0.55, 0.4]} scale={[0.35, 1.1, 0.35]} color="#f59e0b" />
        <Block position={[16.2, 0.55, 0.4]} scale={[0.35, 1.1, 0.35]} color="#f59e0b" />
        <Block position={[19.4, 0.95, 0.4]} scale={[6.8, 0.1, 0.1]} color="#ef4444" />
        <SceneText
          text="CASETA TAYO"
          position={[0, 3.25, 1.6]}
          fontSize={0.36}
          color="#1e293b"
          background="rgba(255,255,255,0.92)"
        />
      </group>

      {/* Architectural parked cars (west employee lot) */}
      {CAR_PARK_X.slice(0, 3).map((cx, i) => (
        <group key={cx} position={[cx, 0, 18.5]} rotation={[0, i % 2 === 0 ? 0 : Math.PI, 0]}>
          <Block position={[0, 0.42, 0]} scale={[1.8, 0.58, 3.7]} color="#f8fafc" />
          <Block
            position={[0, 0.88, -0.15]}
            scale={[1.55, 0.45, 2.0]}
            color="#64748b"
            roughness={0.35}
          />
        </group>
      ))}

      {/* Standby parked trailers in east staging lot */}
      {TRAILER_PARK_X.slice(0, 2).map((tx) => (
        <group key={tx} position={[tx, 0, 19.5]}>
          <Block position={[0, 1.85, 0]} scale={[2.5, 2.7, 7.8]} color="#f1f5f9" />
          <Block position={[0, 0.48, -2.5]} scale={[2.2, 0.45, 1.8]} color="#334155" />
          <Block position={[0, 0.48, 2.5]} scale={[2.2, 0.45, 1.8]} color="#334155" />
          <Block position={[0, 2.7, 0]} scale={[2.54, 0.2, 7.82]} color="#94a3b8" />
        </group>
      ))}

      {/* 5 Exterior Loading Dock Bays along DOCK_X (frontZ = 4) */}
      {DOCK_X.map((dx, index) => {
        const carrier = transportistas[index];
        const dockLabel = `ANDÉN 0${index + 1}`;
        const carrierLabel = carrier
          ? shortCarrierName(carrier.empresa_transportista)
          : "DISPONIBLE";
        const clickId = carrier ? `truck:${carrier.id_transportista}` : undefined;

        return (
          <group key={dx} position={[dx, 0, BUILDING.frontZ]}>
            {/* Dock leveler steel plate */}
            <Block
              position={[0, 0.04, 0.35]}
              scale={[3.2, 0.08, 1.3]}
              color="#94a3b8"
              metalness={0.35}
              roughness={0.5}
            />
            {/* Rubber dock bumpers */}
            <Block position={[-1.55, 0.55, 0.24]} scale={[0.32, 0.75, 0.24]} color="#1e293b" />
            <Block position={[1.55, 0.55, 0.24]} scale={[0.32, 0.75, 0.24]} color="#1e293b" />

            {/* Interactive dock apron pad */}
            {clickId && (
              <mesh
                position={[0, 0.01, 7.8]}
                rotation={[-Math.PI / 2, 0, 0]}
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
              >
                <planeGeometry args={[4.4, 13.5]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            )}

            {/* Painted dock numbers & carrier name on concrete apron */}
            <SceneText
              text={dockLabel}
              position={[0, 0.012, 14.3]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.55}
              color="#334155"
              background="rgba(255,255,255,0.86)"
              borderColor="#cbd5e1"
            />
            <SceneText
              text={carrierLabel}
              position={[0, 0.012, 15.65]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.38}
              maxWidth={4.5}
              color="#475569"
            />
          </group>
        );
      })}
    </group>
  );
}
