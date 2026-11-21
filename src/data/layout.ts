import type { JourneyStageDef, ZonaCodigo } from "../types/wms";

export const BUILDING = {
  minX: -36,
  maxX: 36,
  backZ: -38,
  frontZ: 4,
  height: 11,
  wall: 0.35,
} as const;

export const BUILDING_WIDTH = BUILDING.maxX - BUILDING.minX;
export const BUILDING_DEPTH = BUILDING.frontZ - BUILDING.backZ;
export const BUILDING_CENTER_Z = (BUILDING.frontZ + BUILDING.backZ) / 2;

export const OFFICE = {
  minX: -36,
  maxX: -24,
  frontZ: 5.5,
  backZ: -7,
  height: 12,
} as const;

export const CAMPUS = {
  fenceX: 60,
  fenceBackZ: -52,
  fenceFrontZ: 34,
  gateHalfWidth: 11,
} as const;

export const DOCK_X = [-18, -9, 0, 9, 18] as const;

export const CAMERA = {
  exterior: {
    target: [2, 0, -10] as [number, number, number],
    position: [46, 56, 66] as [number, number, number],
  },
  interior: {
    target: [0, 0, -17] as [number, number, number],
    position: [38, 48, 28] as [number, number, number],
  },
  bounds: {
    exterior: { minX: -66, maxX: 66, minZ: -50, maxZ: 42 },
    interior: { minX: -34, maxX: 34, minZ: -36, maxZ: 2 },
  },
} as const;

export interface ZoneLayoutDef {
  id: ZonaCodigo;
  number: string;
  name: string;
  description: string;
  position: [number, number, number];
  size: [number, number];
}

export const ZONES_LAYOUT: ZoneLayoutDef[] = [
  {
    id: "Z-ALM",
    number: "01",
    name: "Zona de Almacén General",
    description:
      "Pasillos A y B con racks de 2 niveles (RCK 1,000 kg) para celosías y lámparas, y bahías de piso (PIS 2,500 kg) para mesas y macetas.",
    position: [-4, 0, -21],
    size: [54, 24],
  },
  {
    id: "Z-STAG",
    number: "02",
    name: "Zona de Staging / Muelle de Despacho",
    description:
      "Área de pre-embarque frente a los 5 muelles de carga (STAG-PIS-A-00-01..06) para consolidación de salidas y retorno de sobrantes (-RET).",
    position: [0, 0, -2.2],
    size: [46, 6.5],
  },
];

export const AISLE_X = [-22, -14, -6, 2, 10, 18] as const;
export const STAG_X = [-17.5, -10.5, -3.5, 3.5, 10.5, 17.5] as const;

/**
 * Resolves the exact 3D world coordinates [x, y, z] for any UBICACION code in TAYO_WMS.
 */
export function getUbicacionPosition3d(
  codigo_ubicacion: string
): [number, number, number] {
  const parts = codigo_ubicacion.split("-");
  if (parts.length < 5) {
    return [0, 0, 0];
  }

  const [zona, soporte, pasillo, nivelStr, posStr] = parts;
  const nivel = Number.parseInt(nivelStr, 10);
  const pos = Number.parseInt(posStr, 10);

  if (zona === "STAG") {
    const x = STAG_X[pos - 1] ?? 0;
    return [x, 0, -2.2];
  }

  if (zona === "ALM") {
    const x = AISLE_X[pos - 1] ?? 0;
    if (pasillo === "A") {
      if (soporte === "PIS" || nivel === 0) return [x, 0, -12.5];
      if (nivel === 1) return [x, 0.25, -17.5];
      if (nivel === 2) return [x, 3.05, -17.5];
    }
    if (pasillo === "B") {
      if (soporte === "PIS" || nivel === 0) return [x, 0, -24.5];
      if (nivel === 1) return [x, 0.25, -29.5];
      if (nivel === 2) return [x, 3.05, -29.5];
    }
  }

  return [0, 0, 0];
}

export const JOURNEY_STAGES: JourneyStageDef[] = [
  {
    index: 0,
    code: "ENT",
    title: "Entrada",
    subtitle: "Recepción / Entrada",
    sqlAction: "EXEC sp_RegistrarEntrada",
    description:
      "Lote de concreto arquitectónico ingresa al CEDIS, asigna tarima VACIA y calcula FLOOR(capacidad_max_kg / peso_unitario_kg).",
    position: [-29, 0.2, -10],
  },
  {
    index: 1,
    code: "ALM",
    title: "Acomodo Z-ALM",
    subtitle: "Putaway NULL → Z-ALM",
    sqlAction: "REUBICACION (REU-E*-T*)",
    description:
      "Montacargas traslada la tarima a Rack (RCK 1,000 kg para CEL/LAM) o Piso (PIS 2,500 kg para MES/MAC) con estatus EN_ALMACEN.",
    position: [-14, 3.05, -29.5],
  },
  {
    index: 2,
    code: "SLO",
    title: "Slotting",
    subtitle: "Slotting Interno",
    sqlAction: "EXEC sp_RegistrarReubicacion",
    description:
      "Operador reubica la tarima dentro de Z-ALM (Pasillo B → Pasillo A) para acercar SKU de alta rotación al área de surtido.",
    position: [-6, 0.25, -17.5],
  },
  {
    index: 3,
    code: "STG",
    title: "Staging Z-STAG",
    subtitle: "Staging Pre-Embarque",
    sqlAction: "REUBICACION (-STG)",
    description:
      "Durante sp_RegistrarSalida, la tarima pasa a STAG-PIS-A-00-03 con estatus EN_STAGING frente al muelle antes de cargar.",
    position: [-3.5, 0.15, -2.2],
  },
  {
    index: 4,
    code: "SAL",
    title: "Despacho",
    subtitle: "Despacho a Transportista",
    sqlAction: "EXEC sp_RegistrarSalida (-VAC / -RET)",
    description:
      "Se surte el pedido al camión del transportista; la tarima pasa a VACIA (NULL) si se agota al 100% o retorna (-RET) a Z-ALM si es salida parcial.",
    position: [0, 0.2, 6.2],
  },
];
