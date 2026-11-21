import { useMemo, type ReactNode } from "react";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";

export const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

export interface CachedMaterialOptions {
  roughness?: number;
  metalness?: number;
  opacity?: number;
  transparent?: boolean;
  emissive?: string;
  emissiveIntensity?: number;
  depthWrite?: boolean;
}

export function getCachedMaterial(
  color: string,
  options: CachedMaterialOptions = {}
): THREE.MeshStandardMaterial {
  const {
    roughness = 0.86,
    metalness = 0.02,
    opacity = 1,
    transparent = opacity < 1,
    emissive = "#000000",
    emissiveIntensity = 0,
    depthWrite = true,
  } = options;

  const key = `${color}|${roughness.toFixed(2)}|${metalness.toFixed(
    2
  )}|${opacity.toFixed(2)}|${transparent ? 1 : 0}|${emissive}|${emissiveIntensity.toFixed(
    2
  )}|${depthWrite ? 1 : 0}`;

  const existing = materialCache.get(key);
  if (existing) return existing;

  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    opacity,
    transparent,
    emissive,
    emissiveIntensity,
    depthWrite,
  });
  materialCache.set(key, mat);
  return mat;
}

export const noRaycast: THREE.Object3D["raycast"] = () => {};

interface BlockProps {
  position?: [number, number, number];
  scale?: [number, number, number];
  rotation?: [number, number, number];
  color: string;
  roughness?: number;
  metalness?: number;
  opacity?: number;
  emissive?: string;
  emissiveIntensity?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
  interactive?: boolean;
}

export function Block({
  position = [0, 0, 0],
  scale = [1, 1, 1],
  rotation = [0, 0, 0],
  color,
  roughness = 0.86,
  metalness = 0.02,
  opacity = 1,
  emissive = "#000000",
  emissiveIntensity = 0,
  castShadow = true,
  receiveShadow = true,
  interactive = false,
}: BlockProps) {
  const material = useMemo(
    () =>
      getCachedMaterial(color, {
        roughness,
        metalness,
        opacity,
        emissive,
        emissiveIntensity,
      }),
    [color, roughness, metalness, opacity, emissive, emissiveIntensity]
  );

  return (
    <mesh
      geometry={UNIT_BOX}
      material={material}
      position={position}
      scale={scale}
      rotation={rotation}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      raycast={interactive ? undefined : noRaycast}
    />
  );
}

interface SelectionMarkProps {
  position?: [number, number, number];
  size?: [number, number];
  color?: string;
  thickness?: number;
  opacity?: number;
}

export function SelectionMark({
  position = [0, 0.025, 0],
  size = [2.2, 2.2],
  color = "#2d68e8",
  thickness = 0.09,
  opacity = 0.95,
}: SelectionMarkProps) {
  const [w, d] = size;
  const material = useMemo(
    () =>
      getCachedMaterial(color, {
        roughness: 0.4,
        metalness: 0.05,
        opacity,
        transparent: opacity < 1,
        emissive: color,
        emissiveIntensity: 0.45,
        depthWrite: false,
      }),
    [color, opacity]
  );

  const h = 0.03;

  return (
    <group position={position}>
      <mesh
        geometry={UNIT_BOX}
        material={material}
        position={[0, 0, -d / 2]}
        scale={[w + thickness, h, thickness]}
        raycast={noRaycast}
      />
      <mesh
        geometry={UNIT_BOX}
        material={material}
        position={[0, 0, d / 2]}
        scale={[w + thickness, h, thickness]}
        raycast={noRaycast}
      />
      <mesh
        geometry={UNIT_BOX}
        material={material}
        position={[-w / 2, 0, 0]}
        scale={[thickness, h, Math.max(0.05, d - thickness)]}
        raycast={noRaycast}
      />
      <mesh
        geometry={UNIT_BOX}
        material={material}
        position={[w / 2, 0, 0]}
        scale={[thickness, h, Math.max(0.05, d - thickness)]}
        raycast={noRaycast}
      />
    </group>
  );
}

interface CachedLabelTexture {
  texture: THREE.CanvasTexture;
  aspect: number;
}

const labelTextureCache = new Map<string, CachedLabelTexture>();

function getLabelTexture(
  text: string,
  color: string,
  background: string | undefined,
  borderColor: string | undefined,
  fontWeight: string | number,
  paddingX: number,
  paddingY: number
): CachedLabelTexture {
  const key = `${text}|${color}|${background ?? "none"}|${
    borderColor ?? "none"
  }|${fontWeight}|${paddingX}|${paddingY}`;

  const cached = labelTextureCache.get(key);
  if (cached) return cached;

  if (labelTextureCache.size > 300) {
    const oldest = labelTextureCache.keys().next().value;
    if (oldest) {
      labelTextureCache.get(oldest)?.texture.dispose();
      labelTextureCache.delete(oldest);
    }
  }

  const fontPx = 56;
  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");
  const fontSpec = `${fontWeight} ${fontPx}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;

  let textWidth = text.length * fontPx * 0.55;
  if (measureCtx) {
    measureCtx.font = fontSpec;
    textWidth = measureCtx.measureText(text).width;
  }

  const padX = paddingX;
  const padY = paddingY;
  const width = Math.max(64, Math.ceil(textWidth + padX * 2));
  const height = Math.max(64, Math.ceil(fontPx * 1.25 + padY * 2));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.clearRect(0, 0, width, height);
    const radius = Math.min(height / 2, 22);

    if (background) {
      ctx.fillStyle = background;
      ctx.beginPath();
      ctx.roundRect(2, 2, width - 4, height - 4, radius);
      ctx.fill();
    }

    if (borderColor) {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(2, 2, width - 4, height - 4, radius);
      ctx.stroke();
    }

    ctx.font = fontSpec;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, width / 2, height / 2 + 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;

  const entry = { texture, aspect: width / height };
  labelTextureCache.set(key, entry);
  return entry;
}

export interface SceneTextProps {
  text: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  fontSize?: number;
  maxWidth?: number;
  color?: string;
  background?: string;
  borderColor?: string;
  fontWeight?: string | number;
  paddingX?: number;
  paddingY?: number;
  billboard?: boolean;
  opacity?: number;
  visible?: boolean;
  renderOrder?: number;
}

export function SceneText({
  text,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  fontSize = 0.65,
  maxWidth,
  color = "#1e293b",
  background,
  borderColor,
  fontWeight = 700,
  paddingX = 24,
  paddingY = 12,
  billboard = false,
  opacity = 1,
  visible = true,
  renderOrder = 2,
}: SceneTextProps) {
  const { texture, aspect } = useMemo(
    () =>
      getLabelTexture(
        text,
        color,
        background,
        borderColor,
        fontWeight,
        paddingX,
        paddingY
      ),
    [text, color, background, borderColor, fontWeight, paddingX, paddingY]
  );

  const height = fontSize * 1.45;
  let width = height * aspect;
  let finalHeight = height;
  if (maxWidth && width > maxWidth) {
    const scale = maxWidth / width;
    width = maxWidth;
    finalHeight = height * scale;
  }

  const meshNode: ReactNode = (
    <mesh
      position={billboard ? [0, 0, 0] : position}
      rotation={billboard ? [0, 0, 0] : rotation}
      visible={visible}
      renderOrder={renderOrder}
      raycast={noRaycast}
    >
      <planeGeometry args={[width, finalHeight]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );

  if (billboard) {
    return (
      <Billboard position={position} follow lockX={false} lockY={false} lockZ={false}>
        {meshNode}
      </Billboard>
    );
  }

  return meshNode;
}
