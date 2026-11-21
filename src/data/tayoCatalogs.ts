import type {
  CategoriaProducto,
  Cliente,
  ColorMineral,
  ModeloDiseno,
  Producto,
  RegistrarEntradaRequest,
  RegistrarReubicacionRequest,
  RegistrarSalidaRequest,
  ResponsableAlmacen,
  TarimaEstatus,
  TipoEntrada,
  TipoSalida,
  TipoSoporte,
  Transportista,
  ZonaAlmacen,
} from "../types/wms";

export const CATEGORIAS: CategoriaProducto[] = [
  { id_categoria: 1, codigo_cat: "CEL", nombre_categoria: "Celosía" },
  { id_categoria: 2, codigo_cat: "MES", nombre_categoria: "Mesa" },
  { id_categoria: 3, codigo_cat: "LAM", nombre_categoria: "Lámpara" },
  { id_categoria: 4, codigo_cat: "MAC", nombre_categoria: "Maceta" },
];

export const MODELOS: ModeloDiseno[] = [
  { id_modelo: 1, codigo_mod: "HEX", nombre_modelo: "Hexagonal" },
  { id_modelo: 2, codigo_mod: "BRU", nombre_modelo: "Brutalista" },
  { id_modelo: 3, codigo_mod: "CIL", nombre_modelo: "Cilíndrico" },
  { id_modelo: 4, codigo_mod: "REC", nombre_modelo: "Rectangular" },
];

export const COLORES: ColorMineral[] = [
  { id_color: 1, codigo_col: "GN", nombre_color: "Gris Natural" },
  { id_color: 2, codigo_col: "BL", nombre_color: "Blanco" },
  { id_color: 3, codigo_col: "TC", nombre_color: "Terracota" },
  { id_color: 4, codigo_col: "NG", nombre_color: "Negro" },
];

export const ZONAS: ZonaAlmacen[] = [
  { id_zona: 1, codigo_zona: "Z-ALM", nombre_zona: "Zona de Almacén General" },
  {
    id_zona: 2,
    codigo_zona: "Z-STAG",
    nombre_zona: "Zona de Staging / Muelle de Despacho",
  },
];

export const TIPOS_SOPORTE: TipoSoporte[] = [
  {
    id_tipo_soporte: 1,
    codigo_soporte: "RCK",
    nombre_soporte: "Rack",
    capacidad_max_kg: 1000.0,
  },
  {
    id_tipo_soporte: 2,
    codigo_soporte: "PIS",
    nombre_soporte: "Piso",
    capacidad_max_kg: 2500.0,
  },
];

export const RESPONSABLES: ResponsableAlmacen[] = [
  {
    id_responsable_almacen: 1,
    codigo_responsable: "RESP-01",
    nombre: "Carlos",
    apellido: "Mendoza",
    activo: true,
  },
  {
    id_responsable_almacen: 2,
    codigo_responsable: "RESP-02",
    nombre: "Fernanda",
    apellido: "Ríos",
    activo: true,
  },
  {
    id_responsable_almacen: 3,
    codigo_responsable: "RESP-03",
    nombre: "Javier",
    apellido: "Ortega",
    activo: true,
  },
  {
    id_responsable_almacen: 4,
    codigo_responsable: "RESP-04",
    nombre: "Lucía",
    apellido: "Navarro",
    activo: true,
  },
  {
    id_responsable_almacen: 5,
    codigo_responsable: "RESP-05",
    nombre: "Miguel",
    apellido: "Castillo",
    activo: true,
  },
  {
    id_responsable_almacen: 6,
    codigo_responsable: "RESP-06",
    nombre: "Roberto",
    apellido: "Gómez",
    activo: false,
  },
];

export const TIPOS_ENTRADA: TipoEntrada[] = [
  { id_tipo_entrada: 1, codigo_tipo: "PROD", nombre_tipo: "Producción" },
  { id_tipo_entrada: 2, codigo_tipo: "DEV", nombre_tipo: "Devolución" },
  { id_tipo_entrada: 3, codigo_tipo: "AJU", nombre_tipo: "Ajuste" },
];

export const TIPOS_SALIDA: TipoSalida[] = [
  { id_tipo_salida: 1, codigo_tipo: "VTA", nombre_tipo: "Venta" },
  { id_tipo_salida: 2, codigo_tipo: "GAR", nombre_tipo: "Garantía" },
  { id_tipo_salida: 3, codigo_tipo: "MER", nombre_tipo: "Merma" },
];

export const CLIENTES: Cliente[] = [
  {
    id_cliente: 1,
    nombre_razon_social: "Estudio Arq. Vértice S.A. de C.V.",
    telefono: "3314502210",
    correo: "compras@verticearq.mx",
    direccion_entrega: "Av. Américas 1450, Providencia, Guadalajara, Jal.",
  },
  {
    id_cliente: 2,
    nombre_razon_social: "Constructora Tierra Nova S.A.P.I.",
    telefono: "3338124490",
    correo: "obra@tierranova.mx",
    direccion_entrega: "Av. Patria 820, Jardines Universidad, Zapopan, Jal.",
  },
  {
    id_cliente: 3,
    nombre_razon_social: "Taller Interiorismo Bosco",
    telefono: "3319207731",
    correo: "proyectos@boscointerior.com",
    direccion_entrega: "Calle Colomos 2180, Ladrón de Guevara, Guadalajara, Jal.",
  },
  {
    id_cliente: 4,
    nombre_razon_social: "Desarrollos Habitacionales Occidente",
    telefono: "3336401188",
    correo: "logistica@dhoccidente.mx",
    direccion_entrega: "Blvd. Puerta de Hierro 5100, Zapopan, Jal.",
  },
  {
    id_cliente: 5,
    nombre_razon_social: "Casa & Paisaje Diseño Urbano",
    telefono: "3311885540",
    correo: "contacto@casapaisaje.mx",
    direccion_entrega: "Av. Chapultepec Sur 412, Americana, Guadalajara, Jal.",
  },
  {
    id_cliente: 6,
    nombre_razon_social: "Hotel Boutique Piedra Blanca",
    telefono: "3222903315",
    correo: "mantenimiento@piedrablanca.mx",
    direccion_entrega: "Carr. a Barra de Navidad Km 7.5, Puerto Vallarta, Jal.",
  },
  {
    id_cliente: 7,
    nombre_razon_social: "Arquitectura Modular del Bajío",
    telefono: "4777149022",
    correo: "abastecimiento@ambajio.mx",
    direccion_entrega: "Blvd. Campestre 1905, Jardines del Moral, León, Gto.",
  },
  {
    id_cliente: 8,
    nombre_razon_social: "Roberto Salcedo Galván",
    telefono: "3310448829",
    correo: null,
    direccion_entrega: "Calle Rubí 314, Residencial Victoria, Zapopan, Jal.",
  },
];

export const TRANSPORTISTAS: Transportista[] = [
  {
    id_transportista: 1,
    empresa_transportista: "Fletes y Mudanzas Occidente S.A.",
    telefono_contacto: "3336108800",
  },
  {
    id_transportista: 2,
    empresa_transportista: "Logística Pesada del Pacífico",
    telefono_contacto: "3338251470",
  },
  {
    id_transportista: 3,
    empresa_transportista: "Autotransportes Guadalajara Express",
    telefono_contacto: "3331229940",
  },
  {
    id_transportista: 4,
    empresa_transportista: "Carga Segura Bajío-Centro",
    telefono_contacto: "4777185520",
  },
  {
    id_transportista: 5,
    empresa_transportista: "Plataformas y Grúas Tapatías",
    telefono_contacto: "3339440120",
  },
];

function createProducto(
  id_producto: number,
  nombre_descripcion: string,
  id_categoria: number,
  id_modelo: number,
  id_color: number,
  alto_cm: number,
  ancho_cm: number,
  profundidad_cm: number,
  peso_unitario_kg: number,
  costo_unitario: number,
  precio_venta: number,
  stock_minimo: number,
  stock_ideal: number
): Producto {
  const cat = CATEGORIAS.find((c) => c.id_categoria === id_categoria)!;
  const mod = MODELOS.find((m) => m.id_modelo === id_modelo)!;
  const col = COLORES.find((c) => c.id_color === id_color)!;
  const medidaPrincipal = Math.trunc(
    cat.codigo_cat === "MES" ? ancho_cm : alto_cm
  );
  const sku = `${cat.codigo_cat}-${mod.codigo_mod}-${col.codigo_col}-${medidaPrincipal}`;

  return {
    id_producto,
    sku,
    nombre_descripcion,
    id_categoria: cat.id_categoria,
    codigo_cat: cat.codigo_cat,
    nombre_categoria: cat.nombre_categoria,
    id_modelo: mod.id_modelo,
    codigo_mod: mod.codigo_mod,
    nombre_modelo: mod.nombre_modelo,
    id_color: col.id_color,
    codigo_col: col.codigo_col,
    nombre_color: col.nombre_color,
    alto_cm,
    ancho_cm,
    profundidad_cm,
    peso_unitario_kg,
    costo_unitario,
    precio_venta,
    stock_minimo,
    stock_ideal,
  };
}

export const PRODUCTOS: Producto[] = [
  // Celosías (1..16)
  createProducto(1, "Celosía Hexagonal Gris Natural 30 cm", 1, 1, 1, 30.0, 30.0, 10.0, 4.45, 95.0, 185.0, 60, 160),
  createProducto(2, "Celosía Hexagonal Blanco 30 cm", 1, 1, 2, 30.0, 30.0, 10.0, 4.55, 105.0, 195.0, 55, 150),
  createProducto(3, "Celosía Hexagonal Terracota 30 cm", 1, 1, 3, 30.0, 30.0, 10.0, 4.6, 105.0, 195.0, 35, 100),
  createProducto(4, "Celosía Hexagonal Negro 30 cm", 1, 1, 4, 30.0, 30.0, 10.0, 4.5, 110.0, 205.0, 30, 90),
  createProducto(5, "Celosía Brutalista Gris Natural 40 cm", 1, 2, 1, 40.0, 20.0, 12.0, 5.6, 110.0, 210.0, 45, 125),
  createProducto(6, "Celosía Brutalista Blanco 40 cm", 1, 2, 2, 40.0, 20.0, 12.0, 5.75, 120.0, 225.0, 40, 115),
  createProducto(7, "Celosía Brutalista Terracota 40 cm", 1, 2, 3, 40.0, 20.0, 12.0, 5.8, 120.0, 225.0, 25, 75),
  createProducto(8, "Celosía Brutalista Negro 40 cm", 1, 2, 4, 40.0, 20.0, 12.0, 5.7, 125.0, 235.0, 20, 65),
  createProducto(9, "Celosía Cilíndrica Gris Natural 25 cm", 1, 3, 1, 25.0, 25.0, 10.0, 4.2, 100.0, 195.0, 40, 110),
  createProducto(10, "Celosía Cilíndrica Blanco 25 cm", 1, 3, 2, 25.0, 25.0, 10.0, 4.3, 110.0, 210.0, 35, 100),
  createProducto(11, "Celosía Cilíndrica Terracota 25 cm", 1, 3, 3, 25.0, 25.0, 10.0, 4.35, 110.0, 210.0, 25, 70),
  createProducto(12, "Celosía Cilíndrica Negro 25 cm", 1, 3, 4, 25.0, 25.0, 10.0, 4.25, 115.0, 220.0, 20, 60),
  createProducto(13, "Celosía Rectangular Gris Natural 30 cm", 1, 4, 1, 30.0, 20.0, 8.0, 4.85, 98.0, 190.0, 65, 180),
  createProducto(14, "Celosía Rectangular Blanco 30 cm", 1, 4, 2, 30.0, 20.0, 8.0, 4.95, 108.0, 205.0, 50, 140),
  createProducto(15, "Celosía Rectangular Terracota 30 cm", 1, 4, 3, 30.0, 20.0, 8.0, 5.05, 108.0, 205.0, 30, 85),
  createProducto(16, "Celosía Rectangular Negro 30 cm", 1, 4, 4, 30.0, 20.0, 8.0, 5.0, 112.0, 215.0, 25, 75),

  // Lámparas (17..28)
  createProducto(17, "Lámpara Hexagonal Gris Natural 35 cm", 3, 1, 1, 35.0, 25.0, 25.0, 6.2, 420.0, 890.0, 22, 60),
  createProducto(18, "Lámpara Hexagonal Blanco 35 cm", 3, 1, 2, 35.0, 25.0, 25.0, 6.35, 440.0, 920.0, 20, 55),
  createProducto(19, "Lámpara Hexagonal Terracota 35 cm", 3, 1, 3, 35.0, 25.0, 25.0, 6.4, 440.0, 920.0, 12, 35),
  createProducto(20, "Lámpara Hexagonal Negro 35 cm", 3, 1, 4, 35.0, 25.0, 25.0, 6.3, 450.0, 950.0, 14, 40),
  createProducto(21, "Lámpara Brutalista Gris Natural 45 cm", 3, 2, 1, 45.0, 30.0, 30.0, 7.8, 460.0, 980.0, 16, 45),
  createProducto(22, "Lámpara Brutalista Blanco 45 cm", 3, 2, 2, 45.0, 30.0, 30.0, 7.95, 480.0, 1020.0, 15, 42),
  createProducto(23, "Lámpara Brutalista Terracota 45 cm", 3, 2, 3, 45.0, 30.0, 30.0, 8.05, 480.0, 1020.0, 8, 25),
  createProducto(24, "Lámpara Brutalista Negro 45 cm", 3, 2, 4, 45.0, 30.0, 30.0, 7.9, 490.0, 1050.0, 10, 30),
  createProducto(25, "Lámpara Cilíndrica Gris Natural 40 cm", 3, 3, 1, 40.0, 22.0, 22.0, 6.65, 430.0, 910.0, 25, 70),
  createProducto(26, "Lámpara Cilíndrica Blanco 40 cm", 3, 3, 2, 40.0, 22.0, 22.0, 6.8, 450.0, 950.0, 18, 50),
  createProducto(27, "Lámpara Cilíndrica Terracota 40 cm", 3, 3, 3, 40.0, 22.0, 22.0, 6.9, 450.0, 950.0, 10, 30),
  createProducto(28, "Lámpara Cilíndrica Negro 40 cm", 3, 3, 4, 40.0, 22.0, 22.0, 6.75, 460.0, 970.0, 12, 35),

  // Mesas (29..36)
  createProducto(29, "Mesa Brutalista Gris Natural 140 cm", 2, 2, 1, 76.0, 140.0, 85.0, 96.5, 3200.0, 6800.0, 0, 0),
  createProducto(30, "Mesa Brutalista Blanco 140 cm", 2, 2, 2, 76.0, 140.0, 85.0, 98.2, 3400.0, 7200.0, 0, 0),
  createProducto(31, "Mesa Brutalista Terracota 120 cm", 2, 2, 3, 75.0, 120.0, 80.0, 93.8, 3400.0, 7200.0, 0, 0),
  createProducto(32, "Mesa Brutalista Negro 120 cm", 2, 2, 4, 75.0, 120.0, 80.0, 94.6, 3500.0, 7400.0, 0, 0),
  createProducto(33, "Mesa Rectangular Gris Natural 120 cm", 2, 4, 1, 75.0, 120.0, 80.0, 84.0, 2950.0, 6200.0, 0, 0),
  createProducto(34, "Mesa Rectangular Blanco 120 cm", 2, 4, 2, 75.0, 120.0, 80.0, 85.5, 3150.0, 6600.0, 0, 0),
  createProducto(35, "Mesa Rectangular Terracota 100 cm", 2, 4, 3, 45.0, 100.0, 60.0, 68.4, 3150.0, 6600.0, 0, 0),
  createProducto(36, "Mesa Rectangular Negro 100 cm", 2, 4, 4, 45.0, 100.0, 60.0, 69.2, 3250.0, 6800.0, 0, 0),

  // Macetas (37..44)
  createProducto(37, "Maceta Cilíndrica Gris Natural 50 cm", 4, 3, 1, 50.0, 45.0, 45.0, 27.6, 650.0, 1390.0, 0, 0),
  createProducto(38, "Maceta Cilíndrica Blanco 50 cm", 4, 3, 2, 50.0, 45.0, 45.0, 28.3, 690.0, 1480.0, 0, 0),
  createProducto(39, "Maceta Cilíndrica Terracota 40 cm", 4, 3, 3, 40.0, 36.0, 36.0, 21.8, 690.0, 1480.0, 0, 0),
  createProducto(40, "Maceta Cilíndrica Negro 40 cm", 4, 3, 4, 40.0, 36.0, 36.0, 22.1, 710.0, 1520.0, 0, 0),
  createProducto(41, "Maceta Hexagonal Gris Natural 60 cm", 4, 1, 1, 60.0, 50.0, 50.0, 35.4, 720.0, 1540.0, 0, 0),
  createProducto(42, "Maceta Hexagonal Blanco 60 cm", 4, 1, 2, 60.0, 50.0, 50.0, 36.1, 760.0, 1620.0, 0, 0),
  createProducto(43, "Maceta Hexagonal Terracota 50 cm", 4, 1, 3, 50.0, 45.0, 45.0, 31.8, 760.0, 1620.0, 0, 0),
  createProducto(44, "Maceta Hexagonal Negro 50 cm", 4, 1, 4, 50.0, 45.0, 45.0, 32.3, 780.0, 1680.0, 0, 0),
];

export interface UbicacionSeed {
  id_ubicacion: number;
  id_zona: number;
  id_tipo_soporte: number;
  codigo_ubicacion: string;
  pasillo: string;
  nivel: number;
  posicion: number;
  activa: boolean;
}

function buildUbicacionRow(
  id_ubicacion: number,
  id_zona: number,
  id_tipo_soporte: number,
  prefix: string,
  pasillo: string,
  nivel: number,
  posicion: number
): UbicacionSeed {
  const nivelStr = String(nivel).padStart(2, "0");
  const posStr = String(posicion).padStart(2, "0");
  return {
    id_ubicacion,
    id_zona,
    id_tipo_soporte,
    codigo_ubicacion: `${prefix}-${pasillo}-${nivelStr}-${posStr}`,
    pasillo,
    nivel,
    posicion,
    activa: true,
  };
}

export const UBICACIONES_SEED: UbicacionSeed[] = [
  // 1..6: Z-ALM Pasillo A Piso
  ...[1, 2, 3, 4, 5, 6].map((pos, idx) =>
    buildUbicacionRow(1 + idx, 1, 2, "ALM-PIS", "A", 0, pos)
  ),
  // 7..12: Z-ALM Pasillo A Rack Nivel 1
  ...[1, 2, 3, 4, 5, 6].map((pos, idx) =>
    buildUbicacionRow(7 + idx, 1, 1, "ALM-RCK", "A", 1, pos)
  ),
  // 13..18: Z-ALM Pasillo A Rack Nivel 2
  ...[1, 2, 3, 4, 5, 6].map((pos, idx) =>
    buildUbicacionRow(13 + idx, 1, 1, "ALM-RCK", "A", 2, pos)
  ),
  // 19..24: Z-ALM Pasillo B Piso
  ...[1, 2, 3, 4, 5, 6].map((pos, idx) =>
    buildUbicacionRow(19 + idx, 1, 2, "ALM-PIS", "B", 0, pos)
  ),
  // 25..30: Z-ALM Pasillo B Rack Nivel 1
  ...[1, 2, 3, 4, 5, 6].map((pos, idx) =>
    buildUbicacionRow(25 + idx, 1, 1, "ALM-RCK", "B", 1, pos)
  ),
  // 31..36: Z-ALM Pasillo B Rack Nivel 2
  ...[1, 2, 3, 4, 5, 6].map((pos, idx) =>
    buildUbicacionRow(31 + idx, 1, 1, "ALM-RCK", "B", 2, pos)
  ),
  // 37..42: Z-STAG Pasillo A Piso
  ...[1, 2, 3, 4, 5, 6].map((pos, idx) =>
    buildUbicacionRow(37 + idx, 2, 2, "STAG-PIS", "A", 0, pos)
  ),
];

export interface TarimaSeed {
  id_tarima: number;
  codigo_tarima: string;
  estatus_tarima: TarimaEstatus;
  id_ubicacion: number | null;
}

export const TARIMAS_SEED: TarimaSeed[] = Array.from(
  { length: 30 },
  (_, index) => {
    const id_tarima = index + 1;
    return {
      id_tarima,
      codigo_tarima: `TAR-${String(id_tarima).padStart(3, "0")}`,
      estatus_tarima: "VACIA",
      id_ubicacion: null,
    };
  }
);

export type SimulacionOperacion =
  | { kind: "entrada"; params: RegistrarEntradaRequest }
  | { kind: "salida"; params: RegistrarSalidaRequest }
  | { kind: "reubicacion"; params: RegistrarReubicacionRequest };

function ent(
  folio_entrada: string,
  fecha_hora_entrada: string,
  id_responsable_almacen: number,
  id_tipo_entrada: number,
  id_producto: number,
  cantidad_total: number
): SimulacionOperacion {
  return {
    kind: "entrada",
    params: {
      folio_entrada,
      fecha_hora_entrada,
      id_responsable_almacen,
      id_tipo_entrada,
      id_producto,
      cantidad_total,
    },
  };
}

function sal(
  folio_salida: string,
  fecha_hora_salida: string,
  id_tipo_salida: number,
  id_cliente: number,
  id_transportista: number,
  id_responsable_almacen: number,
  id_producto: number,
  cantidad_total: number
): SimulacionOperacion {
  return {
    kind: "salida",
    params: {
      folio_salida,
      fecha_hora_salida,
      id_tipo_salida,
      id_cliente,
      id_transportista,
      id_responsable_almacen,
      id_producto,
      cantidad_total,
    },
  };
}

function reu(
  folio_reubicacion: string,
  fecha_hora_reubicacion: string,
  id_ubicacion_destino: number | null,
  id_tarima: number,
  id_responsable_almacen: number
): SimulacionOperacion {
  return {
    kind: "reubicacion",
    params: {
      folio_reubicacion,
      fecha_hora_reubicacion,
      id_ubicacion_destino,
      id_tarima,
      id_responsable_almacen,
    },
  };
}

export const SIMULACION_OPERACIONES: SimulacionOperacion[] = [
  // MES 1: MAYO 2026 (Op 001..020)
  ent("ENT-202605-001", "2026-05-02 08:30:00", 1, 1, 1, 300),
  ent("ENT-202605-002", "2026-05-03 09:15:00", 2, 1, 3, 140),
  ent("ENT-202605-003", "2026-05-04 10:00:00", 3, 1, 13, 250),
  ent("ENT-202605-004", "2026-05-05 11:20:00", 4, 1, 17, 75),
  ent("ENT-202605-005", "2026-05-06 09:40:00", 5, 1, 29, 16),
  ent("ENT-202605-006", "2026-05-07 14:10:00", 1, 1, 37, 24),
  sal("SAL-202605-001", "2026-05-08 15:30:00", 1, 1, 1, 1, 1, 240),
  sal("SAL-202605-002", "2026-05-10 12:00:00", 1, 2, 2, 2, 3, 60),
  ent("ENT-202605-007", "2026-05-12 08:50:00", 2, 1, 2, 160),
  sal("SAL-202605-003", "2026-05-13 16:00:00", 1, 3, 3, 3, 29, 16),
  sal("SAL-202605-004", "2026-05-14 10:45:00", 2, 2, 2, 1, 3, 5),
  reu("REU-202605-001", "2026-05-15 11:30:00", 15, 3, 4),
  ent("ENT-202605-008", "2026-05-18 09:10:00", 3, 1, 7, 60),
  sal("SAL-202605-005", "2026-05-19 13:20:00", 1, 4, 4, 5, 13, 250),
  sal("SAL-202605-006", "2026-05-21 15:00:00", 1, 5, 1, 2, 17, 75),
  ent("ENT-202605-009", "2026-05-23 10:05:00", 1, 2, 1, 20),
  sal("SAL-202605-007", "2026-05-25 14:30:00", 1, 6, 5, 4, 37, 24),
  ent("ENT-202605-010", "2026-05-27 09:00:00", 4, 1, 33, 12),
  reu("REU-202605-002", "2026-05-29 12:15:00", 19, 5, 5),
  sal("SAL-202605-008", "2026-05-30 16:10:00", 3, 1, 1, 3, 3, 5),

  // MES 2: JUNIO 2026 (Op 021..040)
  ent("ENT-202606-001", "2026-06-02 08:40:00", 1, 1, 5, 140),
  ent("ENT-202606-002", "2026-06-03 09:30:00", 2, 1, 25, 80),
  sal("SAL-202606-001", "2026-06-05 13:50:00", 1, 7, 3, 1, 33, 12),
  ent("ENT-202606-003", "2026-06-06 10:15:00", 3, 1, 11, 55),
  sal("SAL-202606-002", "2026-06-08 15:20:00", 1, 2, 2, 4, 2, 160),
  ent("ENT-202606-004", "2026-06-10 09:00:00", 4, 1, 3, 110),
  sal("SAL-202606-003", "2026-06-11 11:45:00", 1, 8, 5, 2, 1, 80),
  ent("ENT-202606-005", "2026-06-13 08:55:00", 5, 1, 39, 30),
  sal("SAL-202606-004", "2026-06-15 16:30:00", 1, 3, 1, 3, 3, 100),
  reu("REU-202606-001", "2026-06-17 10:00:00", 14, 1, 1),
  sal("SAL-202606-005", "2026-06-18 14:15:00", 2, 3, 1, 4, 3, 8),
  ent("ENT-202606-006", "2026-06-20 09:20:00", 2, 1, 21, 50),
  sal("SAL-202606-006", "2026-06-22 15:00:00", 1, 4, 4, 5, 39, 30),
  sal("SAL-202606-007", "2026-06-24 12:30:00", 1, 5, 3, 2, 25, 80),
  ent("ENT-202606-007", "2026-06-25 08:30:00", 3, 1, 30, 28),
  sal("SAL-202606-008", "2026-06-26 16:40:00", 1, 6, 2, 1, 5, 70),
  ent("ENT-202606-008", "2026-06-27 10:10:00", 1, 3, 3, 12),
  sal("SAL-202606-009", "2026-06-29 14:00:00", 1, 6, 2, 3, 30, 28),
  reu("REU-202606-002", "2026-06-30 11:20:00", 25, 3, 2),
  sal("SAL-202606-010", "2026-06-30 17:00:00", 3, 1, 1, 5, 5, 10),

  // MES 3: JULIO 2026 (Op 041..060)
  ent("ENT-202607-001", "2026-07-02 08:30:00", 1, 1, 1, 280),
  ent("ENT-202607-002", "2026-07-03 09:45:00", 4, 1, 9, 120),
  sal("SAL-202607-001", "2026-07-05 15:10:00", 1, 1, 1, 2, 1, 180),
  ent("ENT-202607-003", "2026-07-07 10:00:00", 2, 1, 15, 50),
  sal("SAL-202607-002", "2026-07-09 13:30:00", 1, 7, 4, 3, 11, 15),
  ent("ENT-202607-004", "2026-07-11 09:15:00", 3, 1, 18, 60),
  sal("SAL-202607-003", "2026-07-13 16:20:00", 1, 2, 2, 1, 21, 50),
  ent("ENT-202607-005", "2026-07-15 08:45:00", 5, 1, 41, 20),
  sal("SAL-202607-004", "2026-07-16 14:40:00", 1, 4, 5, 4, 41, 20),
  reu("REU-202607-001", "2026-07-18 11:00:00", 7, 12, 3),
  ent("ENT-202607-006", "2026-07-20 09:30:00", 1, 1, 13, 240),
  sal("SAL-202607-005", "2026-07-21 15:30:00", 1, 5, 1, 2, 7, 15),
  sal("SAL-202607-006", "2026-07-23 12:10:00", 2, 1, 1, 5, 1, 12),
  ent("ENT-202607-007", "2026-07-24 10:20:00", 2, 1, 17, 60),
  sal("SAL-202607-007", "2026-07-26 16:00:00", 1, 3, 3, 1, 13, 160),
  ent("ENT-202607-008", "2026-07-28 08:50:00", 4, 1, 31, 10),
  sal("SAL-202607-008", "2026-07-29 14:25:00", 1, 8, 2, 3, 31, 10),
  sal("SAL-202607-009", "2026-07-30 15:45:00", 1, 6, 4, 4, 17, 30),
  reu("REU-202607-002", "2026-07-31 10:30:00", 27, 13, 4),
  sal("SAL-202607-010", "2026-07-31 17:15:00", 3, 1, 1, 2, 1, 8),

  // MES 4: AGOSTO 2026 (Op 061..080)
  ent("ENT-202608-001", "2026-08-03 08:30:00", 1, 1, 4, 110),
  ent("ENT-202608-002", "2026-08-04 09:20:00", 2, 1, 23, 26),
  sal("SAL-202608-001", "2026-08-06 14:10:00", 1, 2, 2, 1, 3, 84),
  ent("ENT-202608-003", "2026-08-08 10:00:00", 3, 1, 3, 120),
  sal("SAL-202608-002", "2026-08-10 15:30:00", 1, 1, 1, 3, 1, 80),
  ent("ENT-202608-004", "2026-08-12 09:05:00", 4, 1, 35, 14),
  sal("SAL-202608-003", "2026-08-13 16:15:00", 1, 4, 5, 2, 35, 14),
  sal("SAL-202608-004", "2026-08-15 11:40:00", 1, 3, 3, 4, 23, 8),
  reu("REU-202608-001", "2026-08-17 10:15:00", 25, 5, 5),
  ent("ENT-202608-005", "2026-08-18 08:45:00", 1, 1, 2, 210),
  sal("SAL-202608-005", "2026-08-20 13:50:00", 1, 7, 4, 5, 13, 80),
  ent("ENT-202608-006", "2026-08-21 09:30:00", 2, 1, 43, 18),
  sal("SAL-202608-006", "2026-08-22 15:00:00", 1, 5, 2, 1, 43, 18),
  sal("SAL-202608-007", "2026-08-24 12:20:00", 2, 2, 4, 3, 2, 10),
  ent("ENT-202608-007", "2026-08-26 08:40:00", 3, 1, 1, 65),
  sal("SAL-202608-008", "2026-08-27 16:10:00", 1, 6, 1, 4, 17, 30),
  ent("ENT-202608-008", "2026-08-28 10:00:00", 4, 1, 21, 20),
  sal("SAL-202608-009", "2026-08-29 14:30:00", 1, 8, 3, 2, 9, 35),
  reu("REU-202608-002", "2026-08-31 11:00:00", 14, 5, 1),
  sal("SAL-202608-010", "2026-08-31 17:00:00", 3, 1, 1, 5, 18, 4),

  // MES 5: SEPTIEMBRE 2026 (Op 081..100)
  ent("ENT-202609-001", "2026-09-02 08:30:00", 1, 1, 3, 60),
  ent("ENT-202609-002", "2026-09-03 09:15:00", 2, 1, 27, 22),
  sal("SAL-202609-001", "2026-09-05 15:00:00", 1, 1, 1, 1, 3, 110),
  ent("ENT-202609-003", "2026-09-07 10:00:00", 3, 1, 36, 6),
  ent("ENT-202609-004", "2026-09-09 09:30:00", 4, 1, 42, 12),
  sal("SAL-202609-002", "2026-09-11 14:20:00", 1, 2, 2, 2, 5, 60),
  ent("ENT-202609-005", "2026-09-12 08:45:00", 5, 1, 13, 170),
  sal("SAL-202609-003", "2026-09-14 16:00:00", 1, 3, 4, 3, 4, 35),
  ent("ENT-202609-006", "2026-09-16 09:10:00", 1, 2, 3, 10),
  reu("REU-202609-001", "2026-09-17 11:30:00", 27, 2, 2),
  sal("SAL-202609-004", "2026-09-18 15:15:00", 1, 4, 5, 4, 18, 56),
  ent("ENT-202609-007", "2026-09-21 08:50:00", 2, 1, 17, 55),
  sal("SAL-202609-005", "2026-09-22 13:40:00", 1, 5, 3, 1, 1, 65),
  ent("ENT-202609-008", "2026-09-24 10:00:00", 3, 1, 25, 75),
  sal("SAL-202609-006", "2026-09-25 16:30:00", 2, 1, 1, 5, 3, 6),
  ent("ENT-202609-009", "2026-09-26 09:20:00", 4, 1, 38, 16),
  sal("SAL-202609-007", "2026-09-28 14:50:00", 1, 6, 2, 2, 38, 16),
  sal("SAL-202609-008", "2026-09-29 15:40:00", 1, 7, 1, 3, 3, 60),
  reu("REU-202609-002", "2026-09-30 10:45:00", 8, 8, 3),
  sal("SAL-202609-009", "2026-09-30 17:10:00", 3, 1, 1, 4, 21, 4),

  // MES 6: OCTUBRE 2026 (Op 101..120)
  ent("ENT-202610-001", "2026-10-02 08:30:00", 1, 1, 1, 240),
  sal("SAL-202610-001", "2026-10-04 14:00:00", 1, 1, 1, 1, 1, 200),
  ent("ENT-202610-002", "2026-10-06 09:20:00", 2, 1, 34, 10),
  sal("SAL-202610-002", "2026-10-08 15:30:00", 1, 2, 2, 2, 13, 130),
  ent("ENT-202610-003", "2026-10-10 10:15:00", 3, 1, 14, 130),
  sal("SAL-202610-003", "2026-10-12 13:20:00", 1, 3, 3, 3, 17, 45),
  ent("ENT-202610-004", "2026-10-13 09:00:00", 1, 1, 5, 25),
  sal("SAL-202610-004", "2026-10-14 16:00:00", 1, 4, 4, 4, 3, 10),
  reu("REU-202610-001", "2026-10-15 11:00:00", 31, 6, 5),
  ent("ENT-202610-005", "2026-10-16 09:15:00", 2, 3, 3, 6),
  sal("SAL-202610-005", "2026-10-18 14:40:00", 1, 5, 5, 2, 34, 6),
  ent("ENT-202610-006", "2026-10-20 08:40:00", 2, 1, 40, 15),
  sal("SAL-202610-006", "2026-10-21 15:50:00", 1, 6, 2, 1, 40, 15),
  sal("SAL-202610-007", "2026-10-23 12:15:00", 1, 7, 1, 3, 2, 95),
  ent("ENT-202610-007", "2026-10-24 09:30:00", 4, 1, 18, 42),
  sal("SAL-202610-008", "2026-10-26 16:10:00", 1, 8, 3, 5, 25, 25),
  sal("SAL-202610-009", "2026-10-27 14:20:00", 2, 7, 1, 2, 2, 5),
  sal("SAL-202610-010", "2026-10-28 15:30:00", 1, 1, 1, 1, 14, 40),
  sal("SAL-202610-011", "2026-10-29 11:45:00", 1, 2, 2, 4, 21, 8),
  reu("REU-202610-002", "2026-10-30 10:30:00", 32, 6, 3),
];
