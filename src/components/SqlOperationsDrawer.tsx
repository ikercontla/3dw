import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  Check,
  CheckCircle2,
  Copy,
  Crosshair,
  DollarSign,
  FileSpreadsheet,
  History,
  PackageX,
  RefreshCw,
  RotateCcw,
  Search,
  TrendingUp,
  X,
} from "lucide-react";
import {
  execRegistrarEntrada,
  execRegistrarReubicacion,
  execRegistrarSalida,
  fetchAlertasMinimos,
  fetchExistencias,
  fetchKardex,
  fetchRotacion,
  fetchSinMovimiento,
  fetchValorInventario,
} from "@/services/wmsApi";
import type {
  AlertaMinimoRow,
  CategoriaCodigo,
  ExistenciaRow,
  KardexRow,
  OperationResult,
  Producto,
  RotacionRow,
  SinMovimientoRow,
  ValorInventarioRow,
  WmsBootstrapData,
  ZonaCodigo,
} from "@/types/wms";

export type DrawerMainTab = "operaciones" | "reportes";
export type OperationSubTab = "entrada" | "salida" | "reubicacion";
export type ReportSubTab =
  | "existencias"
  | "alertas"
  | "rotacion"
  | "valor"
  | "sin-movimiento"
  | "kardex";

interface SqlOperationsDrawerProps {
  open: boolean;
  data: WmsBootstrapData | null;
  forceMemory: boolean;
  activeTab: DrawerMainTab;
  operationSubTab: OperationSubTab;
  reportSubTab: ReportSubTab;
  initialKardexSku: string | null;
  initialReubicacionTarimaId: number | null;
  initialExistenciasZona?: "" | ZonaCodigo;
  initialSalidaTransportistaId?: number | null;
  resetting: boolean;
  onClose: () => void;
  onTabChange: (tab: DrawerMainTab) => void;
  onOperationSubTabChange: (sub: OperationSubTab) => void;
  onReportSubTabChange: (sub: ReportSubTab) => void;
  onSnapshotUpdate: (snapshot: WmsBootstrapData) => void;
  onFocus3D: (opts: {
    ubicacionCodigo?: string | null;
    tarimaCodigo?: string | null;
    affectedUbicacionIds?: number[];
  }) => void;
  onResetSimulation: () => Promise<void>;
}

interface FeedbackState {
  ok: boolean;
  message: string;
  sqlCommand: string;
  focusUbicacionCodigo?: string | null;
  focusTarimaCodigo?: string | null;
  affectedUbicacionIds?: number[];
}

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

function nowSqlTimestamp(): string {
  const d = new Date();
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function formatMxn(val: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(val);
}

function formatDateTime(raw: string): string {
  if (!raw) return "—";
  const normalized = raw.replace("T", " ").slice(0, 16);
  return normalized;
}

export function SqlOperationsDrawer({
  open,
  data,
  forceMemory,
  activeTab,
  operationSubTab,
  reportSubTab,
  initialKardexSku,
  initialReubicacionTarimaId,
  initialExistenciasZona,
  initialSalidaTransportistaId,
  resetting,
  onClose,
  onTabChange,
  onOperationSubTabChange,
  onReportSubTabChange,
  onSnapshotUpdate,
  onFocus3D,
  onResetSimulation,
}: SqlOperationsDrawerProps) {
  const activeResponsables = useMemo(
    () => (data?.responsables ?? []).filter((r) => r.activo),
    [data?.responsables]
  );

  // Folio sequence counters so consecutive ops stay unique
  const [seqCounts, setSeqCounts] = useState({ ent: 1, sal: 1, reu: 1 });

  // Entrada form state
  const [entProdId, setEntProdId] = useState<number>(1);
  const [entQty, setEntQty] = useState<string>("60");
  const [entTipoId, setEntTipoId] = useState<number>(1);
  const [entRespId, setEntRespId] = useState<number>(1);
  const [entFolio, setEntFolio] = useState<string>("ENT-202611-001");

  // Salida form state
  const [salProdId, setSalProdId] = useState<number>(1);
  const [salQty, setSalQty] = useState<string>("20");
  const [salTipoId, setSalTipoId] = useState<number>(1);
  const [salClienteId, setSalClienteId] = useState<number>(1);
  const [salTranspId, setSalTranspId] = useState<number>(1);
  const [salRespId, setSalRespId] = useState<number>(1);
  const [salFolio, setSalFolio] = useState<string>("SAL-202611-001");

  // Reubicación form state
  const [reuTarimaId, setReuTarimaId] = useState<number>(0);
  const [reuDestValue, setReuDestValue] = useState<string>("__NULL__");
  const [reuRespId, setReuRespId] = useState<number>(1);
  const [reuFolio, setReuFolio] = useState<string>("REU-202611-001");

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // Reports state
  const [repLoading, setRepLoading] = useState(false);
  const [repError, setRepError] = useState<string | null>(null);

  const [exZona, setExZona] = useState<"" | ZonaCodigo>("");
  const [exCat, setExCat] = useState<"" | CategoriaCodigo>("");
  const [existencias, setExistencias] = useState<ExistenciaRow[]>([]);

  const [alertas, setAlertas] = useState<AlertaMinimoRow[]>([]);

  const [rotInicio, setRotInicio] = useState("2026-05-01");
  const [rotFin, setRotFin] = useState("2026-11-30");
  const [rotacion, setRotacion] = useState<RotacionRow[]>([]);

  const [valorFechaCorte, setValorFechaCorte] = useState("2026-11-30");
  const [valorRows, setValorRows] = useState<ValorInventarioRow[]>([]);

  const [sinMovInicio, setSinMovInicio] = useState("2026-10-01");
  const [sinMovFin, setSinMovFin] = useState("2026-10-31");
  const [sinMovRows, setSinMovRows] = useState<SinMovimientoRow[]>([]);

  const [kardexSku, setKardexSku] = useState<string>("CEL-HEX-GN-30");
  const [kardexRows, setKardexRows] = useState<KardexRow[]>([]);

  // Available Z-ALM stock per product
  const zAlmStockMap = useMemo(() => {
    const map = new Map<number, number>();
    if (!data) return map;
    for (const t of data.tarimas) {
      if (t.estatus_tarima !== "EN_ALMACEN") continue;
      for (const item of t.items) {
        map.set(item.id_producto, (map.get(item.id_producto) ?? 0) + item.cantidad);
      }
    }
    return map;
  }, [data]);

  const occupiedTarimas = useMemo(
    () => (data?.tarimas ?? []).filter((t) => t.id_ubicacion !== null && t.estatus_tarima !== "VACIA"),
    [data?.tarimas]
  );

  // Sync defaults when bootstrap data arrives
  useEffect(() => {
    if (!data) return;
    if (data.productos.length > 0) {
      setEntProdId((prev) =>
        data.productos.some((p) => p.id_producto === prev) ? prev : data.productos[0].id_producto
      );
      setSalProdId((prev) => {
        if (data.productos.some((p) => p.id_producto === prev)) return prev;
        const withStock = data.productos.find((p) => (zAlmStockMap.get(p.id_producto) ?? 0) > 0);
        return withStock?.id_producto ?? data.productos[0].id_producto;
      });
      setKardexSku((prev) =>
        data.productos.some((p) => p.sku === prev) ? prev : data.productos[0].sku
      );
    }
    if (activeResponsables.length > 0) {
      const firstResp = activeResponsables[0].id_responsable_almacen;
      setEntRespId((prev) =>
        activeResponsables.some((r) => r.id_responsable_almacen === prev) ? prev : firstResp
      );
      setSalRespId((prev) =>
        activeResponsables.some((r) => r.id_responsable_almacen === prev) ? prev : firstResp
      );
      setReuRespId((prev) =>
        activeResponsables.some((r) => r.id_responsable_almacen === prev) ? prev : firstResp
      );
    }
    if (data.tiposEntrada.length > 0) {
      setEntTipoId((prev) =>
        data.tiposEntrada.some((t) => t.id_tipo_entrada === prev)
          ? prev
          : data.tiposEntrada[0].id_tipo_entrada
      );
    }
    if (data.tiposSalida.length > 0) {
      setSalTipoId((prev) =>
        data.tiposSalida.some((t) => t.id_tipo_salida === prev)
          ? prev
          : data.tiposSalida[0].id_tipo_salida
      );
    }
    if (data.clientes.length > 0) {
      setSalClienteId((prev) =>
        data.clientes.some((c) => c.id_cliente === prev) ? prev : data.clientes[0].id_cliente
      );
    }
    if (data.transportistas.length > 0) {
      setSalTranspId((prev) =>
        data.transportistas.some((t) => t.id_transportista === prev)
          ? prev
          : data.transportistas[0].id_transportista
      );
    }
  }, [data, activeResponsables, zAlmStockMap]);

  // Keep selected tarima valid for reubicacion
  useEffect(() => {
    if (occupiedTarimas.length === 0) {
      setReuTarimaId(0);
      return;
    }
    setReuTarimaId((prev) =>
      occupiedTarimas.some((t) => t.id_tarima === prev) ? prev : occupiedTarimas[0].id_tarima
    );
  }, [occupiedTarimas]);

  // Apply external pre-selections from 3D Inspector quick buttons
  useEffect(() => {
    if (initialKardexSku) {
      setKardexSku(initialKardexSku);
    }
  }, [initialKardexSku]);

  useEffect(() => {
    if (initialReubicacionTarimaId && occupiedTarimas.some((t) => t.id_tarima === initialReubicacionTarimaId)) {
      setReuTarimaId(initialReubicacionTarimaId);
    }
  }, [initialReubicacionTarimaId, occupiedTarimas]);

  useEffect(() => {
    if (initialExistenciasZona !== undefined) {
      setExZona(initialExistenciasZona);
    }
  }, [initialExistenciasZona]);

  useEffect(() => {
    if (
      initialSalidaTransportistaId &&
      data?.transportistas.some((t) => t.id_transportista === initialSalidaTransportistaId)
    ) {
      setSalTranspId(initialSalidaTransportistaId);
    }
  }, [initialSalidaTransportistaId, data?.transportistas]);

  // Free destination locations for selected tarima in Reubicación
  const selectedReuTarima = useMemo(
    () => occupiedTarimas.find((t) => t.id_tarima === reuTarimaId) ?? null,
    [occupiedTarimas, reuTarimaId]
  );

  const freeDestinationLocations = useMemo(() => {
    if (!data) return [];
    return data.ubicaciones.filter(
      (u) =>
        u.activa &&
        u.tarima === null &&
        u.id_ubicacion !== (selectedReuTarima?.id_ubicacion ?? -1)
    );
  }, [data, selectedReuTarima]);

  // Live SQL rule preview for Entrada
  const entradaPreview = useMemo(() => {
    if (!data) return null;
    const prod = data.productos.find((p) => p.id_producto === entProdId);
    if (!prod) return null;

    const isRack = prod.codigo_cat === "CEL" || prod.codigo_cat === "LAM";
    const soporteCod = isRack ? "RCK" : "PIS";
    const soporte = data.tiposSoporte.find((s) => s.codigo_soporte === soporteCod);
    const capMaxKg = soporte?.capacidad_max_kg ?? (isRack ? 1000 : 2500);
    const maxPiezasTarima = Math.floor(capMaxKg / prod.peso_unitario_kg);
    const qtyNum = Math.max(0, Math.floor(Number(entQty) || 0));
    const tarimasNecesarias =
      maxPiezasTarima > 0 && qtyNum > 0 ? Math.ceil(qtyNum / maxPiezasTarima) : 0;
    const tarimasVacias = data.tarimas.filter((t) => t.estatus_tarima === "VACIA").length;
    const ubicacionesLibres = data.ubicaciones.filter(
      (u) =>
        u.codigo_zona === "Z-ALM" &&
        u.codigo_soporte === soporteCod &&
        u.activa &&
        u.tarima === null
    ).length;

    const feasible =
      qtyNum > 0 &&
      maxPiezasTarima > 0 &&
      tarimasVacias >= tarimasNecesarias &&
      ubicacionesLibres >= tarimasNecesarias;

    return {
      prod,
      soporteLabel: isRack ? "Rack Selectivo (RCK)" : "Piso Carga Pesada (PIS)",
      soporteCod,
      capMaxKg,
      maxPiezasTarima,
      tarimasNecesarias,
      tarimasVacias,
      ubicacionesLibres,
      feasible,
    };
  }, [data, entProdId, entQty]);

  const productsByCategory = useMemo(() => {
    if (!data) return [];
    const groups = new Map<string, { label: string; items: Producto[] }>();
    for (const cat of data.categorias) {
      groups.set(cat.codigo_cat, { label: `${cat.codigo_cat} · ${cat.nombre_categoria}`, items: [] });
    }
    for (const p of data.productos) {
      groups.get(p.codigo_cat)?.items.push(p);
    }
    return Array.from(groups.values()).filter((g) => g.items.length > 0);
  }, [data]);

  const activeSalProductStock = zAlmStockMap.get(salProdId) ?? 0;
  const freeStagingCount = useMemo(
    () =>
      (data?.ubicaciones ?? []).filter(
        (u) => u.codigo_zona === "Z-STAG" && u.activa && u.tarima === null
      ).length,
    [data?.ubicaciones]
  );

  // Execute Reports
  const loadActiveReport = useCallback(async () => {
    if (!open || activeTab !== "reportes") return;
    setRepLoading(true);
    setRepError(null);
    try {
      switch (reportSubTab) {
        case "existencias": {
          const rows = await fetchExistencias(
            exZona || undefined,
            exCat || undefined,
            forceMemory
          );
          setExistencias(rows);
          break;
        }
        case "alertas": {
          const rows = await fetchAlertasMinimos(forceMemory);
          setAlertas(rows);
          break;
        }
        case "rotacion": {
          const rows = await fetchRotacion(
            rotInicio,
            `${rotFin} 23:59:59`,
            forceMemory
          );
          setRotacion(rows);
          break;
        }
        case "valor": {
          const rows = await fetchValorInventario(
            `${valorFechaCorte} 23:59:59`,
            forceMemory
          );
          setValorRows(rows);
          break;
        }
        case "sin-movimiento": {
          const rows = await fetchSinMovimiento(
            sinMovInicio,
            `${sinMovFin} 23:59:59`,
            forceMemory
          );
          setSinMovRows(rows);
          break;
        }
        case "kardex": {
          if (kardexSku) {
            const rows = await fetchKardex(kardexSku, forceMemory);
            setKardexRows(rows);
          } else {
            setKardexRows([]);
          }
          break;
        }
      }
    } catch (err) {
      setRepError(err instanceof Error ? err.message : "Error al consultar el reporte SQL.");
    } finally {
      setRepLoading(false);
    }
  }, [
    open,
    activeTab,
    reportSubTab,
    exZona,
    exCat,
    rotInicio,
    rotFin,
    valorFechaCorte,
    sinMovInicio,
    sinMovFin,
    kardexSku,
    forceMemory,
  ]);

  useEffect(() => {
    void loadActiveReport();
  }, [loadActiveReport, data]);

  async function handleCopySql(sql: string) {
    try {
      await navigator.clipboard.writeText(sql);
      setCopiedSql(true);
      window.setTimeout(() => setCopiedSql(false), 1800);
    } catch {
      // Clipboard might be blocked in non-HTTPS contexts
    }
  }

  function applyOpResult(res: OperationResult) {
    setFeedback({
      ok: res.ok,
      message: res.message,
      sqlCommand: res.sqlCommand,
      focusUbicacionCodigo: res.focusUbicacionCodigo,
      focusTarimaCodigo: res.focusTarimaCodigo,
      affectedUbicacionIds: res.affectedUbicacionIds,
    });
    if (res.snapshot) {
      onSnapshotUpdate(res.snapshot);
    }
  }

  async function handleSubmitEntrada(e: React.FormEvent) {
    e.preventDefault();
    const cantidad_total = Math.floor(Number(entQty));
    if (!Number.isFinite(cantidad_total) || cantidad_total <= 0) {
      setFeedback({
        ok: false,
        message: "Ingresa una cantidad entera mayor a 0 piezas.",
        sqlCommand: "-- Validación previa: @cantidad_total <= 0",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await execRegistrarEntrada(
        {
          folio_entrada: entFolio.trim() || `ENT-202611-${pad3(seqCounts.ent)}`,
          fecha_hora_entrada: nowSqlTimestamp(),
          id_responsable_almacen: entRespId,
          id_tipo_entrada: entTipoId,
          id_producto: entProdId,
          cantidad_total,
        },
        forceMemory
      );
      applyOpResult(res);
      const next = seqCounts.ent + 1;
      setSeqCounts((s) => ({ ...s, ent: next }));
      setEntFolio(`ENT-202611-${pad3(next)}`);
    } catch (err) {
      setFeedback({
        ok: false,
        message: err instanceof Error ? err.message : "Error al ejecutar sp_RegistrarEntrada.",
        sqlCommand: `EXEC sp_RegistrarEntrada '${entFolio}', '${nowSqlTimestamp()}', ${entRespId}, ${entTipoId}, ${entProdId}, ${cantidad_total};`,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitSalida(e: React.FormEvent) {
    e.preventDefault();
    const cantidad_total = Math.floor(Number(salQty));
    if (!Number.isFinite(cantidad_total) || cantidad_total <= 0) {
      setFeedback({
        ok: false,
        message: "Ingresa una cantidad entera mayor a 0 piezas.",
        sqlCommand: "-- Validación previa: @cantidad_total <= 0",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await execRegistrarSalida(
        {
          folio_salida: salFolio.trim() || `SAL-202611-${pad3(seqCounts.sal)}`,
          fecha_hora_salida: nowSqlTimestamp(),
          id_tipo_salida: salTipoId,
          id_cliente: salClienteId,
          id_transportista: salTranspId,
          id_responsable_almacen: salRespId,
          id_producto: salProdId,
          cantidad_total,
        },
        forceMemory
      );
      applyOpResult(res);
      const next = seqCounts.sal + 1;
      setSeqCounts((s) => ({ ...s, sal: next }));
      setSalFolio(`SAL-202611-${pad3(next)}`);
    } catch (err) {
      setFeedback({
        ok: false,
        message: err instanceof Error ? err.message : "Error al ejecutar sp_RegistrarSalida.",
        sqlCommand: `EXEC sp_RegistrarSalida '${salFolio}', '${nowSqlTimestamp()}', ${salTipoId}, ${salClienteId}, ${salTranspId}, ${salRespId}, ${salProdId}, ${cantidad_total};`,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitReubicacion(e: React.FormEvent) {
    e.preventDefault();
    if (!reuTarimaId) {
      setFeedback({
        ok: false,
        message: "Selecciona una tarima activa para reubicar.",
        sqlCommand: "-- Validación previa: sin tarima seleccionada",
      });
      return;
    }
    const id_ubicacion_destino =
      reuDestValue === "__NULL__" ? null : Number(reuDestValue);
    setSubmitting(true);
    try {
      const res = await execRegistrarReubicacion(
        {
          folio_reubicacion: reuFolio.trim() || `REU-202611-${pad3(seqCounts.reu)}`,
          fecha_hora_reubicacion: nowSqlTimestamp(),
          id_ubicacion_destino,
          id_tarima: reuTarimaId,
          id_responsable_almacen: reuRespId,
        },
        forceMemory
      );
      applyOpResult(res);
      const next = seqCounts.reu + 1;
      setSeqCounts((s) => ({ ...s, reu: next }));
      setReuFolio(`REU-202611-${pad3(next)}`);
    } catch (err) {
      setFeedback({
        ok: false,
        message:
          err instanceof Error ? err.message : "Error al ejecutar sp_RegistrarReubicacion.",
        sqlCommand: `EXEC sp_RegistrarReubicacion '${reuFolio}', '${nowSqlTimestamp()}', ${
          id_ubicacion_destino ?? "NULL"
        }, ${reuTarimaId}, ${reuRespId};`,
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleProduceFromAlert(row: AlertaMinimoRow) {
    const prod = data?.productos.find((p) => p.sku === row.sku);
    if (!prod) return;
    setEntProdId(prod.id_producto);
    setEntQty(String(Math.max(1, row.sugerenciaFabricacionPiezas)));
    onTabChange("operaciones");
    onOperationSubTabChange("entrada");
  }

  if (!open) return null;

  const isMemoryMode = forceMemory || data?.source === "memory";

  const valorTotalInventarioSum = valorRows.reduce(
    (acc, r) => acc + r.valorTotalInventario,
    0
  );
  const valorTotalPiezasSum = valorRows.reduce(
    (acc, r) => acc + r.existenciaFechaCorte,
    0
  );
  const rotacionUnidadesSum = rotacion.reduce((acc, r) => acc + r.unidadesVendidas, 0);
  const rotacionVentaSum = rotacion.reduce((acc, r) => acc + r.importeTotalVenta, 0);
  const rotacionMargenSum = rotacion.reduce((acc, r) => acc + r.margenBrutoTotal, 0);
  const sinMovCapitalSum = sinMovRows.reduce((acc, r) => acc + r.capitalInmovilizado, 0);
  const alertasCostoSum = alertas.reduce((acc, r) => acc + r.costoEstimadoProduccion, 0);

  return (
    <aside className="wms-drawer" aria-label="Operaciones y Reportes SQL">
      {/* Drawer Header */}
      <div className="wms-drawer-header">
        <div>
          <h2 className="wms-drawer-title">Operaciones y Reportes SQL</h2>
          <div className="wms-drawer-sub">
            {isMemoryMode
              ? "Motor en Memoria · Réplica exacta TAYO_WMS"
              : "SQL Server Live · Base TAYO_WMS"}
          </div>
        </div>
        <div className="wms-btn-row">
          {isMemoryMode && (
            <button
              type="button"
              className="wms-btn wms-btn-sm"
              disabled={resetting}
              onClick={() => void onResetSimulation()}
              title="Restaurar estado exacto de cierre Oct 2026 (120 operaciones)"
            >
              <RotateCcw size={13} />
              <span>{resetting ? "Reiniciando…" : "Reiniciar Simulación"}</span>
            </button>
          )}
          <button
            type="button"
            className="wms-icon-btn"
            onClick={onClose}
            aria-label="Cerrar panel SQL"
            title="Cerrar (Esc)"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="wms-drawer-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "operaciones"}
          className={`wms-drawer-tab ${activeTab === "operaciones" ? "is-active" : ""}`}
          onClick={() => onTabChange("operaciones")}
        >
          <ArrowRightLeft size={14} />
          <span>Operaciones</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "reportes"}
          className={`wms-drawer-tab ${activeTab === "reportes" ? "is-active" : ""}`}
          onClick={() => onTabChange("reportes")}
        >
          <FileSpreadsheet size={14} />
          <span>Reportes Analíticos</span>
        </button>
      </div>

      {/* Sub-tabs */}
      {activeTab === "operaciones" ? (
        <div className="wms-subtabs" role="tablist">
          <button
            type="button"
            className={`wms-subtab ${operationSubTab === "entrada" ? "is-active" : ""}`}
            onClick={() => onOperationSubTabChange("entrada")}
          >
            <ArrowDownToLine size={13} />
            <span>Entrada</span>
          </button>
          <button
            type="button"
            className={`wms-subtab ${operationSubTab === "salida" ? "is-active" : ""}`}
            onClick={() => onOperationSubTabChange("salida")}
          >
            <ArrowUpFromLine size={13} />
            <span>Salida</span>
          </button>
          <button
            type="button"
            className={`wms-subtab ${operationSubTab === "reubicacion" ? "is-active" : ""}`}
            onClick={() => onOperationSubTabChange("reubicacion")}
          >
            <ArrowRightLeft size={13} />
            <span>Reubicación</span>
          </button>
        </div>
      ) : (
        <div className="wms-subtabs wms-scroll" role="tablist">
          <button
            type="button"
            className={`wms-subtab ${reportSubTab === "existencias" ? "is-active" : ""}`}
            onClick={() => onReportSubTabChange("existencias")}
          >
            <Search size={12} />
            <span>Existencias</span>
          </button>
          <button
            type="button"
            className={`wms-subtab ${reportSubTab === "alertas" ? "is-active" : ""}`}
            onClick={() => onReportSubTabChange("alertas")}
          >
            <AlertTriangle size={12} />
            <span>
              Alerta Mínimos
              {data && data.stats.alertasMinimoCount > 0
                ? ` (${data.stats.alertasMinimoCount})`
                : ""}
            </span>
          </button>
          <button
            type="button"
            className={`wms-subtab ${reportSubTab === "rotacion" ? "is-active" : ""}`}
            onClick={() => onReportSubTabChange("rotacion")}
          >
            <TrendingUp size={12} />
            <span>Rotación</span>
          </button>
          <button
            type="button"
            className={`wms-subtab ${reportSubTab === "valor" ? "is-active" : ""}`}
            onClick={() => onReportSubTabChange("valor")}
          >
            <DollarSign size={12} />
            <span>Valor Inventario</span>
          </button>
          <button
            type="button"
            className={`wms-subtab ${reportSubTab === "sin-movimiento" ? "is-active" : ""}`}
            onClick={() => onReportSubTabChange("sin-movimiento")}
          >
            <PackageX size={12} />
            <span>Sin Movimiento</span>
          </button>
          <button
            type="button"
            className={`wms-subtab ${reportSubTab === "kardex" ? "is-active" : ""}`}
            onClick={() => onReportSubTabChange("kardex")}
          >
            <History size={12} />
            <span>Kardex</span>
          </button>
        </div>
      )}

      {/* Drawer Body */}
      <div className="wms-drawer-body wms-scroll">
        {!data ? (
          <div className="wms-empty-state">Cargando catálogos de TAYO_WMS…</div>
        ) : activeTab === "operaciones" ? (
          <>
            {/* ENTRADA FORM */}
            {operationSubTab === "entrada" && (
              <form className="wms-form" onSubmit={(e) => void handleSubmitEntrada(e)}>
                <div className="wms-field">
                  <label className="wms-label" htmlFor="ent-prod">
                    <span>Producto (SKU · Peso)</span>
                    <span className="wms-mono">sp_RegistrarEntrada</span>
                  </label>
                  <select
                    id="ent-prod"
                    className="wms-select"
                    value={entProdId}
                    onChange={(e) => setEntProdId(Number(e.target.value))}
                  >
                    {productsByCategory.map((grp) => (
                      <optgroup key={grp.label} label={grp.label}>
                        {grp.items.map((p) => (
                          <option key={p.id_producto} value={p.id_producto}>
                            {p.sku} · {p.nombre_descripcion} ({p.peso_unitario_kg} kg)
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div className="wms-field-row">
                  <div className="wms-field">
                    <label className="wms-label" htmlFor="ent-qty">
                      Cantidad total (piezas)
                    </label>
                    <input
                      id="ent-qty"
                      type="number"
                      min={1}
                      step={1}
                      className="wms-input"
                      value={entQty}
                      onChange={(e) => setEntQty(e.target.value)}
                      required
                    />
                  </div>
                  <div className="wms-field">
                    <label className="wms-label" htmlFor="ent-tipo">
                      Tipo de entrada
                    </label>
                    <select
                      id="ent-tipo"
                      className="wms-select"
                      value={entTipoId}
                      onChange={(e) => setEntTipoId(Number(e.target.value))}
                    >
                      {data.tiposEntrada.map((t) => (
                        <option key={t.id_tipo_entrada} value={t.id_tipo_entrada}>
                          {t.codigo_tipo} · {t.nombre_tipo}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="wms-field-row">
                  <div className="wms-field">
                    <label className="wms-label" htmlFor="ent-resp">
                      Responsable activo
                    </label>
                    <select
                      id="ent-resp"
                      className="wms-select"
                      value={entRespId}
                      onChange={(e) => setEntRespId(Number(e.target.value))}
                    >
                      {activeResponsables.map((r) => (
                        <option
                          key={r.id_responsable_almacen}
                          value={r.id_responsable_almacen}
                        >
                          {r.codigo_responsable} · {r.nombre} {r.apellido}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="wms-field">
                    <label className="wms-label" htmlFor="ent-folio">
                      Folio de entrada
                    </label>
                    <input
                      id="ent-folio"
                      type="text"
                      className="wms-input wms-mono"
                      value={entFolio}
                      onChange={(e) => setEntFolio(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Live SQL Rule Preview */}
                {entradaPreview && (
                  <div className="wms-rule-preview">
                    <div className="wms-rule-header">
                      <span>Previsualización de Reglas SQL</span>
                      <span
                        className={`wms-badge ${
                          entradaPreview.feasible ? "wms-badge-green" : "wms-badge-red"
                        }`}
                      >
                        {entradaPreview.feasible ? "Capacidad OK" : "Sin capacidad suficiente"}
                      </span>
                    </div>
                    <div className="wms-rule-grid">
                      <div className="wms-rule-item">
                        <span className="wms-rule-k">Soporte asignado</span>
                        <span className="wms-rule-v">{entradaPreview.soporteLabel}</span>
                      </div>
                      <div className="wms-rule-item">
                        <span className="wms-rule-k">Capacidad máx</span>
                        <span className="wms-rule-v">
                          {entradaPreview.capMaxKg.toLocaleString()} kg
                        </span>
                      </div>
                      <div className="wms-rule-item">
                        <span className="wms-rule-k">FLOOR(cap / peso)</span>
                        <span className="wms-rule-v">
                          {entradaPreview.maxPiezasTarima} pzs/tarima
                        </span>
                      </div>
                      <div className="wms-rule-item">
                        <span className="wms-rule-k">Tarimas requeridas</span>
                        <span className="wms-rule-v">{entradaPreview.tarimasNecesarias}</span>
                      </div>
                      <div className="wms-rule-item">
                        <span className="wms-rule-k">Tarimas VACIA</span>
                        <span className="wms-rule-v">
                          {entradaPreview.tarimasVacias} disponibles
                        </span>
                      </div>
                      <div className="wms-rule-item">
                        <span className="wms-rule-k">
                          Slots Z-ALM ({entradaPreview.soporteCod})
                        </span>
                        <span className="wms-rule-v">
                          {entradaPreview.ubicacionesLibres} libres
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="wms-btn wms-btn-primary"
                  disabled={submitting}
                >
                  <ArrowDownToLine size={14} />
                  <span>
                    {submitting ? "Ejecutando SP…" : "Ejecutar sp_RegistrarEntrada"}
                  </span>
                </button>
              </form>
            )}

            {/* SALIDA FORM */}
            {operationSubTab === "salida" && (
              <form className="wms-form" onSubmit={(e) => void handleSubmitSalida(e)}>
                <div className="wms-field">
                  <label className="wms-label" htmlFor="sal-prod">
                    <span>Producto (Stock en Z-ALM)</span>
                    <span className="wms-mono">sp_RegistrarSalida</span>
                  </label>
                  <select
                    id="sal-prod"
                    className="wms-select"
                    value={salProdId}
                    onChange={(e) => setSalProdId(Number(e.target.value))}
                  >
                    {productsByCategory.map((grp) => (
                      <optgroup key={grp.label} label={grp.label}>
                        {grp.items.map((p) => {
                          const stk = zAlmStockMap.get(p.id_producto) ?? 0;
                          return (
                            <option key={p.id_producto} value={p.id_producto}>
                              {p.sku} · {p.nombre_descripcion} [Z-ALM: {stk} pzs]
                            </option>
                          );
                        })}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div className="wms-rule-preview">
                  <div className="wms-rule-header">
                    <span>Disponibilidad de Despacho</span>
                    <span
                      className={`wms-badge ${
                        activeSalProductStock >= (Number(salQty) || 0) && freeStagingCount > 0
                          ? "wms-badge-green"
                          : "wms-badge-amber"
                      }`}
                    >
                      {activeSalProductStock} pzs en Z-ALM
                    </span>
                  </div>
                  <div className="wms-rule-grid">
                    <div className="wms-rule-item">
                      <span className="wms-rule-k">Bahías Z-STAG libres</span>
                      <span className="wms-rule-v">{freeStagingCount} / 6</span>
                    </div>
                    <div className="wms-rule-item">
                      <span className="wms-rule-k">Flujo SP</span>
                      <span className="wms-rule-v">Z-ALM → Z-STAG → Despacho</span>
                    </div>
                  </div>
                </div>

                <div className="wms-field-row">
                  <div className="wms-field">
                    <label className="wms-label" htmlFor="sal-qty">
                      Cantidad salida (piezas)
                    </label>
                    <input
                      id="sal-qty"
                      type="number"
                      min={1}
                      step={1}
                      className="wms-input"
                      value={salQty}
                      onChange={(e) => setSalQty(e.target.value)}
                      required
                    />
                  </div>
                  <div className="wms-field">
                    <label className="wms-label" htmlFor="sal-tipo">
                      Tipo de salida
                    </label>
                    <select
                      id="sal-tipo"
                      className="wms-select"
                      value={salTipoId}
                      onChange={(e) => setSalTipoId(Number(e.target.value))}
                    >
                      {data.tiposSalida.map((t) => (
                        <option key={t.id_tipo_salida} value={t.id_tipo_salida}>
                          {t.codigo_tipo} · {t.nombre_tipo}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="wms-field-row">
                  <div className="wms-field">
                    <label className="wms-label" htmlFor="sal-cliente">
                      Cliente destino
                    </label>
                    <select
                      id="sal-cliente"
                      className="wms-select"
                      value={salClienteId}
                      onChange={(e) => setSalClienteId(Number(e.target.value))}
                    >
                      {data.clientes.map((c) => (
                        <option key={c.id_cliente} value={c.id_cliente}>
                          {c.nombre_razon_social}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="wms-field">
                    <label className="wms-label" htmlFor="sal-transp">
                      Transportista
                    </label>
                    <select
                      id="sal-transp"
                      className="wms-select"
                      value={salTranspId}
                      onChange={(e) => setSalTranspId(Number(e.target.value))}
                    >
                      {data.transportistas.map((t) => (
                        <option key={t.id_transportista} value={t.id_transportista}>
                          {t.empresa_transportista}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="wms-field-row">
                  <div className="wms-field">
                    <label className="wms-label" htmlFor="sal-resp">
                      Responsable activo
                    </label>
                    <select
                      id="sal-resp"
                      className="wms-select"
                      value={salRespId}
                      onChange={(e) => setSalRespId(Number(e.target.value))}
                    >
                      {activeResponsables.map((r) => (
                        <option
                          key={r.id_responsable_almacen}
                          value={r.id_responsable_almacen}
                        >
                          {r.codigo_responsable} · {r.nombre} {r.apellido}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="wms-field">
                    <label className="wms-label" htmlFor="sal-folio">
                      Folio de salida
                    </label>
                    <input
                      id="sal-folio"
                      type="text"
                      className="wms-input wms-mono"
                      value={salFolio}
                      onChange={(e) => setSalFolio(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="wms-btn wms-btn-primary"
                  disabled={submitting}
                >
                  <ArrowUpFromLine size={14} />
                  <span>
                    {submitting ? "Ejecutando SP…" : "Ejecutar sp_RegistrarSalida"}
                  </span>
                </button>
              </form>
            )}

            {/* REUBICACION FORM */}
            {operationSubTab === "reubicacion" && (
              <form className="wms-form" onSubmit={(e) => void handleSubmitReubicacion(e)}>
                <div className="wms-field">
                  <label className="wms-label" htmlFor="reu-tarima">
                    <span>Tarima ocupada</span>
                    <span className="wms-mono">sp_RegistrarReubicacion</span>
                  </label>
                  <select
                    id="reu-tarima"
                    className="wms-select"
                    value={reuTarimaId}
                    onChange={(e) => setReuTarimaId(Number(e.target.value))}
                  >
                    {occupiedTarimas.length === 0 ? (
                      <option value={0}>No hay tarimas ocupadas</option>
                    ) : (
                      occupiedTarimas.map((t) => {
                        const skuLabel =
                          t.items.length > 0 ? t.items[0].sku : t.estatus_tarima;
                        return (
                          <option key={t.id_tarima} value={t.id_tarima}>
                            {t.codigo_tarima} · {t.codigo_ubicacion ?? "Sin ubicación"} ·{" "}
                            {skuLabel} ({t.total_piezas} pzs)
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>

                <div className="wms-field">
                  <label className="wms-label" htmlFor="reu-dest">
                    Ubicación destino (libre o NULL)
                  </label>
                  <select
                    id="reu-dest"
                    className="wms-select"
                    value={reuDestValue}
                    onChange={(e) => setReuDestValue(e.target.value)}
                  >
                    <option value="__NULL__">NULL — Vaciar / Liberar tarima (VACIA)</option>
                    <optgroup label="Z-ALM · Almacén General (libres)">
                      {freeDestinationLocations
                        .filter((u) => u.codigo_zona === "Z-ALM")
                        .map((u) => (
                          <option key={u.id_ubicacion} value={String(u.id_ubicacion)}>
                            {u.codigo_ubicacion} ({u.codigo_soporte} · {u.capacidad_max_kg} kg)
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="Z-STAG · Muelle de Despacho (libres)">
                      {freeDestinationLocations
                        .filter((u) => u.codigo_zona === "Z-STAG")
                        .map((u) => (
                          <option key={u.id_ubicacion} value={String(u.id_ubicacion)}>
                            {u.codigo_ubicacion} ({u.codigo_soporte} · {u.capacidad_max_kg} kg)
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </div>

                <div className="wms-field-row">
                  <div className="wms-field">
                    <label className="wms-label" htmlFor="reu-resp">
                      Responsable activo
                    </label>
                    <select
                      id="reu-resp"
                      className="wms-select"
                      value={reuRespId}
                      onChange={(e) => setReuRespId(Number(e.target.value))}
                    >
                      {activeResponsables.map((r) => (
                        <option
                          key={r.id_responsable_almacen}
                          value={r.id_responsable_almacen}
                        >
                          {r.codigo_responsable} · {r.nombre} {r.apellido}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="wms-field">
                    <label className="wms-label" htmlFor="reu-folio">
                      Folio de reubicación
                    </label>
                    <input
                      id="reu-folio"
                      type="text"
                      className="wms-input wms-mono"
                      value={reuFolio}
                      onChange={(e) => setReuFolio(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="wms-btn wms-btn-primary"
                  disabled={submitting || !reuTarimaId}
                >
                  <ArrowRightLeft size={14} />
                  <span>
                    {submitting ? "Ejecutando SP…" : "Ejecutar sp_RegistrarReubicacion"}
                  </span>
                </button>
              </form>
            )}

            {/* Operation Result & T-SQL Console */}
            {feedback && (
              <div className={`wms-banner ${feedback.ok ? "is-ok" : "is-err"}`}>
                <div className="wms-banner-head">
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    {feedback.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span>{feedback.message}</span>
                  </div>
                  {feedback.ok &&
                    (feedback.focusUbicacionCodigo ||
                      feedback.focusTarimaCodigo ||
                      (feedback.affectedUbicacionIds?.length ?? 0) > 0) && (
                      <button
                        type="button"
                        className="wms-btn wms-btn-sm"
                        onClick={() =>
                          onFocus3D({
                            ubicacionCodigo: feedback.focusUbicacionCodigo,
                            tarimaCodigo: feedback.focusTarimaCodigo,
                            affectedUbicacionIds: feedback.affectedUbicacionIds,
                          })
                        }
                      >
                        <Crosshair size={13} />
                        <span>Enfocar en 3D</span>
                      </button>
                    )}
                </div>

                <div className="wms-sql-block">
                  <div className="wms-sql-top">
                    <span>T-SQL Ejecutado</span>
                    <button
                      type="button"
                      className="wms-sql-copy"
                      onClick={() => void handleCopySql(feedback.sqlCommand)}
                    >
                      {copiedSql ? <Check size={11} /> : <Copy size={11} />}
                      <span>{copiedSql ? "Copiado" : "Copiar"}</span>
                    </button>
                  </div>
                  <code>{feedback.sqlCommand}</code>
                </div>
              </div>
            )}
          </>
        ) : (
          /* TAB 2: REPORTES ANALÍTICOS */
          <>
            {repError && (
              <div className="wms-banner is-err">
                <div className="wms-banner-head">
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <AlertCircle size={16} />
                    <span>{repError}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 1. EXISTENCIAS */}
            {reportSubTab === "existencias" && (
              <>
                <div className="wms-filter-bar">
                  <div className="wms-field">
                    <label className="wms-label" htmlFor="rep-ex-zona">
                      Zona
                    </label>
                    <select
                      id="rep-ex-zona"
                      className="wms-select"
                      value={exZona}
                      onChange={(e) => setExZona(e.target.value as "" | ZonaCodigo)}
                    >
                      <option value="">Todas las zonas</option>
                      <option value="Z-ALM">Z-ALM · Almacén General</option>
                      <option value="Z-STAG">Z-STAG · Staging</option>
                    </select>
                  </div>
                  <div className="wms-field">
                    <label className="wms-label" htmlFor="rep-ex-cat">
                      Categoría
                    </label>
                    <select
                      id="rep-ex-cat"
                      className="wms-select"
                      value={exCat}
                      onChange={(e) =>
                        setExCat(e.target.value as "" | CategoriaCodigo)
                      }
                    >
                      <option value="">Todas (CEL/MES/LAM/MAC)</option>
                      <option value="CEL">CEL · Celosías</option>
                      <option value="MES">MES · Mesas</option>
                      <option value="LAM">LAM · Lámparas</option>
                      <option value="MAC">MAC · Macetas</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    className="wms-btn"
                    onClick={() => void loadActiveReport()}
                    disabled={repLoading}
                    title="Actualizar sp_ConsultarExistencias"
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>

                <div className="wms-kpi-grid">
                  <div className="wms-kpi-box">
                    <div className="wms-kpi-label">Registros activos</div>
                    <div className="wms-kpi-value">{existencias.length}</div>
                    <div className="wms-kpi-foot">Clic en fila enfoca en 3D</div>
                  </div>
                  <div className="wms-kpi-box">
                    <div className="wms-kpi-label">Total piezas filtradas</div>
                    <div className="wms-kpi-value">
                      {existencias
                        .reduce((acc, r) => acc + r.existenciaPiezas, 0)
                        .toLocaleString()}
                    </div>
                    <div className="wms-kpi-foot">sp_ConsultarExistencias</div>
                  </div>
                </div>

                <div className="wms-table-wrap wms-scroll">
                  <table className="wms-table">
                    <thead>
                      <tr>
                        <th>SKU / Producto</th>
                        <th>Ubicación</th>
                        <th>Tarima</th>
                        <th className="wms-text-right">Piezas</th>
                        <th className="wms-text-right">Peso kg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {repLoading ? (
                        <tr>
                          <td colSpan={5} className="wms-empty-state">
                            Consultando existencias…
                          </td>
                        </tr>
                      ) : existencias.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="wms-empty-state">
                            Sin existencias para los filtros seleccionados.
                          </td>
                        </tr>
                      ) : (
                        existencias.map((r) => (
                          <tr
                            key={`${r.id_tarima}-${r.sku}`}
                            className="is-clickable"
                            title={`Enfocar ${r.tarima} en ${r.ubicacion}`}
                            onClick={() =>
                              onFocus3D({
                                tarimaCodigo: r.tarima,
                                ubicacionCodigo: r.ubicacion,
                                affectedUbicacionIds: [r.id_ubicacion],
                              })
                            }
                          >
                            <td>
                              <div className="wms-mono" style={{ fontWeight: 700 }}>
                                {r.sku}
                              </div>
                              <div style={{ fontSize: 10.5, color: "#64748b" }}>
                                {r.descripcion}
                              </div>
                            </td>
                            <td>
                              <div className="wms-mono">{r.ubicacion}</div>
                              <span
                                className={`wms-badge ${
                                  r.zona === "Z-ALM" ? "wms-badge-blue" : "wms-badge-amber"
                                }`}
                              >
                                {r.zona} · {r.soporte}
                              </span>
                            </td>
                            <td className="wms-mono" style={{ fontWeight: 600 }}>
                              {r.tarima}
                            </td>
                            <td className="wms-text-right tabular-nums" style={{ fontWeight: 700 }}>
                              {r.existenciaPiezas}
                            </td>
                            <td className="wms-text-right tabular-nums">
                              <div>{r.pesoTotalTarimaKg.toFixed(1)}</div>
                              <div style={{ fontSize: 10, color: "#64748b" }}>
                                / {r.capacidadMaxSoporteKg}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* 2. ALERTA MINIMOS */}
            {reportSubTab === "alertas" && (
              <>
                <div className="wms-kpi-grid-3">
                  <div className="wms-kpi-box">
                    <div className="wms-kpi-label">SKUs en alerta</div>
                    <div className="wms-kpi-value" style={{ color: "#b45309" }}>
                      {alertas.length}
                    </div>
                  </div>
                  <div className="wms-kpi-box">
                    <div className="wms-kpi-label">Piezas a fabricar</div>
                    <div className="wms-kpi-value">
                      {alertas
                        .reduce((a, r) => a + r.sugerenciaFabricacionPiezas, 0)
                        .toLocaleString()}
                    </div>
                  </div>
                  <div className="wms-kpi-box">
                    <div className="wms-kpi-label">Costo estimado</div>
                    <div className="wms-kpi-value" style={{ fontSize: 13.5 }}>
                      {formatMxn(alertasCostoSum)}
                    </div>
                  </div>
                </div>

                <div className="wms-table-wrap wms-scroll">
                  <table className="wms-table">
                    <thead>
                      <tr>
                        <th>SKU / Producto</th>
                        <th className="wms-text-right">Actual / Mín</th>
                        <th className="wms-text-right">Sugerencia</th>
                        <th className="wms-text-right">Costo Est.</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {repLoading ? (
                        <tr>
                          <td colSpan={5} className="wms-empty-state">
                            Evaluando stocks mínimos…
                          </td>
                        </tr>
                      ) : alertas.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="wms-empty-state">
                            Todos los artículos Make-to-Stock están sobre su stock mínimo.
                          </td>
                        </tr>
                      ) : (
                        alertas.map((r) => (
                          <tr key={r.sku}>
                            <td>
                              <div className="wms-mono" style={{ fontWeight: 700 }}>
                                {r.sku}
                              </div>
                              <div style={{ fontSize: 10.5, color: "#64748b" }}>
                                {r.producto}
                              </div>
                            </td>
                            <td className="wms-text-right tabular-nums">
                              <span className="wms-badge wms-badge-red">
                                {r.existenciaActual} / {r.stockMinimo}
                              </span>
                              <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                                Ideal: {r.stockIdeal}
                              </div>
                            </td>
                            <td className="wms-text-right tabular-nums" style={{ fontWeight: 700 }}>
                              +{r.sugerenciaFabricacionPiezas} pzs
                            </td>
                            <td className="wms-text-right tabular-nums">
                              {formatMxn(r.costoEstimadoProduccion)}
                            </td>
                            <td className="wms-text-right">
                              <button
                                type="button"
                                className="wms-btn wms-btn-sm"
                                onClick={() => handleProduceFromAlert(r)}
                                title="Cargar lote sugerido en Entrada"
                              >
                                Producir
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* 3. ROTACION */}
            {reportSubTab === "rotacion" && (
              <>
                <div className="wms-filter-bar">
                  <div className="wms-field">
                    <label className="wms-label" htmlFor="rot-ini">
                      Fecha inicio
                    </label>
                    <input
                      id="rot-ini"
                      type="date"
                      className="wms-input"
                      value={rotInicio}
                      onChange={(e) => setRotInicio(e.target.value)}
                    />
                  </div>
                  <div className="wms-field">
                    <label className="wms-label" htmlFor="rot-fin">
                      Fecha fin
                    </label>
                    <input
                      id="rot-fin"
                      type="date"
                      className="wms-input"
                      value={rotFin}
                      onChange={(e) => setRotFin(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="wms-btn wms-btn-primary"
                    onClick={() => void loadActiveReport()}
                    disabled={repLoading}
                  >
                    Consultar
                  </button>
                </div>

                <div className="wms-kpi-grid-3">
                  <div className="wms-kpi-box">
                    <div className="wms-kpi-label">Unidades vendidas</div>
                    <div className="wms-kpi-value">
                      {rotacionUnidadesSum.toLocaleString()}
                    </div>
                  </div>
                  <div className="wms-kpi-box">
                    <div className="wms-kpi-label">Facturación</div>
                    <div className="wms-kpi-value" style={{ fontSize: 13 }}>
                      {formatMxn(rotacionVentaSum)}
                    </div>
                  </div>
                  <div className="wms-kpi-box">
                    <div className="wms-kpi-label">Margen bruto</div>
                    <div className="wms-kpi-value" style={{ fontSize: 13, color: "#047857" }}>
                      {formatMxn(rotacionMargenSum)}
                    </div>
                  </div>
                </div>

                <div className="wms-table-wrap wms-scroll">
                  <table className="wms-table">
                    <thead>
                      <tr>
                        <th>SKU / Producto</th>
                        <th className="wms-text-right">Vendidas</th>
                        <th className="wms-text-right">Venta ($)</th>
                        <th className="wms-text-right">Margen ($)</th>
                        <th className="wms-text-right">Pedidos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {repLoading ? (
                        <tr>
                          <td colSpan={5} className="wms-empty-state">
                            Calculando rotación…
                          </td>
                        </tr>
                      ) : rotacion.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="wms-empty-state">
                            Sin ventas registradas en este periodo.
                          </td>
                        </tr>
                      ) : (
                        rotacion.map((r) => (
                          <tr key={r.sku}>
                            <td>
                              <div className="wms-mono" style={{ fontWeight: 700 }}>
                                {r.sku}
                              </div>
                              <div style={{ fontSize: 10.5, color: "#64748b" }}>
                                {r.producto}
                              </div>
                            </td>
                            <td className="wms-text-right tabular-nums" style={{ fontWeight: 700 }}>
                              {r.unidadesVendidas}
                            </td>
                            <td className="wms-text-right tabular-nums">
                              {formatMxn(r.importeTotalVenta)}
                            </td>
                            <td
                              className="wms-text-right tabular-nums"
                              style={{ color: "#047857", fontWeight: 600 }}
                            >
                              {formatMxn(r.margenBrutoTotal)}
                            </td>
                            <td className="wms-text-right tabular-nums">
                              {r.numeroPedidosSurtidos}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* 4. VALOR INVENTARIO */}
            {reportSubTab === "valor" && (
              <>
                <div className="wms-filter-bar">
                  <div className="wms-field">
                    <label className="wms-label" htmlFor="val-corte">
                      Fecha de corte contable
                    </label>
                    <input
                      id="val-corte"
                      type="date"
                      className="wms-input"
                      value={valorFechaCorte}
                      onChange={(e) => setValorFechaCorte(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="wms-btn wms-btn-sm"
                    onClick={() => setValorFechaCorte("2026-10-31")}
                  >
                    Cierre Oct
                  </button>
                  <button
                    type="button"
                    className="wms-btn wms-btn-sm"
                    onClick={() => setValorFechaCorte("2026-11-30")}
                  >
                    Actual Nov
                  </button>
                  <button
                    type="button"
                    className="wms-btn wms-btn-primary"
                    onClick={() => void loadActiveReport()}
                    disabled={repLoading}
                  >
                    Consultar
                  </button>
                </div>

                <div className="wms-kpi-grid">
                  <div className="wms-kpi-box">
                    <div className="wms-kpi-label">Valuación total a costo</div>
                    <div className="wms-kpi-value" style={{ color: "#2d68e8" }}>
                      {formatMxn(valorTotalInventarioSum)}
                    </div>
                  </div>
                  <div className="wms-kpi-box">
                    <div className="wms-kpi-label">Existencia al corte</div>
                    <div className="wms-kpi-value">
                      {valorTotalPiezasSum.toLocaleString()} pzs
                    </div>
                    <div className="wms-kpi-foot">{valorRows.length} SKUs con saldo</div>
                  </div>
                </div>

                <div className="wms-table-wrap wms-scroll">
                  <table className="wms-table">
                    <thead>
                      <tr>
                        <th>SKU / Producto</th>
                        <th className="wms-text-right">Costo Unit.</th>
                        <th className="wms-text-right">Existencia</th>
                        <th className="wms-text-right">Valor Total ($)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {repLoading ? (
                        <tr>
                          <td colSpan={4} className="wms-empty-state">
                            Valuando inventario…
                          </td>
                        </tr>
                      ) : valorRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="wms-empty-state">
                            Sin inventario valorizado a la fecha de corte.
                          </td>
                        </tr>
                      ) : (
                        valorRows.map((r) => (
                          <tr key={r.sku}>
                            <td>
                              <div className="wms-mono" style={{ fontWeight: 700 }}>
                                {r.sku}
                              </div>
                              <div style={{ fontSize: 10.5, color: "#64748b" }}>
                                {r.producto}
                              </div>
                            </td>
                            <td className="wms-text-right tabular-nums">
                              {formatMxn(r.costoUnitario)}
                            </td>
                            <td className="wms-text-right tabular-nums">
                              {r.existenciaFechaCorte}
                            </td>
                            <td className="wms-text-right tabular-nums" style={{ fontWeight: 700 }}>
                              {formatMxn(r.valorTotalInventario)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* 5. SIN MOVIMIENTO */}
            {reportSubTab === "sin-movimiento" && (
              <>
                <div className="wms-filter-bar">
                  <div className="wms-field">
                    <label className="wms-label" htmlFor="sm-ini">
                      Desde
                    </label>
                    <input
                      id="sm-ini"
                      type="date"
                      className="wms-input"
                      value={sinMovInicio}
                      onChange={(e) => setSinMovInicio(e.target.value)}
                    />
                  </div>
                  <div className="wms-field">
                    <label className="wms-label" htmlFor="sm-fin">
                      Hasta
                    </label>
                    <input
                      id="sm-fin"
                      type="date"
                      className="wms-input"
                      value={sinMovFin}
                      onChange={(e) => setSinMovFin(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="wms-btn wms-btn-primary"
                    onClick={() => void loadActiveReport()}
                    disabled={repLoading}
                  >
                    Consultar
                  </button>
                </div>

                <div className="wms-kpi-grid">
                  <div className="wms-kpi-box">
                    <div className="wms-kpi-label">Capital inmovilizado</div>
                    <div className="wms-kpi-value" style={{ color: "#b45309" }}>
                      {formatMxn(sinMovCapitalSum)}
                    </div>
                  </div>
                  <div className="wms-kpi-box">
                    <div className="wms-kpi-label">SKUs sin venta</div>
                    <div className="wms-kpi-value">{sinMovRows.length}</div>
                    <div className="wms-kpi-foot">sp_ProductosSinMovimiento</div>
                  </div>
                </div>

                <div className="wms-table-wrap wms-scroll">
                  <table className="wms-table">
                    <thead>
                      <tr>
                        <th>SKU / Producto</th>
                        <th>Categoría</th>
                        <th className="wms-text-right">Existencia</th>
                        <th className="wms-text-right">Capital Inmov.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {repLoading ? (
                        <tr>
                          <td colSpan={4} className="wms-empty-state">
                            Analizando inventario estancado…
                          </td>
                        </tr>
                      ) : sinMovRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="wms-empty-state">
                            Todos los productos con stock tuvieron ventas en el periodo.
                          </td>
                        </tr>
                      ) : (
                        sinMovRows.map((r) => (
                          <tr key={r.sku}>
                            <td>
                              <div className="wms-mono" style={{ fontWeight: 700 }}>
                                {r.sku}
                              </div>
                              <div style={{ fontSize: 10.5, color: "#64748b" }}>
                                {r.producto}
                              </div>
                            </td>
                            <td>
                              <span className="wms-badge wms-badge-slate">
                                {r.categoria}
                              </span>
                            </td>
                            <td className="wms-text-right tabular-nums">
                              {r.existenciaActualAlmacen}
                            </td>
                            <td className="wms-text-right tabular-nums" style={{ fontWeight: 700 }}>
                              {formatMxn(r.capitalInmovilizado)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* 6. KARDEX */}
            {reportSubTab === "kardex" && (
              <>
                <div className="wms-filter-bar">
                  <div className="wms-field">
                    <label className="wms-label" htmlFor="kdx-sku">
                      SKU del artículo (sp_KardexArticulo)
                    </label>
                    <select
                      id="kdx-sku"
                      className="wms-select"
                      value={kardexSku}
                      onChange={(e) => setKardexSku(e.target.value)}
                    >
                      {productsByCategory.map((grp) => (
                        <optgroup key={grp.label} label={grp.label}>
                          {grp.items.map((p) => (
                            <option key={p.sku} value={p.sku}>
                              {p.sku} · {p.nombre_descripcion}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    className="wms-btn"
                    onClick={() => void loadActiveReport()}
                    disabled={repLoading}
                    title="Actualizar Kardex"
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>

                <div className="wms-kpi-grid-3">
                  <div className="wms-kpi-box">
                    <div className="wms-kpi-label">Entradas (+)</div>
                    <div className="wms-kpi-value" style={{ color: "#047857" }}>
                      +{kardexRows.reduce((a, r) => a + r.entrada, 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="wms-kpi-box">
                    <div className="wms-kpi-label">Salidas (-)</div>
                    <div className="wms-kpi-value" style={{ color: "#b91c1c" }}>
                      -{kardexRows.reduce((a, r) => a + r.salida, 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="wms-kpi-box">
                    <div className="wms-kpi-label">Saldo actual</div>
                    <div className="wms-kpi-value">
                      {kardexRows.length > 0
                        ? kardexRows[kardexRows.length - 1].saldoAcumulado.toLocaleString()
                        : 0}
                    </div>
                  </div>
                </div>

                <div className="wms-table-wrap wms-scroll">
                  <table className="wms-table">
                    <thead>
                      <tr>
                        <th>Fecha / Folio</th>
                        <th>Operación</th>
                        <th>Tarima</th>
                        <th className="wms-text-right">+ / -</th>
                        <th className="wms-text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {repLoading ? (
                        <tr>
                          <td colSpan={5} className="wms-empty-state">
                            Reconstruyendo Kardex…
                          </td>
                        </tr>
                      ) : kardexRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="wms-empty-state">
                            Este SKU no tiene movimientos registrados aún.
                          </td>
                        </tr>
                      ) : (
                        kardexRows.map((r, idx) => (
                          <tr key={`${r.folioDocumento}-${r.codigoTarima}-${idx}`}>
                            <td>
                              <div className="wms-mono" style={{ fontWeight: 600 }}>
                                {r.folioDocumento}
                              </div>
                              <div style={{ fontSize: 10, color: "#64748b" }}>
                                {formatDateTime(r.fechaHora)}
                              </div>
                            </td>
                            <td>
                              <div>{r.operacion}</div>
                              <div style={{ fontSize: 10, color: "#64748b" }}>
                                {r.responsable}
                              </div>
                            </td>
                            <td className="wms-mono">{r.codigoTarima}</td>
                            <td className="wms-text-right tabular-nums">
                              {r.entrada > 0 ? (
                                <span style={{ color: "#047857", fontWeight: 700 }}>
                                  +{r.entrada}
                                </span>
                              ) : (
                                <span style={{ color: "#b91c1c", fontWeight: 700 }}>
                                  -{r.salida}
                                </span>
                              )}
                            </td>
                            <td className="wms-text-right tabular-nums" style={{ fontWeight: 700 }}>
                              {r.saldoAcumulado}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

export default SqlOperationsDrawer;
