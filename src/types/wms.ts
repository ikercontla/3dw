import type { MutableRefObject } from "react";

export type CategoriaCodigo = "CEL" | "MES" | "LAM" | "MAC";
export type ModeloCodigo = "HEX" | "BRU" | "CIL" | "REC";
export type ColorCodigo = "GN" | "BL" | "TC" | "NG";
export type ZonaCodigo = "Z-ALM" | "Z-STAG";
export type SoporteCodigo = "RCK" | "PIS";
export type TarimaEstatus = "VACIA" | "EN_ALMACEN" | "EN_STAGING";

export type ViewMode = "exterior" | "interior";
export type QualityMode = "high" | "balanced";
export type DataSourceMode = "sqlserver" | "memory";

export const MINERAL_COLOR_HEX: Record<ColorCodigo, string> = {
  GN: "#9a9790",
  BL: "#f0ede6",
  TC: "#c66b4e",
  NG: "#2b2b2d",
};

export interface CategoriaProducto {
  id_categoria: number;
  codigo_cat: CategoriaCodigo;
  nombre_categoria: string;
}

export interface ModeloDiseno {
  id_modelo: number;
  codigo_mod: ModeloCodigo;
  nombre_modelo: string;
}

export interface ColorMineral {
  id_color: number;
  codigo_col: ColorCodigo;
  nombre_color: string;
}

export interface Producto {
  id_producto: number;
  sku: string;
  nombre_descripcion: string;
  id_categoria: number;
  codigo_cat: CategoriaCodigo;
  nombre_categoria: string;
  id_modelo: number;
  codigo_mod: ModeloCodigo;
  nombre_modelo: string;
  id_color: number;
  codigo_col: ColorCodigo;
  nombre_color: string;
  alto_cm: number;
  ancho_cm: number;
  profundidad_cm: number;
  peso_unitario_kg: number;
  costo_unitario: number;
  precio_venta: number;
  stock_minimo: number;
  stock_ideal: number;
}

export interface ZonaAlmacen {
  id_zona: number;
  codigo_zona: ZonaCodigo;
  nombre_zona: string;
}

export interface TipoSoporte {
  id_tipo_soporte: number;
  codigo_soporte: SoporteCodigo;
  nombre_soporte: string;
  capacidad_max_kg: number;
}

export interface ResponsableAlmacen {
  id_responsable_almacen: number;
  codigo_responsable: string;
  nombre: string;
  apellido: string;
  activo: boolean;
}

export interface TipoEntrada {
  id_tipo_entrada: number;
  codigo_tipo: string;
  nombre_tipo: string;
}

export interface TipoSalida {
  id_tipo_salida: number;
  codigo_tipo: string;
  nombre_tipo: string;
}

export interface Cliente {
  id_cliente: number;
  nombre_razon_social: string;
  telefono: string;
  correo: string | null;
  direccion_entrega: string;
}

export interface Transportista {
  id_transportista: number;
  empresa_transportista: string;
  telefono_contacto: string;
}

export interface TarimaInventoryItem {
  id_producto: number;
  sku: string;
  nombre_descripcion: string;
  codigo_cat: CategoriaCodigo;
  nombre_categoria: string;
  codigo_mod: ModeloCodigo;
  nombre_modelo: string;
  codigo_col: ColorCodigo;
  nombre_color: string;
  cantidad: number;
  peso_unitario_kg: number;
  peso_total_kg: number;
}

export interface TarimaState {
  id_tarima: number;
  codigo_tarima: string;
  estatus_tarima: TarimaEstatus;
  id_ubicacion: number | null;
  codigo_ubicacion: string | null;
  codigo_zona: ZonaCodigo | null;
  codigo_soporte: SoporteCodigo | null;
  capacidad_max_kg: number | null;
  items: TarimaInventoryItem[];
  total_piezas: number;
  peso_total_kg: number;
}

export interface UbicacionState {
  id_ubicacion: number;
  id_zona: number;
  codigo_zona: ZonaCodigo;
  id_tipo_soporte: number;
  codigo_soporte: SoporteCodigo;
  nombre_soporte: string;
  capacidad_max_kg: number;
  codigo_ubicacion: string;
  pasillo: string;
  nivel: number;
  posicion: number;
  activa: boolean;
  tarima: TarimaState | null;
  position3d: [number, number, number];
}

export interface WmsTimelineEvent {
  id: string;
  tipo: "ENTRADA" | "SALIDA" | "REUBICACION";
  folio: string;
  fecha_hora: string;
  resumen: string;
  tarimaCodigo?: string;
  ubicacionDestino?: string | null;
}

export interface WmsBootstrapData {
  source: DataSourceMode;
  categorias: CategoriaProducto[];
  modelos: ModeloDiseno[];
  colores: ColorMineral[];
  productos: Producto[];
  zonas: ZonaAlmacen[];
  tiposSoporte: TipoSoporte[];
  responsables: ResponsableAlmacen[];
  tiposEntrada: TipoEntrada[];
  tiposSalida: TipoSalida[];
  clientes: Cliente[];
  transportistas: Transportista[];
  ubicaciones: UbicacionState[];
  tarimas: TarimaState[];
  recentEvents: WmsTimelineEvent[];
  stats: {
    totalPiezas: number;
    tarimasActivas: number;
    tarimasVacias: number;
    ubicacionesOcupadas: number;
    ubicacionesTotales: number;
    alertasMinimoCount: number;
  };
}

export interface WmsStatusResponse {
  mode: DataSourceMode;
  sqlConfigured: boolean;
  sqlConnected: boolean;
  database: string;
  message: string;
}

export interface RegistrarEntradaRequest {
  folio_entrada: string;
  fecha_hora_entrada: string;
  id_responsable_almacen: number;
  id_tipo_entrada: number;
  id_producto: number;
  cantidad_total: number;
}

export interface RegistrarSalidaRequest {
  folio_salida: string;
  fecha_hora_salida: string;
  id_tipo_salida: number;
  id_cliente: number;
  id_transportista: number;
  id_responsable_almacen: number;
  id_producto: number;
  cantidad_total: number;
}

export interface RegistrarReubicacionRequest {
  folio_reubicacion: string;
  fecha_hora_reubicacion: string;
  id_ubicacion_destino: number | null;
  id_tarima: number;
  id_responsable_almacen: number;
}

export interface OperationResult {
  ok: boolean;
  message: string;
  sqlCommand: string;
  affectedTarimaIds: number[];
  affectedUbicacionIds: number[];
  focusUbicacionCodigo?: string | null;
  focusTarimaCodigo?: string | null;
  snapshot: WmsBootstrapData;
}

export interface ExistenciaRow {
  sku: string;
  descripcion: string;
  categoria: string;
  codigo_cat: CategoriaCodigo;
  zona: ZonaCodigo;
  ubicacion: string;
  tarima: string;
  soporte: string;
  existenciaPiezas: number;
  pesoTotalTarimaKg: number;
  capacidadMaxSoporteKg: number;
  id_ubicacion: number;
  id_tarima: number;
}

export interface AlertaMinimoRow {
  sku: string;
  producto: string;
  categoria: string;
  stockMinimo: number;
  stockIdeal: number;
  existenciaActual: number;
  sugerenciaFabricacionPiezas: number;
  costoEstimadoProduccion: number;
}

export interface RotacionRow {
  sku: string;
  producto: string;
  categoria: string;
  unidadesVendidas: number;
  precioUnitarioVenta: number;
  importeTotalVenta: number;
  margenBrutoTotal: number;
  numeroPedidosSurtidos: number;
}

export interface ValorInventarioRow {
  sku: string;
  producto: string;
  categoria: string;
  costoUnitario: number;
  existenciaFechaCorte: number;
  valorTotalInventario: number;
}

export interface SinMovimientoRow {
  sku: string;
  producto: string;
  categoria: string;
  existenciaActualAlmacen: number;
  capitalInmovilizado: number;
}

export interface KardexRow {
  fechaHora: string;
  operacion: string;
  folioDocumento: string;
  codigoTarima: string;
  responsable: string;
  entrada: number;
  salida: number;
  saldoAcumulado: number;
}

export interface JourneySeek {
  stage: number;
  key: number;
}

export interface JourneyStageDef {
  index: number;
  code: string;
  title: string;
  subtitle: string;
  sqlAction: string;
  description: string;
  position: [number, number, number];
}

export interface WarehouseSceneProps {
  mode: ViewMode;
  selectedId: string;
  hoveredId: string | null;
  focusKey: number;
  animate: boolean;
  following: boolean;
  journeyRunning: boolean;
  journeyStage: number;
  journeyRunId: number;
  playbackSpeed: number;
  playbackPaused: boolean;
  quality: QualityMode;
  journeySeek: JourneySeek | null;
  journeyClock?: MutableRefObject<number>;
  ubicaciones: UbicacionState[];
  tarimas: TarimaState[];
  responsables: ResponsableAlmacen[];
  transportistas: Transportista[];
  highlightedUbicacionIds?: number[];
  onReady?: () => void;
  onJourneyStage: (stage: number) => void;
  onJourneyFinish: () => void;
  onManualCamera: () => void;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}
