import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  Box,
  Building2,
  ChevronLeft,
  ChevronRight,
  Database,
  HardDrive,
  History,
  Layers,
  MapPin,
  Navigation,
  Package,
  RefreshCw,
  SlidersHorizontal,
  Truck,
  UserCheck,
  X,
} from "lucide-react";
import { JOURNEY_STAGES, ZONES_LAYOUT } from "@/data/layout";
import {
  fetchBootstrap,
  fetchWmsStatus,
  resetMemoryDemo,
} from "@/services/wmsApi";
import {
  MINERAL_COLOR_HEX,
  type JourneySeek,
  type QualityMode,
  type TarimaState,
  type UbicacionState,
  type ViewMode,
  type WmsBootstrapData,
  type WmsStatusResponse,
  type ZonaCodigo,
} from "@/types/wms";
import DemoPlaybackControls from "./DemoPlaybackControls";
import SqlOperationsDrawer, {
  type DrawerMainTab,
  type OperationSubTab,
  type ReportSubTab,
} from "./SqlOperationsDrawer";
import WarehouseScene from "./WarehouseScene";

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class SceneErrorBoundary extends Component<
  { children: ReactNode; onRetry: () => void },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, errorMessage: "" };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || "Error inesperado en el renderizado WebGL.",
    };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Handled gracefully by fallback UI
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="wms-error-fallback">
          <div className="wms-error-card">
            <AlertTriangle size={28} color="#f59e0b" />
            <h2 style={{ margin: 0, fontSize: 16 }}>
              No se pudo inicializar la escena 3D
            </h2>
            <p style={{ margin: 0, fontSize: 12.5, color: "#475569" }}>
              {this.state.errorMessage}
            </p>
            <p style={{ margin: 0, fontSize: 11.5, color: "#64748b" }}>
              Puedes seguir utilizando el panel de Operaciones y Reportes SQL mientras
              reintentas el contexto WebGL.
            </p>
            <button
              type="button"
              className="wms-btn wms-btn-primary"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: "" });
                this.props.onRetry();
              }}
            >
              <RefreshCw size={14} />
              <span>Reintentar Escena 3D</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function getTarimaBadgeClass(estatus: TarimaState["estatus_tarima"]): string {
  if (estatus === "EN_ALMACEN") return "wms-badge-blue";
  if (estatus === "EN_STAGING") return "wms-badge-amber";
  return "wms-badge-slate";
}

function getEventBadgeClass(tipo: "ENTRADA" | "SALIDA" | "REUBICACION"): string {
  if (tipo === "ENTRADA") return "wms-badge-green";
  if (tipo === "SALIDA") return "wms-badge-amber";
  return "wms-badge-blue";
}

function resolveSelection(
  selectedId: string,
  data: WmsBootstrapData | null
): {
  ubicacion: UbicacionState | null;
  tarima: TarimaState | null;
} {
  if (!data || !selectedId) return { ubicacion: null, tarima: null };
  if (selectedId.startsWith("loc:")) {
    const code = selectedId.slice(4);
    const ubicacion =
      data.ubicaciones.find((u) => u.codigo_ubicacion === code) ?? null;
    return { ubicacion, tarima: ubicacion?.tarima ?? null };
  }
  if (selectedId.startsWith("tarima:")) {
    const code = selectedId.slice(7);
    const tarima = data.tarimas.find((t) => t.codigo_tarima === code) ?? null;
    const ubicacion = tarima?.id_ubicacion
      ? data.ubicaciones.find((u) => u.id_ubicacion === tarima.id_ubicacion) ?? null
      : null;
    return { ubicacion, tarima };
  }
  return { ubicacion: null, tarima: null };
}

export function WarehouseExperience() {
  const [data, setData] = useState<WmsBootstrapData | null>(null);
  const [status, setStatus] = useState<WmsStatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forceMemory, setForceMemory] = useState<boolean>(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);

  // 3D Scene & Playback State
  const [sceneMountKey, setSceneMountKey] = useState<number>(0);
  const [sceneReady, setSceneReady] = useState<boolean>(false);
  const [mode, setMode] = useState<ViewMode>("exterior");
  const [selectedId, setSelectedId] = useState<string>("warehouse");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [focusKey, setFocusKey] = useState<number>(0);
  const [following, setFollowing] = useState<boolean>(false);
  const [journeyRunning, setJourneyRunning] = useState<boolean>(true);
  const [journeyStage, setJourneyStage] = useState<number>(0);
  const [journeyRunId, setJourneyRunId] = useState<number>(1);
  const [journeySeek, setJourneySeek] = useState<JourneySeek | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [playbackPaused, setPlaybackPaused] = useState<boolean>(false);
  const [quality, setQuality] = useState<QualityMode>("high");
  const [highlightedUbicacionIds, setHighlightedUbicacionIds] = useState<number[]>([]);

  const journeyClock = useRef<number>(0);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  // SQL Drawer State
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerTab, setDrawerTab] = useState<DrawerMainTab>("operaciones");
  const [operationSubTab, setOperationSubTab] =
    useState<OperationSubTab>("entrada");
  const [reportSubTab, setReportSubTab] = useState<ReportSubTab>("existencias");
  const [kardexSku, setKardexSku] = useState<string | null>(null);
  const [reubicacionTarimaId, setReubicacionTarimaId] = useState<number | null>(
    null
  );
  const [existenciasZona, setExistenciasZona] = useState<"" | ZonaCodigo>("");
  const [salidaTransportistaId, setSalidaTransportistaId] = useState<number | null>(
    null
  );

  const loadInitialData = useCallback(async (retrySql = false) => {
    setLoading(true);
    setLoadError(null);
    try {
      const [st, boot] = await Promise.all([
        fetchWmsStatus(retrySql).catch(
          (): WmsStatusResponse => ({
            mode: "memory",
            sqlConfigured: false,
            sqlConnected: false,
            database: "TAYO_WMS (Local)",
            message: "Backend Express no detectado; ejecutando motor en memoria.",
          })
        ),
        fetchBootstrap(false),
      ]);
      setStatus(st);
      setData(boot);
      if (retrySql && st.sqlConnected) {
        setForceMemory(false);
      }
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : "No se pudo inicializar los datos de TAYO_WMS."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  // Smoothly update bottom journey progress bar without re-rendering React tree
  useEffect(() => {
    let rafId = 0;
    const syncBar = () => {
      if (progressBarRef.current) {
        const raw = journeyClock.current;
        const pct = Math.max(0, Math.min(1, Number.isFinite(raw) ? raw : 0)) * 100;
        progressBarRef.current.style.width = `${pct.toFixed(1)}%`;
      }
      rafId = window.requestAnimationFrame(syncBar);
    };
    rafId = window.requestAnimationFrame(syncBar);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  const seekToStage = useCallback((stageIndex: number) => {
    const clamped = Math.max(0, Math.min(JOURNEY_STAGES.length - 1, stageIndex));
    setMode("interior");
    setJourneyRunning(true);
    setJourneyStage(clamped);
    setJourneySeek((prev) => ({
      stage: clamped,
      key: (prev?.key ?? 0) + 1,
    }));
  }, []);

  const handleModeChange = useCallback((nextMode: ViewMode) => {
    setMode(nextMode);
    if (nextMode === "exterior") {
      setFollowing(false);
    }
  }, []);

  const handleFollowPallet = useCallback(() => {
    setMode("interior");
    setSelectedId("journey:pallet");
    setJourneyRunning(true);
    setPlaybackPaused(false);
    setFollowing(true);
    setFocusKey((k) => k + 1);
  }, []);

  const handleSelectObject = useCallback((id: string) => {
    setSelectedId(id);
    setFollowing(id === "journey:pallet");
    setFocusKey((k) => k + 1);
    setStatusMenuOpen(false);
  }, []);

  const handleManualCamera = useCallback(() => {
    setFollowing(false);
  }, []);

  const handleJourneyFinish = useCallback(() => {
    // Restart loop seamlessly for continuous demo inspection
    setJourneyRunId((id) => id + 1);
    setJourneyStage(0);
  }, []);

  const handleToggleLocalSim = useCallback(async () => {
    const next = !forceMemory;
    setForceMemory(next);
    setStatusMenuOpen(false);
    try {
      const snap = await fetchBootstrap(next);
      setData(snap);
    } catch {
      await loadInitialData(false);
    }
  }, [forceMemory, loadInitialData]);

  const handleResetSimulation = useCallback(async () => {
    setResetting(true);
    try {
      const snap = await resetMemoryDemo(forceMemory);
      setData(snap);
      setHighlightedUbicacionIds([]);
    } finally {
      setResetting(false);
    }
  }, [forceMemory]);

  const handleFocus3DFromDrawer = useCallback(
    (opts: {
      ubicacionCodigo?: string | null;
      tarimaCodigo?: string | null;
      affectedUbicacionIds?: number[];
    }) => {
      setMode("interior");
      setFollowing(false);
      if (opts.tarimaCodigo) {
        setSelectedId(`tarima:${opts.tarimaCodigo}`);
      } else if (opts.ubicacionCodigo) {
        setSelectedId(`loc:${opts.ubicacionCodigo}`);
      } else {
        setSelectedId("warehouse");
      }
      setHighlightedUbicacionIds(opts.affectedUbicacionIds ?? []);
      setFocusKey((k) => k + 1);
      if (window.innerWidth <= 960) {
        setDrawerOpen(false);
      }
    },
    []
  );

  // Keyboard shortcuts: Space, ArrowLeft, ArrowRight, Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "SELECT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (e.key === "Escape") {
        if (drawerOpen) {
          setDrawerOpen(false);
        } else if (statusMenuOpen) {
          setStatusMenuOpen(false);
        } else {
          setSelectedId("");
          setFollowing(false);
          setHighlightedUbicacionIds([]);
        }
        return;
      }

      if (isEditing) return;

      if (e.code === "Space") {
        e.preventDefault();
        setPlaybackPaused((p) => !p);
        return;
      }

      if (mode === "interior") {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          seekToStage(journeyStage - 1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          seekToStage(journeyStage + 1);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen, statusMenuOpen, mode, journeyStage, seekToStage]);

  // Hover tooltip descriptor
  const hoverContent = useMemo(() => {
    if (!hoveredId || !data) return null;

    if (hoveredId === "warehouse") {
      return {
        kicker: "CEDIS TAYO",
        title: "Almacén de Concreto Arquitectónico",
        sub: `${data.stats.ubicacionesOcupadas}/${data.stats.ubicacionesTotales} ubicaciones ocupadas · ${data.stats.totalPiezas.toLocaleString()} pzs`,
      };
    }

    if (hoveredId.startsWith("zone:")) {
      const zCod = hoveredId.slice(5);
      const zLayout = ZONES_LAYOUT.find((z) => z.id === zCod);
      const slots = data.ubicaciones.filter((u) => u.codigo_zona === zCod);
      const occ = slots.filter((u) => u.tarima !== null).length;
      return {
        kicker: `Zona ${zCod}`,
        title: zLayout?.name ?? zCod,
        sub: `${occ}/${slots.length} bahías ocupadas`,
      };
    }

    if (hoveredId.startsWith("loc:") || hoveredId.startsWith("tarima:")) {
      const { ubicacion, tarima } = resolveSelection(hoveredId, data);
      if (tarima) {
        const firstSku = tarima.items[0]?.sku ?? "Sin SKU";
        return {
          kicker: `${ubicacion?.codigo_ubicacion ?? tarima.estatus_tarima} · ${
            ubicacion?.codigo_soporte ?? tarima.codigo_soporte ?? ""
          }`,
          title: `${tarima.codigo_tarima} · ${firstSku}`,
          sub: `${tarima.total_piezas} pzs · ${tarima.peso_total_kg.toFixed(1)} kg`,
        };
      }
      if (ubicacion) {
        return {
          kicker: `${ubicacion.codigo_zona} · ${ubicacion.codigo_soporte}`,
          title: ubicacion.codigo_ubicacion,
          sub: `Ubicación libre · Máx ${ubicacion.capacidad_max_kg} kg`,
        };
      }
    }

    if (hoveredId.startsWith("forklift:")) {
      const cod = hoveredId.slice(9);
      const resp = data.responsables.find((r) => r.codigo_responsable === cod);
      return {
        kicker: "Montacargas CEDIS",
        title: cod,
        sub: resp ? `${resp.nombre} ${resp.apellido}` : "Operador en turno",
      };
    }

    if (hoveredId.startsWith("truck:")) {
      const id = hoveredId.slice(6);
      const transp = data.transportistas.find(
        (t) => String(t.id_transportista) === id
      );
      return {
        kicker: `Muelle #${id}`,
        title: transp?.empresa_transportista ?? `Transportista #${id}`,
        sub: transp?.telefono_contacto ?? "Unidad de reparto",
      };
    }

    if (hoveredId === "journey:pallet") {
      const stage = JOURNEY_STAGES[journeyStage] ?? JOURNEY_STAGES[0];
      return {
        kicker: "Tarima en Ruta (Demo)",
        title: `${stage.code} · ${stage.title}`,
        sub: stage.sqlAction,
      };
    }

    return null;
  }, [hoveredId, data, journeyStage]);

  const effectiveSource = forceMemory
    ? "memory"
    : data?.source ?? status?.mode ?? "memory";
  const isSqlLive = effectiveSource === "sqlserver";
  const alertCount = data?.stats.alertasMinimoCount ?? 0;

  // Render floating object inspector card body
  const renderInspector = () => {
    if (drawerOpen || !selectedId || !data) return null;

    // 1. Warehouse Summary
    if (selectedId === "warehouse") {
      const occupancyPct =
        data.stats.ubicacionesTotales > 0
          ? Math.round(
              (data.stats.ubicacionesOcupadas / data.stats.ubicacionesTotales) *
                100
            )
          : 0;
      return (
        <section className="wms-inspector" aria-label="Inspector del CEDIS">
          <div className="wms-inspector-header">
            <div>
              <div className="wms-inspector-kicker">
                <Building2 size={12} />
                <span>Resumen General</span>
              </div>
              <h3 className="wms-inspector-title">CEDIS TAYO Concreto</h3>
              <div className="wms-inspector-sub">
                44 SKUs · 42 Ubicaciones · 30 Tarimas
              </div>
            </div>
            <button
              type="button"
              className="wms-icon-btn"
              onClick={() => setSelectedId("")}
              aria-label="Cerrar inspector"
            >
              <X size={15} />
            </button>
          </div>

          <div className="wms-inspector-body wms-scroll">
            <div className="wms-kpi-grid">
              <div className="wms-kpi-box">
                <div className="wms-kpi-label">Total piezas</div>
                <div className="wms-kpi-value">
                  {data.stats.totalPiezas.toLocaleString()}
                </div>
                <div className="wms-kpi-foot">Inventario físico</div>
              </div>
              <div className="wms-kpi-box">
                <div className="wms-kpi-label">Tarimas</div>
                <div className="wms-kpi-value">
                  {data.stats.tarimasActivas}
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>
                    {" "}
                    / {data.stats.tarimasVacias} vacías
                  </span>
                </div>
                <div className="wms-kpi-foot">Activas vs disponibles</div>
              </div>
            </div>

            <div className="wms-progress-block">
              <div className="wms-progress-head">
                <span>Ocupación de ubicaciones</span>
                <span className="tabular-nums">
                  {data.stats.ubicacionesOcupadas}/{data.stats.ubicacionesTotales} (
                  {occupancyPct}%)
                </span>
              </div>
              <div className="wms-progress-track">
                <div
                  className={`wms-progress-fill ${
                    occupancyPct > 85 ? "is-warn" : ""
                  }`}
                  style={{ width: `${occupancyPct}%` }}
                />
              </div>
            </div>

            <div className="wms-kv-list">
              <div className="wms-kv-row">
                <span className="wms-kv-label">Alertas stock mínimo</span>
                <span className="wms-kv-val">
                  <span
                    className={`wms-badge ${
                      alertCount > 0 ? "wms-badge-amber" : "wms-badge-green"
                    }`}
                  >
                    {alertCount} SKUs
                  </span>
                </span>
              </div>
              <div className="wms-kv-row">
                <span className="wms-kv-label">Operadores activos</span>
                <span className="wms-kv-val">
                  {data.responsables.filter((r) => r.activo).length} en turno
                </span>
              </div>
            </div>

            {alertCount > 0 && (
              <button
                type="button"
                className="wms-btn wms-btn-primary"
                onClick={() => {
                  setDrawerTab("reportes");
                  setReportSubTab("alertas");
                  setDrawerOpen(true);
                }}
              >
                <AlertTriangle size={14} />
                <span>Ver {alertCount} Alertas de Mínimos</span>
              </button>
            )}

            {data.recentEvents.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    marginBottom: 6,
                  }}
                >
                  Movimientos recientes
                </div>
                <div className="wms-event-list">
                  {data.recentEvents.slice(0, 4).map((ev) => (
                    <div key={ev.id} className="wms-event-item">
                      <div className="wms-event-top">
                        <span className={`wms-badge ${getEventBadgeClass(ev.tipo)}`}>
                          {ev.tipo}
                        </span>
                        <span className="wms-mono" style={{ color: "#475569" }}>
                          {ev.folio}
                        </span>
                      </div>
                      <div className="wms-event-desc">{ev.resumen}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      );
    }

    // 2. Zone Inspector
    if (selectedId.startsWith("zone:")) {
      const zCod = selectedId.slice(5);
      const zLayout = ZONES_LAYOUT.find((z) => z.id === zCod);
      const zSql = data.zonas.find((z) => z.codigo_zona === zCod);
      const slots = data.ubicaciones.filter((u) => u.codigo_zona === zCod);
      const occSlots = slots.filter((u) => u.tarima !== null);
      const totalPieces = occSlots.reduce(
        (a, u) => a + (u.tarima?.total_piezas ?? 0),
        0
      );
      const totalWeight = occSlots.reduce(
        (a, u) => a + (u.tarima?.peso_total_kg ?? 0),
        0
      );
      const occPct =
        slots.length > 0 ? Math.round((occSlots.length / slots.length) * 100) : 0;

      return (
        <section className="wms-inspector" aria-label="Inspector de Zona">
          <div className="wms-inspector-header">
            <div>
              <div className="wms-inspector-kicker">
                <Layers size={12} />
                <span>Zona {zLayout?.number ?? ""} · {zCod}</span>
              </div>
              <h3 className="wms-inspector-title">
                {zSql?.nombre_zona ?? zLayout?.name ?? zCod}
              </h3>
            </div>
            <button
              type="button"
              className="wms-icon-btn"
              onClick={() => setSelectedId("")}
              aria-label="Cerrar inspector"
            >
              <X size={15} />
            </button>
          </div>
          <div className="wms-inspector-body wms-scroll">
            {zLayout?.description && (
              <p style={{ margin: 0, fontSize: 12, color: "#475569" }}>
                {zLayout.description}
              </p>
            )}
            <div className="wms-kpi-grid">
              <div className="wms-kpi-box">
                <div className="wms-kpi-label">Bahías ocupadas</div>
                <div className="wms-kpi-value">
                  {occSlots.length} / {slots.length}
                </div>
                <div className="wms-kpi-foot">{occPct}% ocupación</div>
              </div>
              <div className="wms-kpi-box">
                <div className="wms-kpi-label">Carga total</div>
                <div className="wms-kpi-value">
                  {totalPieces.toLocaleString()} pzs
                </div>
                <div className="wms-kpi-foot">
                  {totalWeight.toLocaleString("es-MX", {
                    maximumFractionDigits: 1,
                  })}{" "}
                  kg
                </div>
              </div>
            </div>

            {zCod === "Z-ALM" && (
              <div className="wms-kv-list">
                <div className="wms-kv-row">
                  <span className="wms-kv-label">Racks (RCK · 1,000 kg)</span>
                  <span className="wms-kv-val">
                    {
                      occSlots.filter((s) => s.codigo_soporte === "RCK").length
                    }{" "}
                    / {slots.filter((s) => s.codigo_soporte === "RCK").length}
                  </span>
                </div>
                <div className="wms-kv-row">
                  <span className="wms-kv-label">Piso (PIS · 2,500 kg)</span>
                  <span className="wms-kv-val">
                    {
                      occSlots.filter((s) => s.codigo_soporte === "PIS").length
                    }{" "}
                    / {slots.filter((s) => s.codigo_soporte === "PIS").length}
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              className="wms-btn wms-btn-primary"
              onClick={() => {
                setExistenciasZona(zCod as ZonaCodigo);
                setDrawerTab("reportes");
                setReportSubTab("existencias");
                setDrawerOpen(true);
              }}
            >
              <Package size={14} />
              <span>Ver Existencias en {zCod}</span>
            </button>
          </div>
        </section>
      );
    }

    // 3. Location or Tarima Inspector
    if (selectedId.startsWith("loc:") || selectedId.startsWith("tarima:")) {
      const { ubicacion, tarima } = resolveSelection(selectedId, data);
      if (!ubicacion && !tarima) return null;

      const capMaxKg =
        ubicacion?.capacidad_max_kg ?? tarima?.capacidad_max_kg ?? 1000;
      const pesoTotal = tarima?.peso_total_kg ?? 0;
      const loadPct =
        capMaxKg > 0 ? Math.min(100, Math.round((pesoTotal / capMaxKg) * 100)) : 0;
      const primaryItem = tarima?.items[0] ?? null;

      return (
        <section className="wms-inspector" aria-label="Inspector de Tarima y Ubicación">
          <div className="wms-inspector-header">
            <div>
              <div className="wms-inspector-kicker">
                <MapPin size={12} />
                <span>
                  {ubicacion?.codigo_zona ?? tarima?.codigo_zona ?? "Sin zona"} ·{" "}
                  {ubicacion?.nombre_soporte ??
                    tarima?.codigo_soporte ??
                    "Soporte"}
                </span>
              </div>
              <h3 className="wms-inspector-title wms-mono">
                {ubicacion?.codigo_ubicacion ?? tarima?.codigo_tarima}
              </h3>
              {tarima && (
                <div className="wms-inspector-sub" style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                  <span className="wms-mono" style={{ fontWeight: 700, color: "#0f172a" }}>
                    {tarima.codigo_tarima}
                  </span>
                  <span className={`wms-badge ${getTarimaBadgeClass(tarima.estatus_tarima)}`}>
                    {tarima.estatus_tarima}
                  </span>
                </div>
              )}
            </div>
            <button
              type="button"
              className="wms-icon-btn"
              onClick={() => setSelectedId("")}
              aria-label="Cerrar inspector"
            >
              <X size={15} />
            </button>
          </div>

          <div className="wms-inspector-body wms-scroll">
            {ubicacion && (
              <div className="wms-kv-list">
                <div className="wms-kv-row">
                  <span className="wms-kv-label">Pasillo / Nivel / Pos</span>
                  <span className="wms-kv-val wms-mono">
                    {ubicacion.pasillo} · N{ubicacion.nivel} · P{ubicacion.posicion}
                  </span>
                </div>
                <div className="wms-kv-row">
                  <span className="wms-kv-label">Soporte físico</span>
                  <span className="wms-kv-val">
                    {ubicacion.codigo_soporte} ({capMaxKg.toLocaleString()} kg máx)
                  </span>
                </div>
              </div>
            )}

            {tarima && tarima.items.length > 0 ? (
              <>
                {tarima.items.map((item) => (
                  <div key={item.id_producto} className="wms-kv-list">
                    <div className="wms-kv-row">
                      <span className="wms-kv-label">SKU</span>
                      <span className="wms-kv-val wms-mono">{item.sku}</span>
                    </div>
                    <div className="wms-kv-row">
                      <span className="wms-kv-label">Producto</span>
                      <span className="wms-kv-val" style={{ maxWidth: 195 }}>
                        {item.nombre_descripcion}
                      </span>
                    </div>
                    <div className="wms-kv-row">
                      <span className="wms-kv-label">Categoría / Modelo</span>
                      <span className="wms-kv-val">
                        {item.nombre_categoria} · {item.nombre_modelo}
                      </span>
                    </div>
                    <div className="wms-kv-row">
                      <span className="wms-kv-label">Color mineral</span>
                      <span className="wms-kv-val">
                        <span
                          className="wms-swatch"
                          style={{
                            background: MINERAL_COLOR_HEX[item.codigo_col],
                          }}
                        />
                        <span>
                          {item.nombre_color} ({item.codigo_col})
                        </span>
                      </span>
                    </div>
                    <div className="wms-kv-row">
                      <span className="wms-kv-label">Existencia</span>
                      <span className="wms-kv-val tabular-nums">
                        {item.cantidad.toLocaleString()} piezas
                      </span>
                    </div>
                  </div>
                ))}

                <div className="wms-progress-block">
                  <div className="wms-progress-head">
                    <span>Carga vs capacidad</span>
                    <span className="tabular-nums">
                      {pesoTotal.toFixed(1)} / {capMaxKg.toLocaleString()} kg ({loadPct}%)
                    </span>
                  </div>
                  <div className="wms-progress-track">
                    <div
                      className={`wms-progress-fill ${
                        loadPct > 95 ? "is-danger" : loadPct > 80 ? "is-warn" : ""
                      }`}
                      style={{ width: `${loadPct}%` }}
                    />
                  </div>
                </div>

                <div className="wms-btn-row">
                  <button
                    type="button"
                    className="wms-btn wms-btn-flex"
                    onClick={() => {
                      if (primaryItem) setKardexSku(primaryItem.sku);
                      setDrawerTab("reportes");
                      setReportSubTab("kardex");
                      setDrawerOpen(true);
                    }}
                  >
                    <History size={14} />
                    <span>Ver Kardex</span>
                  </button>
                  <button
                    type="button"
                    className="wms-btn wms-btn-primary wms-btn-flex"
                    onClick={() => {
                      setReubicacionTarimaId(tarima.id_tarima);
                      setDrawerTab("operaciones");
                      setOperationSubTab("reubicacion");
                      setDrawerOpen(true);
                    }}
                  >
                    <ArrowRightLeft size={14} />
                    <span>Reubicar</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="wms-kpi-box">
                  <div className="wms-kpi-label">Estado</div>
                  <div className="wms-kpi-value" style={{ fontSize: 14, color: "#047857" }}>
                    Ubicación Disponible
                  </div>
                  <div className="wms-kpi-foot">
                    Lista para recibir tarima por entrada o reubicación.
                  </div>
                </div>
                <button
                  type="button"
                  className="wms-btn wms-btn-primary"
                  onClick={() => {
                    setDrawerTab("operaciones");
                    setOperationSubTab("entrada");
                    setDrawerOpen(true);
                  }}
                >
                  <Package size={14} />
                  <span>Registrar Entrada</span>
                </button>
              </>
            )}
          </div>
        </section>
      );
    }

    // 4. Forklift Inspector
    if (selectedId.startsWith("forklift:")) {
      const cod = selectedId.slice(9);
      const resp = data.responsables.find((r) => r.codigo_responsable === cod);
      return (
        <section className="wms-inspector" aria-label="Inspector de Montacargas">
          <div className="wms-inspector-header">
            <div>
              <div className="wms-inspector-kicker">
                <UserCheck size={12} />
                <span>Operador de Almacén</span>
              </div>
              <h3 className="wms-inspector-title">
                {resp ? `${resp.nombre} ${resp.apellido}` : cod}
              </h3>
              <div className="wms-inspector-sub wms-mono">{cod}</div>
            </div>
            <button
              type="button"
              className="wms-icon-btn"
              onClick={() => setSelectedId("")}
              aria-label="Cerrar inspector"
            >
              <X size={15} />
            </button>
          </div>
          <div className="wms-inspector-body">
            <div className="wms-kv-list">
              <div className="wms-kv-row">
                <span className="wms-kv-label">Estado</span>
                <span className="wms-kv-val">
                  <span
                    className={`wms-badge ${
                      resp?.activo !== false ? "wms-badge-green" : "wms-badge-slate"
                    }`}
                  >
                    {resp?.activo !== false ? "Activo en turno" : "Inactivo"}
                  </span>
                </span>
              </div>
              <div className="wms-kv-row">
                <span className="wms-kv-label">Equipo asignado</span>
                <span className="wms-kv-val">Montacargas Eléctrico</span>
              </div>
              <div className="wms-kv-row">
                <span className="wms-kv-label">Cobertura</span>
                <span className="wms-kv-val">Z-ALM ↔ Z-STAG</span>
              </div>
            </div>
          </div>
        </section>
      );
    }

    // 5. Truck Inspector
    if (selectedId.startsWith("truck:")) {
      const id = selectedId.slice(6);
      const transp = data.transportistas.find(
        (t) => String(t.id_transportista) === id
      );
      return (
        <section className="wms-inspector" aria-label="Inspector de Transportista">
          <div className="wms-inspector-header">
            <div>
              <div className="wms-inspector-kicker">
                <Truck size={12} />
                <span>Andén de Carga #{id}</span>
              </div>
              <h3 className="wms-inspector-title">
                {transp?.empresa_transportista ?? `Transportista #${id}`}
              </h3>
            </div>
            <button
              type="button"
              className="wms-icon-btn"
              onClick={() => setSelectedId("")}
              aria-label="Cerrar inspector"
            >
              <X size={15} />
            </button>
          </div>
          <div className="wms-inspector-body">
            <div className="wms-kv-list">
              <div className="wms-kv-row">
                <span className="wms-kv-label">Teléfono contacto</span>
                <span className="wms-kv-val wms-mono">
                  {transp?.telefono_contacto ?? "—"}
                </span>
              </div>
              <div className="wms-kv-row">
                <span className="wms-kv-label">Muelle asignado</span>
                <span className="wms-kv-val">Puerta #{id} · Z-STAG</span>
              </div>
            </div>
            <button
              type="button"
              className="wms-btn wms-btn-primary"
              onClick={() => {
                if (transp) setSalidaTransportistaId(transp.id_transportista);
                setDrawerTab("operaciones");
                setOperationSubTab("salida");
                setDrawerOpen(true);
              }}
            >
              <Truck size={14} />
              <span>Registrar Salida con Transportista</span>
            </button>
          </div>
        </section>
      );
    }

    // 6. Journey Pallet Inspector
    if (selectedId === "journey:pallet") {
      const stage = JOURNEY_STAGES[journeyStage] ?? JOURNEY_STAGES[0];
      return (
        <section className="wms-inspector" aria-label="Inspector de Recorrido Tarima">
          <div className="wms-inspector-header">
            <div>
              <div className="wms-inspector-kicker">
                <Navigation size={12} />
                <span>Ciclo SQL · Etapa 0{stage.index + 1}/05</span>
              </div>
              <h3 className="wms-inspector-title">{stage.subtitle}</h3>
              <div className="wms-inspector-sub wms-mono">{stage.sqlAction}</div>
            </div>
            <button
              type="button"
              className="wms-icon-btn"
              onClick={() => {
                setSelectedId("");
                setFollowing(false);
              }}
              aria-label="Cerrar inspector"
            >
              <X size={15} />
            </button>
          </div>
          <div className="wms-inspector-body">
            <p style={{ margin: 0, fontSize: 12.5, color: "#334155" }}>
              {stage.description}
            </p>
            <div className="wms-btn-row">
              <button
                type="button"
                className={`wms-btn wms-btn-flex ${
                  following ? "wms-btn-primary" : ""
                }`}
                onClick={() => setFollowing((f) => !f)}
              >
                <Navigation size={13} />
                <span>{following ? "Siguiendo cámara" : "Seguir cámara"}</span>
              </button>
            </div>
          </div>
        </section>
      );
    }

    return null;
  };

  return (
    <main
      className="wms-root"
      onPointerMove={(e) => setPointerPos({ x: e.clientX, y: e.clientY })}
    >
      {/* Full-bleed 3D Canvas */}
      <div className="wms-canvas-wrap">
        <SceneErrorBoundary
          key={sceneMountKey}
          onRetry={() => setSceneMountKey((k) => k + 1)}
        >
          <WarehouseScene
            mode={mode}
            selectedId={selectedId}
            hoveredId={hoveredId}
            focusKey={focusKey}
            animate
            following={following}
            journeyRunning={journeyRunning}
            journeyStage={journeyStage}
            journeyRunId={journeyRunId}
            playbackSpeed={playbackSpeed}
            playbackPaused={playbackPaused}
            quality={quality}
            journeySeek={journeySeek}
            journeyClock={journeyClock}
            ubicaciones={data?.ubicaciones ?? []}
            tarimas={data?.tarimas ?? []}
            responsables={data?.responsables ?? []}
            transportistas={data?.transportistas ?? []}
            highlightedUbicacionIds={highlightedUbicacionIds}
            onReady={() => setSceneReady(true)}
            onJourneyStage={setJourneyStage}
            onJourneyFinish={handleJourneyFinish}
            onManualCamera={handleManualCamera}
            onSelect={handleSelectObject}
            onHover={setHoveredId}
          />
        </SceneErrorBoundary>
      </div>

      {/* HUD Overlay */}
      <div className="wms-hud-layer">
        {/* Top Pill Navigation Bar */}
        <header className="wms-topbar">
          <div className="wms-topbar-group">
            <div className="wms-pill-surface">
              <button
                type="button"
                className="wms-brand"
                onClick={() => {
                  setSelectedId("warehouse");
                  setFollowing(false);
                  setHighlightedUbicacionIds([]);
                  setFocusKey((k) => k + 1);
                }}
                title="Ver resumen general del CEDIS"
              >
                <span className="wms-brand-mark">
                  <Box size={16} />
                </span>
                <span className="wms-brand-text">
                  <span className="wms-brand-title">TAYO WMS</span>
                  <span className="wms-brand-sub">CEDIS Concreto</span>
                </span>
              </button>

              <div className="wms-segmented" role="group" aria-label="Vista 3D">
                <button
                  type="button"
                  className={`wms-seg-btn ${mode === "exterior" ? "is-active" : ""}`}
                  onClick={() => handleModeChange("exterior")}
                >
                  Exterior
                </button>
                <button
                  type="button"
                  className={`wms-seg-btn ${mode === "interior" ? "is-active" : ""}`}
                  onClick={() => handleModeChange("interior")}
                >
                  Interior
                </button>
              </div>
            </div>

            <button
              type="button"
              className={`wms-pill-btn ${following ? "is-following" : ""}`}
              onClick={handleFollowPallet}
              title="Cambiar a interior y seguir el ciclo de tarima en 5 etapas"
            >
              <Navigation size={14} />
              <span>Seguir Tarima</span>
            </button>
          </div>

          <div className="wms-topbar-group">
            {/* Connection Status Pill */}
            <div className="wms-status-wrap">
              <button
                type="button"
                className="wms-status-pill"
                onClick={() => setStatusMenuOpen((o) => !o)}
                title={status?.message ?? "Estado de conexión de datos"}
              >
                <span
                  className={`wms-dot ${isSqlLive ? "is-sql" : "is-memory"}`}
                />
                <span>
                  {isSqlLive ? "SQL Server Live" : "Motor en Memoria"}
                </span>
              </button>

              {statusMenuOpen && (
                <div className="wms-status-popover" role="dialog" aria-label="Conexión WMS">
                  <div className="wms-status-popover-title">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {isSqlLive ? <Database size={14} /> : <HardDrive size={14} />}
                      {isSqlLive ? "SQL Server Conectado" : "Simulación en Memoria"}
                    </span>
                    <button
                      type="button"
                      className="wms-icon-btn"
                      onClick={() => setStatusMenuOpen(false)}
                      aria-label="Cerrar"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <p className="wms-status-popover-msg">
                    <strong>Base:</strong> {status?.database ?? "TAYO_WMS"}
                    <br />
                    {status?.message ??
                      "Ejecutando lógica exacta de procedimientos almacenados."}
                  </p>
                  <div className="wms-status-actions">
                    <button
                      type="button"
                      className="wms-btn wms-btn-sm"
                      onClick={() => void loadInitialData(true)}
                    >
                      <RefreshCw size={12} />
                      <span>Reintentar SQL</span>
                    </button>
                    {status?.sqlConnected && (
                      <button
                        type="button"
                        className="wms-btn wms-btn-sm wms-btn-primary"
                        onClick={() => void handleToggleLocalSim()}
                      >
                        <span>
                          {forceMemory ? "Usar SQL Server" : "Simulación Local"}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Primary CTA: SQL Drawer */}
            <button
              type="button"
              className={`wms-cta-btn ${drawerOpen ? "is-open" : ""}`}
              onClick={() => setDrawerOpen((o) => !o)}
            >
              <SlidersHorizontal size={15} />
              <span>Operaciones y Reportes SQL</span>
              {alertCount > 0 && (
                <span
                  className="wms-alert-badge"
                  title={`${alertCount} SKUs por debajo del stock mínimo`}
                >
                  {alertCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Loading / Load Error Notice */}
        {(loading || !sceneReady) && (
          <div className="wms-loading-pill">
            <RefreshCw size={13} />
            <span>
              {loading
                ? "Cargando inventario TAYO_WMS…"
                : "Inicializando diorama 3D…"}
            </span>
          </div>
        )}

        {loadError && !loading && (
          <div
            className="wms-loading-pill"
            style={{ background: "#fef2f2", color: "#b91c1c" }}
          >
            <AlertTriangle size={13} />
            <span>{loadError}</span>
          </div>
        )}

        {/* Pointer Hover Tooltip */}
        {hoverContent && !drawerOpen && (
          <div
            className="wms-tooltip"
            style={{
              left: Math.min(window.innerWidth - 275, pointerPos.x + 14),
              top: Math.min(window.innerHeight - 105, pointerPos.y + 14),
            }}
          >
            <div className="wms-tooltip-kicker">{hoverContent.kicker}</div>
            <div className="wms-tooltip-title">{hoverContent.title}</div>
            <div className="wms-tooltip-sub">{hoverContent.sub}</div>
          </div>
        )}

        {/* Floating Object Inspector Card */}
        {renderInspector()}

        {/* Bottom 5-Stage Journey Bar + DemoPlaybackControls */}
        {!drawerOpen && (
          <div className="wms-bottom-dock">
            <div className="wms-journey-bar" role="region" aria-label="Ciclo operativo de tarima">
              <div className="wms-journey-row">
                <button
                  type="button"
                  className="wms-step-btn"
                  onClick={() => seekToStage(journeyStage - 1)}
                  disabled={journeyStage <= 0}
                  title="Etapa anterior (←)"
                  aria-label="Etapa anterior"
                >
                  <ChevronLeft size={15} />
                </button>

                {JOURNEY_STAGES.map((st) => {
                  const active = st.index === journeyStage;
                  return (
                    <button
                      key={st.code}
                      type="button"
                      className={`wms-stage-pill ${active ? "is-active" : ""}`}
                      onClick={() => seekToStage(st.index)}
                      title={`${st.subtitle} (${st.sqlAction})`}
                    >
                      <span className="wms-stage-num">0{st.index + 1}</span>
                      <span>{st.title}</span>
                    </button>
                  );
                })}

                <button
                  type="button"
                  className="wms-step-btn"
                  onClick={() => seekToStage(journeyStage + 1)}
                  disabled={journeyStage >= JOURNEY_STAGES.length - 1}
                  title="Siguiente etapa (→)"
                  aria-label="Siguiente etapa"
                >
                  <ChevronRight size={15} />
                </button>
              </div>

              <div className="wms-journey-rail" aria-hidden="true">
                <div ref={progressBarRef} className="wms-journey-rail-fill" />
              </div>
            </div>

            <DemoPlaybackControls
              paused={playbackPaused}
              speed={playbackSpeed}
              quality={quality}
              onTogglePause={() => setPlaybackPaused((p) => !p)}
              onSpeedChange={setPlaybackSpeed}
              onQualityChange={setQuality}
            />
          </div>
        )}

        {/* Slide-Over SQL Operations & Analytical Reports Drawer */}
        <SqlOperationsDrawer
          open={drawerOpen}
          data={data}
          forceMemory={forceMemory}
          activeTab={drawerTab}
          operationSubTab={operationSubTab}
          reportSubTab={reportSubTab}
          initialKardexSku={kardexSku}
          initialReubicacionTarimaId={reubicacionTarimaId}
          initialExistenciasZona={existenciasZona}
          initialSalidaTransportistaId={salidaTransportistaId}
          resetting={resetting}
          onClose={() => setDrawerOpen(false)}
          onTabChange={setDrawerTab}
          onOperationSubTabChange={setOperationSubTab}
          onReportSubTabChange={setReportSubTab}
          onSnapshotUpdate={setData}
          onFocus3D={handleFocus3DFromDrawer}
          onResetSimulation={handleResetSimulation}
        />
      </div>
    </main>
  );
}

export default WarehouseExperience;
