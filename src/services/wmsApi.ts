import { memoryEngine } from "@/data/tayoEngine";
import type {
  AlertaMinimoRow,
  ExistenciaRow,
  KardexRow,
  OperationResult,
  RegistrarEntradaRequest,
  RegistrarReubicacionRequest,
  RegistrarSalidaRequest,
  RotacionRow,
  SinMovimientoRow,
  ValorInventarioRow,
  WmsBootstrapData,
  WmsStatusResponse,
} from "@/types/wms";

class ApiBusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiBusinessError";
  }
}

async function requestJson<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (res.ok) {
    return (await res.json()) as T;
  }

  if (res.status === 502 || res.status === 503 || res.status === 504) {
    throw new Error(`Servidor no disponible (HTTP ${res.status}).`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    let payload: { error?: string; message?: string } | null = null;
    try {
      payload = (await res.json()) as { error?: string; message?: string };
    } catch {
      payload = null;
    }

    const msg = payload?.error || payload?.message;
    if (msg) {
      throw new ApiBusinessError(msg);
    }
    if (res.status >= 400 && res.status < 500) {
      throw new ApiBusinessError(`Error de validación SQL (HTTP ${res.status}).`);
    }
  } else if (res.status >= 400 && res.status < 500) {
    const text = await res.text().catch(() => "");
    throw new ApiBusinessError(
      text || `Error de validación SQL (HTTP ${res.status}).`
    );
  }

  // Non-JSON 500 (e.g. Vite proxy when Express port 3001 is offline) -> trigger fallback
  throw new Error(`Backend Express no disponible (HTTP ${res.status}).`);
}

async function withDualMode<T>(
  forceMemory: boolean | undefined,
  remoteCall: () => Promise<T>,
  memoryCall: () => T
): Promise<T> {
  if (forceMemory) {
    return memoryCall();
  }

  try {
    return await remoteCall();
  } catch (err) {
    if (err instanceof ApiBusinessError) {
      throw new Error(err.message);
    }
    return memoryCall();
  }
}

export async function fetchWmsStatus(
  retrySql = false
): Promise<WmsStatusResponse> {
  const url = retrySql ? "/api/wms/status?retry=1" : "/api/wms/status";
  return withDualMode(
    false,
    () => requestJson<WmsStatusResponse>(url),
    () => ({
      mode: "memory",
      sqlConfigured: false,
      sqlConnected: false,
      database: "TAYO_WMS",
      message:
        "Backend Express no detectado; ejecutando Motor en Memoria local sincronizado con simulacion_operaciones.sql.",
    })
  );
}

export async function fetchBootstrap(
  forceMemory?: boolean
): Promise<WmsBootstrapData> {
  return withDualMode(
    forceMemory,
    () => requestJson<WmsBootstrapData>("/api/wms/bootstrap"),
    () => memoryEngine.getSnapshot("memory")
  );
}

export async function resetMemoryDemo(
  forceMemory?: boolean
): Promise<WmsBootstrapData> {
  return withDualMode(
    forceMemory,
    async () => {
      const snapshot = await requestJson<WmsBootstrapData>("/api/wms/reset", {
        method: "POST",
      });
      memoryEngine.reset(true);
      return snapshot;
    },
    () => {
      memoryEngine.reset(true);
      return memoryEngine.getSnapshot("memory");
    }
  );
}

export async function execRegistrarEntrada(
  req: RegistrarEntradaRequest,
  forceMemory?: boolean
): Promise<OperationResult> {
  return withDualMode(
    forceMemory,
    () =>
      requestJson<OperationResult>("/api/wms/entrada", {
        method: "POST",
        body: JSON.stringify(req),
      }),
    () => memoryEngine.registrarEntrada(req, "memory")
  );
}

export async function execRegistrarSalida(
  req: RegistrarSalidaRequest,
  forceMemory?: boolean
): Promise<OperationResult> {
  return withDualMode(
    forceMemory,
    () =>
      requestJson<OperationResult>("/api/wms/salida", {
        method: "POST",
        body: JSON.stringify(req),
      }),
    () => memoryEngine.registrarSalida(req, "memory")
  );
}

export async function execRegistrarReubicacion(
  req: RegistrarReubicacionRequest,
  forceMemory?: boolean
): Promise<OperationResult> {
  return withDualMode(
    forceMemory,
    () =>
      requestJson<OperationResult>("/api/wms/reubicacion", {
        method: "POST",
        body: JSON.stringify(req),
      }),
    () => memoryEngine.registrarReubicacion(req, "memory")
  );
}

export async function fetchExistencias(
  codigo_zona?: string,
  codigo_cat?: string,
  forceMemory?: boolean
): Promise<ExistenciaRow[]> {
  const params = new URLSearchParams();
  if (codigo_zona) params.set("codigo_zona", codigo_zona);
  if (codigo_cat) params.set("codigo_cat", codigo_cat);
  const qs = params.toString();
  const url = `/api/wms/reportes/existencias${qs ? `?${qs}` : ""}`;

  return withDualMode(
    forceMemory,
    () => requestJson<ExistenciaRow[]>(url),
    () => memoryEngine.consultarExistencias(codigo_zona, codigo_cat)
  );
}

export async function fetchAlertasMinimos(
  forceMemory?: boolean
): Promise<AlertaMinimoRow[]> {
  return withDualMode(
    forceMemory,
    () => requestJson<AlertaMinimoRow[]>("/api/wms/reportes/alertas-minimos"),
    () => memoryEngine.alertaResurtidoMinimos()
  );
}

export async function fetchRotacion(
  fechaInicio?: string,
  fechaFin?: string,
  forceMemory?: boolean
): Promise<RotacionRow[]> {
  const params = new URLSearchParams();
  if (fechaInicio) params.set("fecha_inicio", fechaInicio);
  if (fechaFin) params.set("fecha_fin", fechaFin);
  const qs = params.toString();
  const url = `/api/wms/reportes/rotacion${qs ? `?${qs}` : ""}`;

  return withDualMode(
    forceMemory,
    () => requestJson<RotacionRow[]>(url),
    () => memoryEngine.rotacionInventario(fechaInicio, fechaFin)
  );
}

export async function fetchValorInventario(
  fechaCorte?: string,
  forceMemory?: boolean
): Promise<ValorInventarioRow[]> {
  const params = new URLSearchParams();
  if (fechaCorte) params.set("fecha_corte", fechaCorte);
  const qs = params.toString();
  const url = `/api/wms/reportes/valor-inventario${qs ? `?${qs}` : ""}`;

  return withDualMode(
    forceMemory,
    () => requestJson<ValorInventarioRow[]>(url),
    () => memoryEngine.valorInventarioFecha(fechaCorte)
  );
}

export async function fetchSinMovimiento(
  fechaInicio?: string,
  fechaFin?: string,
  forceMemory?: boolean
): Promise<SinMovimientoRow[]> {
  const params = new URLSearchParams();
  if (fechaInicio) params.set("fecha_inicio", fechaInicio);
  if (fechaFin) params.set("fecha_fin", fechaFin);
  const qs = params.toString();
  const url = `/api/wms/reportes/sin-movimiento${qs ? `?${qs}` : ""}`;

  return withDualMode(
    forceMemory,
    () => requestJson<SinMovimientoRow[]>(url),
    () => memoryEngine.productosSinMovimiento(fechaInicio, fechaFin)
  );
}

export async function fetchKardex(
  sku: string,
  forceMemory?: boolean
): Promise<KardexRow[]> {
  const params = new URLSearchParams();
  params.set("sku", sku);
  const url = `/api/wms/reportes/kardex?${params.toString()}`;

  return withDualMode(
    forceMemory,
    () => requestJson<KardexRow[]>(url),
    () => memoryEngine.kardexArticulo(sku)
  );
}
