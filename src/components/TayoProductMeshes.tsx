import { Component, Suspense, useMemo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import {
  MINERAL_COLOR_HEX,
  type CategoriaCodigo,
  type ColorCodigo,
  type TarimaInventoryItem,
} from "@/types/wms";
import { getCachedMaterial, noRaycast } from "./SceneText";

/**
 * Registry of custom 3D product assets placed in `public/models/`.
 * Set a category path (e.g. "/models/celosia.glb") once final meshes are ready;
 * when `null`, ultra-simple mineral-tinted primitives are rendered.
 */
export const MODEL_REGISTRY: Record<CategoriaCodigo, string | null> = {
  CEL: null,
  MES: null,
  LAM: null,
  MAC: null,
};

/**
 * Optional per-SKU or category+model overrides (e.g. "CEL-HEX": "/models/celosia-hex.glb").
 */
export const MODEL_VARIANT_REGISTRY: Partial<Record<string, string | null>> = {};

const PLACEHOLDER_GEOMETRIES: Record<CategoriaCodigo, THREE.BufferGeometry> = {
  CEL: new THREE.BoxGeometry(1.2, 0.9, 1.2),
  LAM: new THREE.CylinderGeometry(0.45, 0.45, 1.0, 20),
  MES: new THREE.BoxGeometry(1.5, 0.55, 1.1),
  MAC: new THREE.CylinderGeometry(0.55, 0.55, 0.75, 20),
};

const PLACEHOLDER_CENTER_Y: Record<CategoriaCodigo, number> = {
  CEL: 0.45,
  LAM: 0.5,
  MES: 0.275,
  MAC: 0.375,
};

interface PlaceholderMeshProps {
  codigoCat: CategoriaCodigo;
  codigoCol: ColorCodigo;
}

function PlaceholderProductMesh({ codigoCat, codigoCol }: PlaceholderMeshProps) {
  const hex = MINERAL_COLOR_HEX[codigoCol] ?? "#9a9790";
  const material = useMemo(
    () =>
      getCachedMaterial(hex, {
        roughness: 0.86,
        metalness: 0.02,
      }),
    [hex]
  );

  return (
    <mesh
      geometry={PLACEHOLDER_GEOMETRIES[codigoCat]}
      material={material}
      position={[0, PLACEHOLDER_CENTER_Y[codigoCat], 0]}
      castShadow
      receiveShadow
      raycast={noRaycast}
    />
  );
}

interface GltfProductModelProps {
  url: string;
}

function GltfProductModel({ url }: GltfProductModelProps) {
  const gltf = useGLTF(url);
  const cloned = useMemo(() => {
    const root = gltf.scene.clone(true);
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.raycast = noRaycast;
      }
    });
    return root;
  }, [gltf.scene]);

  return <primitive object={cloned} />;
}

interface ModelErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ModelErrorBoundaryState {
  hasError: boolean;
}

class ModelErrorBoundary extends Component<
  ModelErrorBoundaryProps,
  ModelErrorBoundaryState
> {
  state: ModelErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ModelErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export interface TayoProductMeshProps {
  item: Pick<
    TarimaInventoryItem,
    "codigo_cat" | "codigo_col" | "codigo_mod" | "sku"
  >;
  position?: [number, number, number];
  scale?: number;
}

export function TayoProductMesh({
  item,
  position = [0, 0, 0],
  scale = 1,
}: TayoProductMeshProps) {
  const modelUrl =
    MODEL_VARIANT_REGISTRY[item.sku] ??
    MODEL_VARIANT_REGISTRY[`${item.codigo_cat}-${item.codigo_mod}`] ??
    MODEL_REGISTRY[item.codigo_cat] ??
    null;

  const fallback = (
    <PlaceholderProductMesh
      codigoCat={item.codigo_cat}
      codigoCol={item.codigo_col}
    />
  );

  return (
    <group position={position} scale={scale}>
      {modelUrl ? (
        <ModelErrorBoundary fallback={fallback}>
          <Suspense fallback={fallback}>
            <GltfProductModel url={modelUrl} />
          </Suspense>
        </ModelErrorBoundary>
      ) : (
        fallback
      )}
    </group>
  );
}
