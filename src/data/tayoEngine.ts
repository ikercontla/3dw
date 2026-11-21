import { getUbicacionPosition3d } from "./layout";
import {
  CATEGORIAS,
  CLIENTES,
  COLORES,
  MODELOS,
  PRODUCTOS,
  RESPONSABLES,
  SIMULACION_OPERACIONES,
  TARIMAS_SEED,
  TIPOS_ENTRADA,
  TIPOS_SALIDA,
  TIPOS_SOPORTE,
  TRANSPORTISTAS,
  UBICACIONES_SEED,
  ZONAS,
} from "./tayoCatalogs";
import type {
  AlertaMinimoRow,
  DataSourceMode,
  ExistenciaRow,
  KardexRow,
  OperationResult,
  Producto,
  RegistrarEntradaRequest,
  RegistrarReubicacionRequest,
  RegistrarSalidaRequest,
  RotacionRow,
  SinMovimientoRow,
  TarimaEstatus,
  TarimaInventoryItem,
  TarimaState,
  UbicacionState,
  ValorInventarioRow,
  WmsBootstrapData,
  WmsTimelineEvent,
} from "../types/wms";

interface EntradaRow {
  id_entrada: number;
  folio_entrada: string;
  fecha_hora_entrada: string;
  id_responsable_almacen: number;
  id_tipo_entrada: number;
}

interface DetalleEntradaRow {
  id_detalle_entrada: number;
  id_entrada: number;
  id_producto: number;
  id_tarima: number;
  cantidad_ingresada: number;
}

interface SalidaRow {
  id_salida: number;
  folio_salida: string;
  fecha_hora_salida: string;
  id_tipo_salida: number;
  id_cliente: number;
  id_transportista: number;
  id_responsable_almacen: number;
}

interface DetalleSalidaRow {
  id_detalle_salida: number;
  id_salida: number;
  id_producto: number;
  id_tarima: number;
  cantidad_salida: number;
}

interface ReubicacionRow {
  id_reubicacion: number;
  folio_reubicacion: string;
  fecha_hora_reubicacion: string;
  id_ubicacion_origen: number | null;
  id_ubicacion_destino: number | null;
  id_tarima: number;
  id_responsable_almacen: number;
}

interface TarimaMutable {
  id_tarima: number;
  codigo_tarima: string;
  estatus_tarima: TarimaEstatus;
  id_ubicacion: number | null;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

function normalizeDateTime(raw?: string): string {
  if (!raw || !raw.trim()) {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
      now.getSeconds()
    )}`;
  }

  let s = raw.trim().replace("T", " ");
  if (s.endsWith("Z")) {
    s = s.slice(0, -1);
  }
  const dotIdx = s.indexOf(".");
  if (dotIdx !== -1) {
    s = s.slice(0, dotIdx);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return `${s} 00:00:00`;
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) {
    return `${s}:00`;
  }
  return s;
}

function normalizeRangeStart(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed} 00:00:00`;
  }
  return normalizeDateTime(trimmed);
}

function normalizeRangeEnd(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed} 23:59:59`;
  }
  return normalizeDateTime(trimmed);
}

const PRODUCTO_MAP = new Map<number, Producto>(
  PRODUCTOS.map((p) => [p.id_producto, p])
);
const ZONA_MAP = new Map(ZONAS.map((z) => [z.id_zona, z]));
const SOPORTE_MAP = new Map(TIPOS_SOPORTE.map((s) => [s.id_tipo_soporte, s]));
const UBICACION_MAP = new Map(
  UBICACIONES_SEED.map((u) => [u.id_ubicacion, u])
);
const RESPONSABLE_MAP = new Map(
  RESPONSABLES.map((r) => [r.id_responsable_almacen, r])
);
const TIPO_ENTRADA_MAP = new Map(
  TIPOS_ENTRADA.map((t) => [t.id_tipo_entrada, t])
);
const TIPO_SALIDA_MAP = new Map(
  TIPOS_SALIDA.map((t) => [t.id_tipo_salida, t])
);
const CLIENTE_MAP = new Map(CLIENTES.map((c) => [c.id_cliente, c]));
const TRANSPORTISTA_MAP = new Map(
  TRANSPORTISTAS.map((t) => [t.id_transportista, t])
);

export class TayoWmsEngine {
  private tarimas: TarimaMutable[] = [];
  private entradas: EntradaRow[] = [];
  private detalleEntradas: DetalleEntradaRow[] = [];
  private salidas: SalidaRow[] = [];
  private detalleSalidas: DetalleSalidaRow[] = [];
  private reubicaciones: ReubicacionRow[] = [];
  private timelineEvents: WmsTimelineEvent[] = [];

  private nextEntradaId = 1;
  private nextDetalleEntradaId = 1;
  private nextSalidaId = 1;
  private nextDetalleSalidaId = 1;
  private nextReubicacionId = 1;

  constructor(seedSimulation = true) {
    this.reset(seedSimulation);
  }

  public reset(seedSimulation = true): void {
    this.tarimas = TARIMAS_SEED.map((t) => ({ ...t }));
    this.entradas = [];
    this.detalleEntradas = [];
    this.salidas = [];
    this.detalleSalidas = [];
    this.reubicaciones = [];
    this.timelineEvents = [];

    this.nextEntradaId = 1;
    this.nextDetalleEntradaId = 1;
    this.nextSalidaId = 1;
    this.nextDetalleSalidaId = 1;
    this.nextReubicacionId = 1;

    if (seedSimulation) {
      for (const op of SIMULACION_OPERACIONES) {
        if (op.kind === "entrada") {
          this.registrarEntrada(op.params);
        } else if (op.kind === "salida") {
          this.registrarSalida(op.params);
        } else {
          this.registrarReubicacion(op.params);
        }
      }
    }
  }

  private getTarimaProductBalance(
    id_tarima: number,
    id_producto: number
  ): number {
    let totalIn = 0;
    for (const de of this.detalleEntradas) {
      if (de.id_tarima === id_tarima && de.id_producto === id_producto) {
        totalIn += de.cantidad_ingresada;
      }
    }
    let totalOut = 0;
    for (const ds of this.detalleSalidas) {
      if (ds.id_tarima === id_tarima && ds.id_producto === id_producto) {
        totalOut += ds.cantidad_salida;
      }
    }
    return totalIn - totalOut;
  }

  private getProductTotalBalance(id_producto: number): number {
    let totalIn = 0;
    for (const de of this.detalleEntradas) {
      if (de.id_producto === id_producto) {
        totalIn += de.cantidad_ingresada;
      }
    }
    let totalOut = 0;
    for (const ds of this.detalleSalidas) {
      if (ds.id_producto === id_producto) {
        totalOut += ds.cantidad_salida;
      }
    }
    return totalIn - totalOut;
  }

  private getProductWarehouseAvailable(id_producto: number): number {
    const enAlmacenIds = new Set(
      this.tarimas
        .filter((t) => t.estatus_tarima === "EN_ALMACEN")
        .map((t) => t.id_tarima)
    );
    let totalIn = 0;
    for (const de of this.detalleEntradas) {
      if (de.id_producto === id_producto && enAlmacenIds.has(de.id_tarima)) {
        totalIn += de.cantidad_ingresada;
      }
    }
    let totalOut = 0;
    for (const ds of this.detalleSalidas) {
      if (ds.id_producto === id_producto && enAlmacenIds.has(ds.id_tarima)) {
        totalOut += ds.cantidad_salida;
      }
    }
    return totalIn - totalOut;
  }

  private isUbicacionOccupied(id_ubicacion: number): boolean {
    return this.tarimas.some((t) => t.id_ubicacion === id_ubicacion);
  }

  public registrarEntrada(
    req: RegistrarEntradaRequest,
    source: DataSourceMode = "memory"
  ): OperationResult {
    const folio = req.folio_entrada.trim();
    if (!folio) {
      throw new Error("El folio de entrada es obligatorio.");
    }
    if (!Number.isInteger(req.cantidad_total) || req.cantidad_total <= 0) {
      throw new Error("La cantidad total a ingresar debe ser mayor a cero.");
    }
    if (this.entradas.some((e) => e.folio_entrada === folio)) {
      throw new Error(`El folio de entrada '${folio}' ya existe.`);
    }

    const producto = PRODUCTO_MAP.get(req.id_producto);
    if (!producto) {
      throw new Error("El producto especificado no existe.");
    }
    if (!RESPONSABLE_MAP.has(req.id_responsable_almacen)) {
      throw new Error("El responsable de almacén especificado no existe.");
    }
    const tipoEntrada = TIPO_ENTRADA_MAP.get(req.id_tipo_entrada);
    if (!tipoEntrada) {
      throw new Error("El tipo de entrada especificado no existe.");
    }

    const id_tipo_soporte =
      producto.id_categoria === 1 || producto.id_categoria === 3 ? 1 : 2;
    const soporte = SOPORTE_MAP.get(id_tipo_soporte)!;

    const max_piezas_tarima = Math.floor(
      Number((soporte.capacidad_max_kg / producto.peso_unitario_kg).toFixed(9))
    );
    if (max_piezas_tarima <= 0) {
      throw new Error(
        "El peso unitario del producto excede la capacidad máxima de la tarima/soporte."
      );
    }

    const tarimas_necesarias = Math.ceil(
      req.cantidad_total / max_piezas_tarima
    );

    const tarimasVacias = this.tarimas
      .filter((t) => t.estatus_tarima === "VACIA")
      .sort((a, b) => a.id_tarima - b.id_tarima);

    const ubicacionesLibres = UBICACIONES_SEED.filter(
      (u) =>
        u.id_zona === 1 &&
        u.id_tipo_soporte === id_tipo_soporte &&
        u.activa &&
        !this.isUbicacionOccupied(u.id_ubicacion)
    ).sort((a, b) => a.id_ubicacion - b.id_ubicacion);

    if (
      tarimasVacias.length < tarimas_necesarias ||
      ubicacionesLibres.length < tarimas_necesarias
    ) {
      throw new Error(
        "No hay suficientes tarimas vacías o ubicaciones disponibles en Z-ALM para recibir el lote."
      );
    }

    const fechaNorm = normalizeDateTime(req.fecha_hora_entrada);
    const id_entrada = this.nextEntradaId++;
    this.entradas.push({
      id_entrada,
      folio_entrada: folio,
      fecha_hora_entrada: fechaNorm,
      id_responsable_almacen: req.id_responsable_almacen,
      id_tipo_entrada: req.id_tipo_entrada,
    });

    let piezas_restantes = req.cantidad_total;
    const affectedTarimaIds: number[] = [];
    const affectedUbicacionIds: number[] = [];
    let focusUbicacionCodigo: string | null = null;
    let focusTarimaCodigo: string | null = null;

    let idx = 0;
    while (piezas_restantes > 0) {
      const piezas_tarima = Math.min(piezas_restantes, max_piezas_tarima);
      const tarima = tarimasVacias[idx];
      const ubicacion = ubicacionesLibres[idx];
      idx += 1;

      this.detalleEntradas.push({
        id_detalle_entrada: this.nextDetalleEntradaId++,
        id_entrada,
        id_producto: req.id_producto,
        id_tarima: tarima.id_tarima,
        cantidad_ingresada: piezas_tarima,
      });

      const folio_reubicacion = `REU-E${id_entrada}-T${tarima.id_tarima}`;
      this.reubicaciones.push({
        id_reubicacion: this.nextReubicacionId++,
        folio_reubicacion,
        fecha_hora_reubicacion: fechaNorm,
        id_ubicacion_origen: null,
        id_ubicacion_destino: ubicacion.id_ubicacion,
        id_tarima: tarima.id_tarima,
        id_responsable_almacen: req.id_responsable_almacen,
      });

      tarima.id_ubicacion = ubicacion.id_ubicacion;
      tarima.estatus_tarima = "EN_ALMACEN";

      affectedTarimaIds.push(tarima.id_tarima);
      affectedUbicacionIds.push(ubicacion.id_ubicacion);
      if (!focusUbicacionCodigo) {
        focusUbicacionCodigo = ubicacion.codigo_ubicacion;
        focusTarimaCodigo = tarima.codigo_tarima;
      }

      piezas_restantes -= piezas_tarima;
    }

    this.timelineEvents.push({
      id: `ent-${id_entrada}`,
      tipo: "ENTRADA",
      folio,
      fecha_hora: fechaNorm,
      resumen: `${tipoEntrada.codigo_tipo}: +${req.cantidad_total} pzas de ${producto.sku} en ${affectedTarimaIds.length} tarima(s)`,
      tarimaCodigo: focusTarimaCodigo ?? undefined,
      ubicacionDestino: focusUbicacionCodigo,
    });

    const sqlCommand =
      `EXEC sp_RegistrarEntrada ` +
      `@folio_entrada='${escapeSql(folio)}', ` +
      `@fecha_hora_entrada='${escapeSql(fechaNorm)}', ` +
      `@id_responsable_almacen=${req.id_responsable_almacen}, ` +
      `@id_tipo_entrada=${req.id_tipo_entrada}, ` +
      `@id_producto=${req.id_producto}, ` +
      `@cantidad_total=${req.cantidad_total};`;

    return {
      ok: true,
      message: `Entrada ${folio} registrada: ${req.cantidad_total} pzas de ${producto.sku} asignadas en ${affectedTarimaIds.length} tarima(s) (${soporte.codigo_soporte}).`,
      sqlCommand,
      affectedTarimaIds,
      affectedUbicacionIds,
      focusUbicacionCodigo,
      focusTarimaCodigo,
      snapshot: this.getSnapshot(source),
    };
  }

  public registrarSalida(
    req: RegistrarSalidaRequest,
    source: DataSourceMode = "memory"
  ): OperationResult {
    const folio = req.folio_salida.trim();
    if (!folio) {
      throw new Error("El folio de salida es obligatorio.");
    }
    if (!Number.isInteger(req.cantidad_total) || req.cantidad_total <= 0) {
      throw new Error("La cantidad total de salida debe ser mayor a cero.");
    }
    if (this.salidas.some((s) => s.folio_salida === folio)) {
      throw new Error(`El folio de salida '${folio}' ya existe.`);
    }

    const producto = PRODUCTO_MAP.get(req.id_producto);
    if (!producto) {
      throw new Error("El producto especificado no existe.");
    }
    const tipoSalida = TIPO_SALIDA_MAP.get(req.id_tipo_salida);
    if (!tipoSalida) {
      throw new Error("El tipo de salida especificado no existe.");
    }
    if (!CLIENTE_MAP.has(req.id_cliente)) {
      throw new Error("El cliente especificado no existe.");
    }
    if (!TRANSPORTISTA_MAP.has(req.id_transportista)) {
      throw new Error("El transportista especificado no existe.");
    }
    if (!RESPONSABLE_MAP.has(req.id_responsable_almacen)) {
      throw new Error("El responsable de almacén especificado no existe.");
    }

    const stockDisponible = this.getProductWarehouseAvailable(req.id_producto);
    if (stockDisponible < req.cantidad_total) {
      throw new Error(
        "Stock insuficiente en almacén para surtir la cantidad solicitada del producto."
      );
    }

    const ubicacionStaging = UBICACIONES_SEED.filter(
      (u) =>
        u.id_zona === 2 &&
        u.activa &&
        !this.isUbicacionOccupied(u.id_ubicacion)
    ).sort((a, b) => a.id_ubicacion - b.id_ubicacion)[0];

    if (!ubicacionStaging) {
      throw new Error(
        "No hay ubicaciones disponibles en la Zona de Staging (Z-STAG) para preparar la salida."
      );
    }

    const fechaNorm = normalizeDateTime(req.fecha_hora_salida);
    const id_salida = this.nextSalidaId++;
    this.salidas.push({
      id_salida,
      folio_salida: folio,
      fecha_hora_salida: fechaNorm,
      id_tipo_salida: req.id_tipo_salida,
      id_cliente: req.id_cliente,
      id_transportista: req.id_transportista,
      id_responsable_almacen: req.id_responsable_almacen,
    });

    let piezas_restantes = req.cantidad_total;
    const affectedTarimaIds: number[] = [];
    const affectedUbicacionIdsSet = new Set<number>([
      ubicacionStaging.id_ubicacion,
    ]);
    let focusUbicacionCodigo: string | null = ubicacionStaging.codigo_ubicacion;
    let focusTarimaCodigo: string | null = null;

    while (piezas_restantes > 0) {
      const candidate = this.tarimas
        .filter((t) => t.estatus_tarima === "EN_ALMACEN")
        .sort((a, b) => a.id_tarima - b.id_tarima)
        .map((t) => ({
          tarima: t,
          stock: this.getTarimaProductBalance(t.id_tarima, req.id_producto),
        }))
        .find((entry) => entry.stock > 0);

      if (!candidate || candidate.tarima.id_ubicacion === null) {
        throw new Error(
          "Stock insuficiente en almacén para surtir la cantidad solicitada del producto."
        );
      }

      const tarima = candidate.tarima;
      const stock_tarima = candidate.stock;
      const id_ubicacion_almacen = candidate.tarima.id_ubicacion;
      if (id_ubicacion_almacen === null) {
        throw new Error("La tarima seleccionada no tiene ubicación física asignada.");
      }
      affectedTarimaIds.push(tarima.id_tarima);
      affectedUbicacionIdsSet.add(id_ubicacion_almacen);

      // 1. Pre-embarque Z-ALM -> Z-STAG
      this.reubicaciones.push({
        id_reubicacion: this.nextReubicacionId++,
        folio_reubicacion: `REU-S${id_salida}-T${tarima.id_tarima}-STG`,
        fecha_hora_reubicacion: fechaNorm,
        id_ubicacion_origen: id_ubicacion_almacen,
        id_ubicacion_destino: ubicacionStaging.id_ubicacion,
        id_tarima: tarima.id_tarima,
        id_responsable_almacen: req.id_responsable_almacen,
      });
      tarima.id_ubicacion = ubicacionStaging.id_ubicacion;
      tarima.estatus_tarima = "EN_STAGING";

      const piezas_tomadas = Math.min(piezas_restantes, stock_tarima);
      this.detalleSalidas.push({
        id_detalle_salida: this.nextDetalleSalidaId++,
        id_salida,
        id_producto: req.id_producto,
        id_tarima: tarima.id_tarima,
        cantidad_salida: piezas_tomadas,
      });

      if (piezas_tomadas === stock_tarima) {
        // Vaciada al 100%: Z-STAG -> NULL
        this.reubicaciones.push({
          id_reubicacion: this.nextReubicacionId++,
          folio_reubicacion: `REU-S${id_salida}-T${tarima.id_tarima}-VAC`,
          fecha_hora_reubicacion: fechaNorm,
          id_ubicacion_origen: ubicacionStaging.id_ubicacion,
          id_ubicacion_destino: null,
          id_tarima: tarima.id_tarima,
          id_responsable_almacen: req.id_responsable_almacen,
        });
        tarima.id_ubicacion = null;
        tarima.estatus_tarima = "VACIA";
      } else {
        // Salida parcial: retorno a su ubicación en Z-ALM (-RET)
        this.reubicaciones.push({
          id_reubicacion: this.nextReubicacionId++,
          folio_reubicacion: `REU-S${id_salida}-T${tarima.id_tarima}-RET`,
          fecha_hora_reubicacion: fechaNorm,
          id_ubicacion_origen: ubicacionStaging.id_ubicacion,
          id_ubicacion_destino: id_ubicacion_almacen,
          id_tarima: tarima.id_tarima,
          id_responsable_almacen: req.id_responsable_almacen,
        });
        tarima.id_ubicacion = id_ubicacion_almacen;
        tarima.estatus_tarima = "EN_ALMACEN";

        const origenUbi = UBICACION_MAP.get(id_ubicacion_almacen);
        if (origenUbi) {
          focusUbicacionCodigo = origenUbi.codigo_ubicacion;
          focusTarimaCodigo = tarima.codigo_tarima;
        }
      }

      piezas_restantes -= piezas_tomadas;
    }

    this.timelineEvents.push({
      id: `sal-${id_salida}`,
      tipo: "SALIDA",
      folio,
      fecha_hora: fechaNorm,
      resumen: `${tipoSalida.codigo_tipo}: -${req.cantidad_total} pzas de ${producto.sku} vía ${ubicacionStaging.codigo_ubicacion}`,
      tarimaCodigo: focusTarimaCodigo ?? undefined,
      ubicacionDestino: focusUbicacionCodigo,
    });

    const sqlCommand =
      `EXEC sp_RegistrarSalida ` +
      `@folio_salida='${escapeSql(folio)}', ` +
      `@fecha_hora_salida='${escapeSql(fechaNorm)}', ` +
      `@id_tipo_salida=${req.id_tipo_salida}, ` +
      `@id_cliente=${req.id_cliente}, ` +
      `@id_transportista=${req.id_transportista}, ` +
      `@id_responsable_almacen=${req.id_responsable_almacen}, ` +
      `@id_producto=${req.id_producto}, ` +
      `@cantidad_total=${req.cantidad_total};`;

    return {
      ok: true,
      message: `Salida ${folio} ejecutada (${tipoSalida.nombre_tipo}): ${req.cantidad_total} pzas de ${producto.sku} preparadas en ${ubicacionStaging.codigo_ubicacion}.`,
      sqlCommand,
      affectedTarimaIds,
      affectedUbicacionIds: Array.from(affectedUbicacionIdsSet),
      focusUbicacionCodigo,
      focusTarimaCodigo,
      snapshot: this.getSnapshot(source),
    };
  }

  public registrarReubicacion(
    req: RegistrarReubicacionRequest,
    source: DataSourceMode = "memory"
  ): OperationResult {
    const folio = req.folio_reubicacion.trim();
    if (!folio) {
      throw new Error("El folio de reubicación es obligatorio.");
    }
    if (this.reubicaciones.some((r) => r.folio_reubicacion === folio)) {
      throw new Error(`El folio de reubicación '${folio}' ya existe.`);
    }
    if (!RESPONSABLE_MAP.has(req.id_responsable_almacen)) {
      throw new Error("El responsable de almacén especificado no existe.");
    }

    const tarima = this.tarimas.find((t) => t.id_tarima === req.id_tarima);
    if (!tarima) {
      throw new Error("La tarima especificada no existe.");
    }

    const id_ubicacion_origen = tarima.id_ubicacion;
    const id_ubicacion_destino = req.id_ubicacion_destino ?? null;

    if (id_ubicacion_origen === null && id_ubicacion_destino === null) {
      throw new Error(
        "La tarima ya se encuentra vacía sin ubicación asignada."
      );
    }
    if (id_ubicacion_origen === id_ubicacion_destino) {
      throw new Error(
        "La ubicación destino debe ser distinta a la ubicación origen actual."
      );
    }

    let nextEstatus: TarimaEstatus;
    let destinoCodigo: string | null = null;

    if (id_ubicacion_destino === null) {
      nextEstatus = "VACIA";
    } else {
      const ocupadaPorOtra = this.tarimas.some(
        (t) =>
          t.id_ubicacion === id_ubicacion_destino &&
          t.id_tarima !== tarima.id_tarima
      );
      if (ocupadaPorOtra) {
        throw new Error(
          "La ubicación destino ya se encuentra ocupada por otra tarima."
        );
      }

      const ubiDestino = UBICACION_MAP.get(id_ubicacion_destino);
      if (!ubiDestino) {
        throw new Error("La ubicación destino no existe.");
      }
      destinoCodigo = ubiDestino.codigo_ubicacion;
      nextEstatus = ubiDestino.id_zona === 1 ? "EN_ALMACEN" : "EN_STAGING";
    }

    const fechaNorm = normalizeDateTime(req.fecha_hora_reubicacion);
    const id_reubicacion = this.nextReubicacionId++;
    this.reubicaciones.push({
      id_reubicacion,
      folio_reubicacion: folio,
      fecha_hora_reubicacion: fechaNorm,
      id_ubicacion_origen,
      id_ubicacion_destino,
      id_tarima: tarima.id_tarima,
      id_responsable_almacen: req.id_responsable_almacen,
    });

    tarima.id_ubicacion = id_ubicacion_destino;
    tarima.estatus_tarima = nextEstatus;

    const origenUbi =
      id_ubicacion_origen !== null
        ? UBICACION_MAP.get(id_ubicacion_origen)
        : undefined;

    const affectedUbicacionIds: number[] = [];
    if (id_ubicacion_origen !== null)
      affectedUbicacionIds.push(id_ubicacion_origen);
    if (id_ubicacion_destino !== null)
      affectedUbicacionIds.push(id_ubicacion_destino);

    const focusUbicacionCodigo =
      destinoCodigo ?? origenUbi?.codigo_ubicacion ?? null;
    const focusTarimaCodigo =
      id_ubicacion_destino !== null ? tarima.codigo_tarima : null;

    this.timelineEvents.push({
      id: `reu-${id_reubicacion}`,
      tipo: "REUBICACION",
      folio,
      fecha_hora: fechaNorm,
      resumen: `${tarima.codigo_tarima}: ${
        origenUbi?.codigo_ubicacion ?? "SIN UBICACIÓN"
      } → ${destinoCodigo ?? "LIBERADA (VACIA)"}`,
      tarimaCodigo: tarima.codigo_tarima,
      ubicacionDestino: destinoCodigo,
    });

    const destSql =
      id_ubicacion_destino === null ? "NULL" : String(id_ubicacion_destino);
    const sqlCommand =
      `EXEC sp_RegistrarReubicacion ` +
      `@folio_reubicacion='${escapeSql(folio)}', ` +
      `@fecha_hora_reubicacion='${escapeSql(fechaNorm)}', ` +
      `@id_ubicacion_destino=${destSql}, ` +
      `@id_tarima=${req.id_tarima}, ` +
      `@id_responsable_almacen=${req.id_responsable_almacen};`;

    return {
      ok: true,
      message: `Reubicación ${folio} completada: ${tarima.codigo_tarima} → ${
        destinoCodigo ?? "VACIA (sin ubicación)"
      }.`,
      sqlCommand,
      affectedTarimaIds: [tarima.id_tarima],
      affectedUbicacionIds,
      focusUbicacionCodigo,
      focusTarimaCodigo,
      snapshot: this.getSnapshot(source),
    };
  }

  public consultarExistencias(
    codigo_zona?: string,
    codigo_cat?: string
  ): ExistenciaRow[] {
    const zoneFilter = codigo_zona?.trim() || undefined;
    const catFilter = codigo_cat?.trim() || undefined;
    const rows: ExistenciaRow[] = [];

    for (const tarima of this.tarimas) {
      if (
        tarima.estatus_tarima !== "EN_ALMACEN" &&
        tarima.estatus_tarima !== "EN_STAGING"
      ) {
        continue;
      }
      if (tarima.id_ubicacion === null) continue;

      const ubi = UBICACION_MAP.get(tarima.id_ubicacion);
      if (!ubi) continue;
      const zona = ZONA_MAP.get(ubi.id_zona)!;
      const soporte = SOPORTE_MAP.get(ubi.id_tipo_soporte)!;

      if (zoneFilter && zona.codigo_zona !== zoneFilter) continue;

      for (const producto of PRODUCTOS) {
        if (catFilter && producto.codigo_cat !== catFilter) continue;
        const existencia = this.getTarimaProductBalance(
          tarima.id_tarima,
          producto.id_producto
        );
        if (existencia <= 0) continue;

        rows.push({
          sku: producto.sku,
          descripcion: producto.nombre_descripcion,
          categoria: producto.nombre_categoria,
          codigo_cat: producto.codigo_cat,
          zona: zona.codigo_zona,
          ubicacion: ubi.codigo_ubicacion,
          tarima: tarima.codigo_tarima,
          soporte: soporte.nombre_soporte,
          existenciaPiezas: existencia,
          pesoTotalTarimaKg: round2(existencia * producto.peso_unitario_kg),
          capacidadMaxSoporteKg: soporte.capacidad_max_kg,
          id_ubicacion: ubi.id_ubicacion,
          id_tarima: tarima.id_tarima,
        });
      }
    }

    rows.sort((a, b) => {
      const cmpSku = a.sku.localeCompare(b.sku);
      return cmpSku !== 0 ? cmpSku : a.ubicacion.localeCompare(b.ubicacion);
    });

    return rows;
  }

  public alertaResurtidoMinimos(): AlertaMinimoRow[] {
    const rows: AlertaMinimoRow[] = [];

    for (const producto of PRODUCTOS) {
      if (producto.stock_minimo <= 0) continue;
      const existenciaActual = this.getProductTotalBalance(
        producto.id_producto
      );
      if (existenciaActual < producto.stock_minimo) {
        const sugerencia = producto.stock_ideal - existenciaActual;
        rows.push({
          sku: producto.sku,
          producto: producto.nombre_descripcion,
          categoria: producto.nombre_categoria,
          stockMinimo: producto.stock_minimo,
          stockIdeal: producto.stock_ideal,
          existenciaActual,
          sugerenciaFabricacionPiezas: sugerencia,
          costoEstimadoProduccion: round2(sugerencia * producto.costo_unitario),
        });
      }
    }

    rows.sort(
      (a, b) =>
        b.sugerenciaFabricacionPiezas - a.sugerenciaFabricacionPiezas
    );
    return rows;
  }

  public rotacionInventario(
    fechaInicio = "2026-01-01",
    fechaFin = "2026-12-31 23:59:59"
  ): RotacionRow[] {
    const start = normalizeRangeStart(fechaInicio);
    const end = normalizeRangeEnd(fechaFin);

    const salidaMap = new Map<number, SalidaRow>(
      this.salidas.map((s) => [s.id_salida, s])
    );

    const agg = new Map<
      number,
      { unidades: number; salidaIds: Set<number> }
    >();

    for (const ds of this.detalleSalidas) {
      const s = salidaMap.get(ds.id_salida);
      if (!s) continue;
      if (s.id_tipo_salida !== 1) continue; // 1 = Venta Comercial
      if (s.fecha_hora_salida < start || s.fecha_hora_salida > end) continue;

      let entry = agg.get(ds.id_producto);
      if (!entry) {
        entry = { unidades: 0, salidaIds: new Set<number>() };
        agg.set(ds.id_producto, entry);
      }
      entry.unidades += ds.cantidad_salida;
      entry.salidaIds.add(s.id_salida);
    }

    const rows: RotacionRow[] = [];
    for (const [id_producto, stats] of agg.entries()) {
      const producto = PRODUCTO_MAP.get(id_producto);
      if (!producto) continue;

      rows.push({
        sku: producto.sku,
        producto: producto.nombre_descripcion,
        categoria: producto.nombre_categoria,
        unidadesVendidas: stats.unidades,
        precioUnitarioVenta: producto.precio_venta,
        importeTotalVenta: round2(stats.unidades * producto.precio_venta),
        margenBrutoTotal: round2(
          stats.unidades * (producto.precio_venta - producto.costo_unitario)
        ),
        numeroPedidosSurtidos: stats.salidaIds.size,
      });
    }

    rows.sort((a, b) => b.unidadesVendidas - a.unidadesVendidas);
    return rows;
  }

  public valorInventarioFecha(
    fechaCorte = "2026-10-31 23:59:59"
  ): ValorInventarioRow[] {
    const cutoff = normalizeRangeEnd(fechaCorte);
    const entradaMap = new Map<number, EntradaRow>(
      this.entradas.map((e) => [e.id_entrada, e])
    );
    const salidaMap = new Map<number, SalidaRow>(
      this.salidas.map((s) => [s.id_salida, s])
    );

    const rows: ValorInventarioRow[] = [];
    for (const producto of PRODUCTOS) {
      let totalIn = 0;
      for (const de of this.detalleEntradas) {
        if (de.id_producto !== producto.id_producto) continue;
        const e = entradaMap.get(de.id_entrada);
        if (e && e.fecha_hora_entrada <= cutoff) {
          totalIn += de.cantidad_ingresada;
        }
      }

      let totalOut = 0;
      for (const ds of this.detalleSalidas) {
        if (ds.id_producto !== producto.id_producto) continue;
        const s = salidaMap.get(ds.id_salida);
        if (s && s.fecha_hora_salida <= cutoff) {
          totalOut += ds.cantidad_salida;
        }
      }

      const existencia = totalIn - totalOut;
      if (existencia <= 0) continue;

      rows.push({
        sku: producto.sku,
        producto: producto.nombre_descripcion,
        categoria: producto.nombre_categoria,
        costoUnitario: producto.costo_unitario,
        existenciaFechaCorte: existencia,
        valorTotalInventario: round2(existencia * producto.costo_unitario),
      });
    }

    rows.sort((a, b) => b.valorTotalInventario - a.valorTotalInventario);
    return rows;
  }

  public productosSinMovimiento(
    fechaInicio = "2026-10-01",
    fechaFin = "2026-10-31 23:59:59"
  ): SinMovimientoRow[] {
    const start = normalizeRangeStart(fechaInicio);
    const end = normalizeRangeEnd(fechaFin);

    const salidaMap = new Map<number, SalidaRow>(
      this.salidas.map((s) => [s.id_salida, s])
    );

    const movedProducts = new Set<number>();
    for (const ds of this.detalleSalidas) {
      const s = salidaMap.get(ds.id_salida);
      if (!s) continue;
      if (
        s.id_tipo_salida === 1 &&
        s.fecha_hora_salida >= start &&
        s.fecha_hora_salida <= end
      ) {
        movedProducts.add(ds.id_producto);
      }
    }

    const rows: SinMovimientoRow[] = [];
    for (const producto of PRODUCTOS) {
      const existenciaActual = this.getProductTotalBalance(
        producto.id_producto
      );
      if (existenciaActual <= 0) continue;
      if (movedProducts.has(producto.id_producto)) continue;

      rows.push({
        sku: producto.sku,
        producto: producto.nombre_descripcion,
        categoria: producto.nombre_categoria,
        existenciaActualAlmacen: existenciaActual,
        capitalInmovilizado: round2(existenciaActual * producto.costo_unitario),
      });
    }

    rows.sort((a, b) => b.capitalInmovilizado - a.capitalInmovilizado);
    return rows;
  }

  public kardexArticulo(sku: string): KardexRow[] {
    const cleanSku = sku.trim().toUpperCase();
    const producto = PRODUCTOS.find((p) => p.sku.toUpperCase() === cleanSku);
    if (!producto) {
      throw new Error("El SKU especificado no existe en el catálogo.");
    }

    const entradaMap = new Map<number, EntradaRow>(
      this.entradas.map((e) => [e.id_entrada, e])
    );
    const salidaMap = new Map<number, SalidaRow>(
      this.salidas.map((s) => [s.id_salida, s])
    );
    const tarimaMap = new Map<number, TarimaMutable>(
      this.tarimas.map((t) => [t.id_tarima, t])
    );

    const rawRows: Omit<KardexRow, "saldoAcumulado">[] = [];

    for (const de of this.detalleEntradas) {
      if (de.id_producto !== producto.id_producto) continue;
      const e = entradaMap.get(de.id_entrada)!;
      const te = TIPO_ENTRADA_MAP.get(e.id_tipo_entrada)!;
      const tar = tarimaMap.get(de.id_tarima)!;
      const resp = RESPONSABLE_MAP.get(e.id_responsable_almacen)!;
      rawRows.push({
        fechaHora: e.fecha_hora_entrada,
        operacion: `ENTRADA - ${te.nombre_tipo}`,
        folioDocumento: e.folio_entrada,
        codigoTarima: tar.codigo_tarima,
        responsable: `${resp.nombre} ${resp.apellido}`,
        entrada: de.cantidad_ingresada,
        salida: 0,
      });
    }

    for (const ds of this.detalleSalidas) {
      if (ds.id_producto !== producto.id_producto) continue;
      const s = salidaMap.get(ds.id_salida)!;
      const ts = TIPO_SALIDA_MAP.get(s.id_tipo_salida)!;
      const tar = tarimaMap.get(ds.id_tarima)!;
      const resp = RESPONSABLE_MAP.get(s.id_responsable_almacen)!;
      rawRows.push({
        fechaHora: s.fecha_hora_salida,
        operacion: `SALIDA - ${ts.nombre_tipo}`,
        folioDocumento: s.folio_salida,
        codigoTarima: tar.codigo_tarima,
        responsable: `${resp.nombre} ${resp.apellido}`,
        entrada: 0,
        salida: ds.cantidad_salida,
      });
    }

    rawRows.sort((a, b) => {
      const cmpFecha = a.fechaHora.localeCompare(b.fechaHora);
      if (cmpFecha !== 0) return cmpFecha;
      return b.operacion.localeCompare(a.operacion);
    });

    let saldo = 0;
    return rawRows.map((row) => {
      saldo += row.entrada - row.salida;
      return {
        ...row,
        saldoAcumulado: saldo,
      };
    });
  }

  public getSnapshot(source: DataSourceMode = "memory"): WmsBootstrapData {
    const tarimaStates: TarimaState[] = this.tarimas.map((t) => {
      const ubi =
        t.id_ubicacion !== null ? UBICACION_MAP.get(t.id_ubicacion) : undefined;
      const zona = ubi ? ZONA_MAP.get(ubi.id_zona) : undefined;
      const soporte = ubi ? SOPORTE_MAP.get(ubi.id_tipo_soporte) : undefined;

      const items: TarimaInventoryItem[] = [];
      if (t.estatus_tarima !== "VACIA") {
        for (const producto of PRODUCTOS) {
          const cantidad = this.getTarimaProductBalance(
            t.id_tarima,
            producto.id_producto
          );
          if (cantidad <= 0) continue;
          items.push({
            id_producto: producto.id_producto,
            sku: producto.sku,
            nombre_descripcion: producto.nombre_descripcion,
            codigo_cat: producto.codigo_cat,
            nombre_categoria: producto.nombre_categoria,
            codigo_mod: producto.codigo_mod,
            nombre_modelo: producto.nombre_modelo,
            codigo_col: producto.codigo_col,
            nombre_color: producto.nombre_color,
            cantidad,
            peso_unitario_kg: producto.peso_unitario_kg,
            peso_total_kg: round2(cantidad * producto.peso_unitario_kg),
          });
        }
      }

      const total_piezas = items.reduce((acc, item) => acc + item.cantidad, 0);
      const peso_total_kg = round2(
        items.reduce((acc, item) => acc + item.peso_total_kg, 0)
      );

      return {
        id_tarima: t.id_tarima,
        codigo_tarima: t.codigo_tarima,
        estatus_tarima: t.estatus_tarima,
        id_ubicacion: t.id_ubicacion,
        codigo_ubicacion: ubi?.codigo_ubicacion ?? null,
        codigo_zona: zona?.codigo_zona ?? null,
        codigo_soporte: soporte?.codigo_soporte ?? null,
        capacidad_max_kg: soporte?.capacidad_max_kg ?? null,
        items,
        total_piezas,
        peso_total_kg,
      };
    });

    const tarimaByUbi = new Map<number, TarimaState>();
    for (const ts of tarimaStates) {
      if (ts.id_ubicacion !== null) {
        tarimaByUbi.set(ts.id_ubicacion, ts);
      }
    }

    const ubicaciones: UbicacionState[] = UBICACIONES_SEED.map((u) => {
      const zona = ZONA_MAP.get(u.id_zona)!;
      const soporte = SOPORTE_MAP.get(u.id_tipo_soporte)!;
      return {
        id_ubicacion: u.id_ubicacion,
        id_zona: u.id_zona,
        codigo_zona: zona.codigo_zona,
        id_tipo_soporte: u.id_tipo_soporte,
        codigo_soporte: soporte.codigo_soporte,
        nombre_soporte: soporte.nombre_soporte,
        capacidad_max_kg: soporte.capacidad_max_kg,
        codigo_ubicacion: u.codigo_ubicacion,
        pasillo: u.pasillo,
        nivel: u.nivel,
        posicion: u.posicion,
        activa: u.activa,
        tarima: tarimaByUbi.get(u.id_ubicacion) ?? null,
        position3d: getUbicacionPosition3d(u.codigo_ubicacion),
      };
    });

    const totalPiezas = tarimaStates.reduce(
      (acc, t) => acc + t.total_piezas,
      0
    );
    const tarimasActivas = tarimaStates.filter(
      (t) => t.estatus_tarima !== "VACIA"
    ).length;
    const tarimasVacias = tarimaStates.length - tarimasActivas;
    const ubicacionesOcupadas = ubicaciones.filter(
      (u) => u.tarima !== null
    ).length;
    const alertasMinimoCount = this.alertaResurtidoMinimos().length;

    const recentEvents = [...this.timelineEvents].reverse().slice(0, 30);

    return {
      source,
      categorias: CATEGORIAS,
      modelos: MODELOS,
      colores: COLORES,
      productos: PRODUCTOS,
      zonas: ZONAS,
      tiposSoporte: TIPOS_SOPORTE,
      responsables: RESPONSABLES,
      tiposEntrada: TIPOS_ENTRADA,
      tiposSalida: TIPOS_SALIDA,
      clientes: CLIENTES,
      transportistas: TRANSPORTISTAS,
      ubicaciones,
      tarimas: tarimaStates,
      recentEvents,
      stats: {
        totalPiezas,
        tarimasActivas,
        tarimasVacias,
        ubicacionesOcupadas,
        ubicacionesTotales: ubicaciones.length,
        alertasMinimoCount,
      },
    };
  }
}

export const memoryEngine = new TayoWmsEngine(true);
