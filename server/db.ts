import path from "node:path";
import dotenv from "dotenv";
import sql from "mssql";
import { getUbicacionPosition3d } from "../src/data/layout";
import { TayoWmsEngine } from "../src/data/tayoEngine";
import type {
  AlertaMinimoRow,
  CategoriaCodigo,
  CategoriaProducto,
  Cliente,
  ColorMineral,
  ExistenciaRow,
  KardexRow,
  ModeloDiseno,
  OperationResult,
  Producto,
  RegistrarEntradaRequest,
  RegistrarReubicacionRequest,
  RegistrarSalidaRequest,
  ResponsableAlmacen,
  RotacionRow,
  SinMovimientoRow,
  TarimaInventoryItem,
  TarimaState,
  TipoEntrada,
  TipoSalida,
  TipoSoporte,
  Transportista,
  UbicacionState,
  ValorInventarioRow,
  WmsBootstrapData,
  WmsStatusResponse,
  WmsTimelineEvent,
  ZonaAlmacen,
  ZonaCodigo,
} from "../src/types/wms";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export class SqlValidationError extends Error {
  public readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "SqlValidationError";
  }
}

export const serverMemoryEngine = new TayoWmsEngine(true);

let pool: sql.ConnectionPool | null = null;
let connectPromise: Promise<sql.ConnectionPool | null> | null = null;
let lastAttemptMs = 0;
let lastSqlError: string | null = null;

function isSqlConfigured(): boolean {
  return Boolean(
    process.env.DB_SERVER?.trim() &&
      process.env.DB_USER?.trim() &&
      process.env.DB_PASSWORD?.trim()
  );
}

function getDbConfig(): sql.config {
  return {
    server: process.env.DB_SERVER || "localhost",
    port: Number(process.env.DB_PORT || 1433),
    database: process.env.DB_DATABASE || "TAYO_WMS",
    user: process.env.DB_USER || "sa",
    password: process.env.DB_PASSWORD || "",
    connectionTimeout: 2500,
    requestTimeout: 8000,
    options: {
      encrypt: process.env.DB_ENCRYPT === "true",
      trustServerCertificate:
        process.env.DB_TRUST_SERVER_CERTIFICATE !== "false",
      useUTC: true,
    },
  };
}

function isConnectionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; name?: string };
  return (
    e.code === "ELOGIN" ||
    e.code === "ESOCKET" ||
    e.code === "ETIMEOUT" ||
    e.code === "ECONNCLOSED" ||
    e.code === "ENOTOPEN" ||
    e.name === "ConnectionError"
  );
}

function extractSqlMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

function toSqlDateTime(raw?: string, endOfDayIfDateOnly = false): Date {
  if (!raw || !raw.trim()) {
    const now = new Date();
    return new Date(
      Date.UTC(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds()
      )
    );
  }

  let s = raw.trim().replace("T", " ");
  if (s.endsWith("Z")) s = s.slice(0, -1);
  const dotIdx = s.indexOf(".");
  if (dotIdx !== -1) s = s.slice(0, dotIdx);

  const match = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (!match) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
    throw new SqlValidationError(`Formato de fecha inválido: '${raw}'.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hasTime = match[4] !== undefined;
  const hour = hasTime ? Number(match[4]) : endOfDayIfDateOnly ? 23 : 0;
  const minute = hasTime ? Number(match[5]) : endOfDayIfDateOnly ? 59 : 0;
  const second =
    match[6] !== undefined
      ? Number(match[6])
      : hasTime
        ? 0
        : endOfDayIfDateOnly
          ? 59
          : 0;

  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}

function formatSqlDate(value: unknown): string {
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(
      value.getUTCDate()
    )} ${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(
      value.getUTCSeconds()
    )}`;
  }
  return String(value ?? "");
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export async function initDb(
  forceRetry = false
): Promise<sql.ConnectionPool | null> {
  if (pool && pool.connected) {
    return pool;
  }

  if (!isSqlConfigured()) {
    lastSqlError = "Credenciales de SQL Server no configuradas en .env.";
    return null;
  }

  const now = Date.now();
  if (!forceRetry && lastAttemptMs > 0 && now - lastAttemptMs < 3000) {
    return null;
  }

  if (connectPromise) {
    return connectPromise;
  }

  lastAttemptMs = now;
  connectPromise = (async () => {
    try {
      const nextPool = new sql.ConnectionPool(getDbConfig());
      await nextPool.connect();
      pool = nextPool;
      lastSqlError = null;
      console.log(
        `[TAYO WMS] Conectado a SQL Server (${process.env.DB_DATABASE || "TAYO_WMS"}).`
      );
      return pool;
    } catch (err) {
      pool = null;
      lastSqlError = extractSqlMessage(err);
      console.warn(
        `[TAYO WMS] SQL Server no disponible (${lastSqlError}). Usando Motor en Memoria.`
      );
      return null;
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
}

export async function getActivePool(
  retry = false
): Promise<sql.ConnectionPool | null> {
  if (pool && pool.connected) {
    return pool;
  }
  if (retry || lastAttemptMs === 0) {
    return initDb(retry);
  }
  return null;
}

export async function getWmsStatus(retry = false): Promise<WmsStatusResponse> {
  const configured = isSqlConfigured();
  const activePool = await getActivePool(retry);
  const connected = Boolean(activePool && activePool.connected);
  const database = process.env.DB_DATABASE || "TAYO_WMS";

  if (connected) {
    return {
      mode: "sqlserver",
      sqlConfigured: configured,
      sqlConnected: true,
      database,
      message: `Conectado en vivo a SQL Server (${database}).`,
    };
  }

  return {
    mode: "memory",
    sqlConfigured: configured,
    sqlConnected: false,
    database,
    message: configured
      ? `SQL Server no disponible (${lastSqlError ?? "sin conexión"}). Operando en Motor en Memoria.`
      : "Motor en Memoria activo (sin credenciales SQL en .env; sincronizado con simulacion_operaciones.sql).",
  };
}

async function runSqlQuery<T>(
  activePool: sql.ConnectionPool,
  fn: (p: sql.ConnectionPool) => Promise<T>
): Promise<T> {
  try {
    return await fn(activePool);
  } catch (err) {
    if (isConnectionError(err)) {
      lastSqlError = extractSqlMessage(err);
      try {
        await pool?.close();
      } catch {
        // ignore close failure
      }
      pool = null;
      throw err;
    }
    throw new SqlValidationError(extractSqlMessage(err));
  }
}

async function fetchBootstrapSql(
  activePool: sql.ConnectionPool
): Promise<WmsBootstrapData> {
  return runSqlQuery(activePool, async (p) => {
    const [
      catRes,
      modRes,
      colRes,
      prodRes,
      zonaRes,
      sopRes,
      respRes,
      tEntRes,
      tSalRes,
      cliRes,
      transRes,
      ubiRes,
      tarRes,
      invRes,
      eventsRes,
      alertasRes,
    ] = await Promise.all([
      p
        .request()
        .query<CategoriaProducto>(
          "SELECT id_categoria, codigo_cat, nombre_categoria FROM CATEGORIA_PRODUCTO ORDER BY id_categoria"
        ),
      p
        .request()
        .query<ModeloDiseno>(
          "SELECT id_modelo, codigo_mod, nombre_modelo FROM MODELO_DISENO ORDER BY id_modelo"
        ),
      p
        .request()
        .query<ColorMineral>(
          "SELECT id_color, codigo_col, nombre_color FROM COLOR_MINERAL ORDER BY id_color"
        ),
      p.request().query<Producto>(
        `SELECT p.id_producto, p.sku, p.nombre_descripcion,
                p.id_categoria, c.codigo_cat, c.nombre_categoria,
                p.id_modelo, m.codigo_mod, m.nombre_modelo,
                p.id_color, col.codigo_col, col.nombre_color,
                CAST(p.alto_cm AS FLOAT) AS alto_cm,
                CAST(p.ancho_cm AS FLOAT) AS ancho_cm,
                CAST(p.profundidad_cm AS FLOAT) AS profundidad_cm,
                CAST(p.peso_unitario_kg AS FLOAT) AS peso_unitario_kg,
                CAST(p.costo_unitario AS FLOAT) AS costo_unitario,
                CAST(p.precio_venta AS FLOAT) AS precio_venta,
                p.stock_minimo, p.stock_ideal
         FROM PRODUCTO p
         INNER JOIN CATEGORIA_PRODUCTO c ON c.id_categoria = p.id_categoria
         INNER JOIN MODELO_DISENO m ON m.id_modelo = p.id_modelo
         INNER JOIN COLOR_MINERAL col ON col.id_color = p.id_color
         ORDER BY p.id_producto`
      ),
      p
        .request()
        .query<ZonaAlmacen>(
          "SELECT id_zona, codigo_zona, nombre_zona FROM ZONA_ALMACEN ORDER BY id_zona"
        ),
      p.request().query<TipoSoporte>(
        `SELECT id_tipo_soporte, codigo_soporte, nombre_soporte,
                CAST(capacidad_max_kg AS FLOAT) AS capacidad_max_kg
         FROM TIPO_SOPORTE ORDER BY id_tipo_soporte`
      ),
      p
        .request()
        .query<ResponsableAlmacen>(
          "SELECT id_responsable_almacen, codigo_responsable, nombre, apellido, CAST(activo AS BIT) AS activo FROM RESPONSABLE_ALMACEN ORDER BY id_responsable_almacen"
        ),
      p
        .request()
        .query<TipoEntrada>(
          "SELECT id_tipo_entrada, codigo_tipo, nombre_tipo FROM TIPO_ENTRADA ORDER BY id_tipo_entrada"
        ),
      p
        .request()
        .query<TipoSalida>(
          "SELECT id_tipo_salida, codigo_tipo, nombre_tipo FROM TIPO_SALIDA ORDER BY id_tipo_salida"
        ),
      p
        .request()
        .query<Cliente>(
          "SELECT id_cliente, nombre_razon_social, telefono, correo, direccion_entrega FROM CLIENTE ORDER BY id_cliente"
        ),
      p
        .request()
        .query<Transportista>(
          "SELECT id_transportista, empresa_transportista, telefono_contacto FROM TRANSPORTISTA ORDER BY id_transportista"
        ),
      p.request().query<{
        id_ubicacion: number;
        id_zona: number;
        codigo_zona: ZonaCodigo;
        id_tipo_soporte: number;
        codigo_soporte: "RCK" | "PIS";
        nombre_soporte: string;
        capacidad_max_kg: number;
        codigo_ubicacion: string;
        pasillo: string;
        nivel: number;
        posicion: number;
        activa: boolean;
      }>(
        `SELECT u.id_ubicacion, u.id_zona, z.codigo_zona,
                u.id_tipo_soporte, sop.codigo_soporte, sop.nombre_soporte,
                CAST(sop.capacidad_max_kg AS FLOAT) AS capacidad_max_kg,
                u.codigo_ubicacion, u.pasillo, u.nivel, u.posicion,
                CAST(u.activa AS BIT) AS activa
         FROM UBICACION u
         INNER JOIN ZONA_ALMACEN z ON z.id_zona = u.id_zona
         INNER JOIN TIPO_SOPORTE sop ON sop.id_tipo_soporte = u.id_tipo_soporte
         ORDER BY u.id_ubicacion`
      ),
      p.request().query<{
        id_tarima: number;
        codigo_tarima: string;
        estatus_tarima: "VACIA" | "EN_ALMACEN" | "EN_STAGING";
        id_ubicacion: number | null;
      }>(
        "SELECT id_tarima, codigo_tarima, estatus_tarima, id_ubicacion FROM TARIMA ORDER BY id_tarima"
      ),
      p.request().query<
        TarimaInventoryItem & { id_tarima: number }
      >(
        `SELECT
           t.id_tarima,
           p.id_producto,
           p.sku,
           p.nombre_descripcion,
           c.codigo_cat,
           c.nombre_categoria,
           m.codigo_mod,
           m.nombre_modelo,
           col.codigo_col,
           col.nombre_color,
           (
             ISNULL((SELECT SUM(de.cantidad_ingresada) FROM DETALLE_ENTRADA de WHERE de.id_tarima = t.id_tarima AND de.id_producto = p.id_producto), 0)
             -
             ISNULL((SELECT SUM(ds.cantidad_salida) FROM DETALLE_SALIDA ds WHERE ds.id_tarima = t.id_tarima AND ds.id_producto = p.id_producto), 0)
           ) AS cantidad,
           CAST(p.peso_unitario_kg AS FLOAT) AS peso_unitario_kg,
           CAST(0 AS FLOAT) AS peso_total_kg
         FROM TARIMA t
         INNER JOIN DETALLE_ENTRADA de2 ON de2.id_tarima = t.id_tarima
         INNER JOIN PRODUCTO p ON p.id_producto = de2.id_producto
         INNER JOIN CATEGORIA_PRODUCTO c ON c.id_categoria = p.id_categoria
         INNER JOIN MODELO_DISENO m ON m.id_modelo = p.id_modelo
         INNER JOIN COLOR_MINERAL col ON col.id_color = p.id_color
         WHERE t.estatus_tarima IN ('EN_ALMACEN', 'EN_STAGING')
         GROUP BY
           t.id_tarima, p.id_producto, p.sku, p.nombre_descripcion,
           c.codigo_cat, c.nombre_categoria, m.codigo_mod, m.nombre_modelo,
           col.codigo_col, col.nombre_color, p.peso_unitario_kg
         HAVING (
           ISNULL((SELECT SUM(de.cantidad_ingresada) FROM DETALLE_ENTRADA de WHERE de.id_tarima = t.id_tarima AND de.id_producto = p.id_producto), 0)
           -
           ISNULL((SELECT SUM(ds.cantidad_salida) FROM DETALLE_SALIDA ds WHERE ds.id_tarima = t.id_tarima AND ds.id_producto = p.id_producto), 0)
         ) > 0
         ORDER BY t.id_tarima, p.id_producto`
      ),
      p.request().query<{
        id: string;
        tipo: "ENTRADA" | "SALIDA" | "REUBICACION";
        folio: string;
        fecha_hora: Date;
        resumen: string;
        tarimaCodigo: string | null;
        ubicacionDestino: string | null;
      }>(
        `SELECT TOP 30 *
         FROM (
           SELECT
             CONCAT('ent-', e.id_entrada) AS id,
             'ENTRADA' AS tipo,
             e.folio_entrada AS folio,
             e.fecha_hora_entrada AS fecha_hora,
             CONCAT(te.codigo_tipo, ': +', SUM(de.cantidad_ingresada), ' pzas de ', MAX(p.sku), ' en ', COUNT(DISTINCT de.id_tarima), ' tarima(s)') AS resumen,
             MIN(t.codigo_tarima) AS tarimaCodigo,
             MIN(u.codigo_ubicacion) AS ubicacionDestino
           FROM ENTRADA_ALMACEN e
           INNER JOIN TIPO_ENTRADA te ON te.id_tipo_entrada = e.id_tipo_entrada
           INNER JOIN DETALLE_ENTRADA de ON de.id_entrada = e.id_entrada
           INNER JOIN PRODUCTO p ON p.id_producto = de.id_producto
           INNER JOIN TARIMA t ON t.id_tarima = de.id_tarima
           LEFT JOIN UBICACION u ON u.id_ubicacion = t.id_ubicacion
           GROUP BY e.id_entrada, e.folio_entrada, e.fecha_hora_entrada, te.codigo_tipo

           UNION ALL

           SELECT
             CONCAT('sal-', s.id_salida) AS id,
             'SALIDA' AS tipo,
             s.folio_salida AS folio,
             s.fecha_hora_salida AS fecha_hora,
             CONCAT(ts.codigo_tipo, ': -', SUM(ds.cantidad_salida), ' pzas de ', MAX(p.sku)) AS resumen,
             MIN(t.codigo_tarima) AS tarimaCodigo,
             MIN(u.codigo_ubicacion) AS ubicacionDestino
           FROM SALIDA_ALMACEN s
           INNER JOIN TIPO_SALIDA ts ON ts.id_tipo_salida = s.id_tipo_salida
           INNER JOIN DETALLE_SALIDA ds ON ds.id_salida = s.id_salida
           INNER JOIN PRODUCTO p ON p.id_producto = ds.id_producto
           INNER JOIN TARIMA t ON t.id_tarima = ds.id_tarima
           LEFT JOIN UBICACION u ON u.id_ubicacion = t.id_ubicacion
           GROUP BY s.id_salida, s.folio_salida, s.fecha_hora_salida, ts.codigo_tipo

           UNION ALL

           SELECT
             CONCAT('reu-', r.id_reubicacion) AS id,
             'REUBICACION' AS tipo,
             r.folio_reubicacion AS folio,
             r.fecha_hora_reubicacion AS fecha_hora,
             CONCAT(t.codigo_tarima, ': ', ISNULL(uo.codigo_ubicacion, 'SIN UBICACIÓN'), ' → ', ISNULL(ud.codigo_ubicacion, 'LIBERADA (VACIA)')) AS resumen,
             t.codigo_tarima AS tarimaCodigo,
             ud.codigo_ubicacion AS ubicacionDestino
           FROM REUBICACION r
           INNER JOIN TARIMA t ON t.id_tarima = r.id_tarima
           LEFT JOIN UBICACION uo ON uo.id_ubicacion = r.id_ubicacion_origen
           LEFT JOIN UBICACION ud ON ud.id_ubicacion = r.id_ubicacion_destino
           WHERE r.folio_reubicacion NOT LIKE 'REU-E%'
             AND r.folio_reubicacion NOT LIKE 'REU-S%'
         ) ev
         ORDER BY ev.fecha_hora DESC`
      ),
      p.request().execute("sp_AlertaResurtidoMinimos"),
    ]);

    const itemsByTarima = new Map<number, TarimaInventoryItem[]>();
    for (const row of invRes.recordset) {
      const list = itemsByTarima.get(row.id_tarima) ?? [];
      list.push({
        id_producto: row.id_producto,
        sku: row.sku,
        nombre_descripcion: row.nombre_descripcion,
        codigo_cat: row.codigo_cat,
        nombre_categoria: row.nombre_categoria,
        codigo_mod: row.codigo_mod,
        nombre_modelo: row.nombre_modelo,
        codigo_col: row.codigo_col,
        nombre_color: row.nombre_color,
        cantidad: row.cantidad,
        peso_unitario_kg: row.peso_unitario_kg,
        peso_total_kg: round2(row.cantidad * row.peso_unitario_kg),
      });
      itemsByTarima.set(row.id_tarima, list);
    }

    const ubiMap = new Map(ubiRes.recordset.map((u) => [u.id_ubicacion, u]));

    const tarimas: TarimaState[] = tarRes.recordset.map((t) => {
      const ubi =
        t.id_ubicacion !== null ? ubiMap.get(t.id_ubicacion) : undefined;
      const items = itemsByTarima.get(t.id_tarima) ?? [];
      const total_piezas = items.reduce((sum, i) => sum + i.cantidad, 0);
      const peso_total_kg = round2(
        items.reduce((sum, i) => sum + i.peso_total_kg, 0)
      );

      return {
        id_tarima: t.id_tarima,
        codigo_tarima: t.codigo_tarima,
        estatus_tarima: t.estatus_tarima,
        id_ubicacion: t.id_ubicacion,
        codigo_ubicacion: ubi?.codigo_ubicacion ?? null,
        codigo_zona: ubi?.codigo_zona ?? null,
        codigo_soporte: ubi?.codigo_soporte ?? null,
        capacidad_max_kg: ubi?.capacidad_max_kg ?? null,
        items,
        total_piezas,
        peso_total_kg,
      };
    });

    const tarimaByUbi = new Map<number, TarimaState>();
    for (const tar of tarimas) {
      if (tar.id_ubicacion !== null) {
        tarimaByUbi.set(tar.id_ubicacion, tar);
      }
    }

    const ubicaciones: UbicacionState[] = ubiRes.recordset.map((u) => ({
      ...u,
      activa: Boolean(u.activa),
      tarima: tarimaByUbi.get(u.id_ubicacion) ?? null,
      position3d: getUbicacionPosition3d(u.codigo_ubicacion),
    }));

    const responsables: ResponsableAlmacen[] = respRes.recordset.map((r) => ({
      ...r,
      activo: Boolean(r.activo),
    }));

    const recentEvents: WmsTimelineEvent[] = eventsRes.recordset.map((ev) => ({
      id: ev.id,
      tipo: ev.tipo,
      folio: ev.folio,
      fecha_hora: formatSqlDate(ev.fecha_hora),
      resumen: ev.resumen,
      tarimaCodigo: ev.tarimaCodigo ?? undefined,
      ubicacionDestino: ev.ubicacionDestino,
    }));

    const totalPiezas = tarimas.reduce((sum, t) => sum + t.total_piezas, 0);
    const tarimasActivas = tarimas.filter(
      (t) => t.estatus_tarima !== "VACIA"
    ).length;

    return {
      source: "sqlserver",
      categorias: catRes.recordset,
      modelos: modRes.recordset,
      colores: colRes.recordset,
      productos: prodRes.recordset,
      zonas: zonaRes.recordset,
      tiposSoporte: sopRes.recordset,
      responsables,
      tiposEntrada: tEntRes.recordset,
      tiposSalida: tSalRes.recordset,
      clientes: cliRes.recordset,
      transportistas: transRes.recordset,
      ubicaciones,
      tarimas,
      recentEvents,
      stats: {
        totalPiezas,
        tarimasActivas,
        tarimasVacias: tarimas.length - tarimasActivas,
        ubicacionesOcupadas: ubicaciones.filter((u) => u.tarima !== null)
          .length,
        ubicacionesTotales: ubicaciones.length,
        alertasMinimoCount: alertasRes.recordset.length,
      },
    };
  });
}

export async function getBootstrapData(): Promise<WmsBootstrapData> {
  const activePool = await getActivePool(false);
  if (activePool) {
    try {
      return await fetchBootstrapSql(activePool);
    } catch (err) {
      if (!isConnectionError(err)) throw err;
    }
  }
  return serverMemoryEngine.getSnapshot("memory");
}

function escapeSqlText(value: string): string {
  return value.replace(/'/g, "''");
}

export async function executeRegistrarEntrada(
  req: RegistrarEntradaRequest
): Promise<OperationResult> {
  const activePool = await getActivePool(false);
  if (!activePool) {
    return serverMemoryEngine.registrarEntrada(req, "memory");
  }

  try {
    return await runSqlQuery(activePool, async (p) => {
      const dt = toSqlDateTime(req.fecha_hora_entrada);
      const request = p.request();
      request.input("folio_entrada", sql.VarChar(30), req.folio_entrada.trim());
      request.input("fecha_hora_entrada", sql.DateTime, dt);
      request.input(
        "id_responsable_almacen",
        sql.Int,
        req.id_responsable_almacen
      );
      request.input("id_tipo_entrada", sql.Int, req.id_tipo_entrada);
      request.input("id_producto", sql.Int, req.id_producto);
      request.input("cantidad_total", sql.Int, req.cantidad_total);
      await request.execute("sp_RegistrarEntrada");

      const infoRes = await p
        .request()
        .input("folio", sql.VarChar(30), req.folio_entrada.trim())
        .query<{
          id_tarima: number;
          codigo_tarima: string;
          id_ubicacion: number | null;
          codigo_ubicacion: string | null;
        }>(
          `SELECT t.id_tarima, t.codigo_tarima, t.id_ubicacion, u.codigo_ubicacion
           FROM ENTRADA_ALMACEN e
           INNER JOIN DETALLE_ENTRADA de ON de.id_entrada = e.id_entrada
           INNER JOIN TARIMA t ON t.id_tarima = de.id_tarima
           LEFT JOIN UBICACION u ON u.id_ubicacion = t.id_ubicacion
           WHERE e.folio_entrada = @folio
           ORDER BY de.id_detalle_entrada`
        );

      const affectedTarimaIds = infoRes.recordset.map((r) => r.id_tarima);
      const affectedUbicacionIds = infoRes.recordset
        .map((r) => r.id_ubicacion)
        .filter((id): id is number => id !== null);
      const first = infoRes.recordset[0];
      const snapshot = await fetchBootstrapSql(p);
      const fechaStr = formatSqlDate(dt);

      return {
        ok: true,
        message: `Entrada ${req.folio_entrada.trim()} registrada en SQL Server (${affectedTarimaIds.length} tarima(s)).`,
        sqlCommand: `EXEC sp_RegistrarEntrada @folio_entrada='${escapeSqlText(
          req.folio_entrada.trim()
        )}', @fecha_hora_entrada='${fechaStr}', @id_responsable_almacen=${
          req.id_responsable_almacen
        }, @id_tipo_entrada=${req.id_tipo_entrada}, @id_producto=${
          req.id_producto
        }, @cantidad_total=${req.cantidad_total};`,
        affectedTarimaIds,
        affectedUbicacionIds,
        focusUbicacionCodigo: first?.codigo_ubicacion ?? null,
        focusTarimaCodigo: first?.codigo_tarima ?? null,
        snapshot,
      };
    });
  } catch (err) {
    if (isConnectionError(err)) {
      return serverMemoryEngine.registrarEntrada(req, "memory");
    }
    throw err;
  }
}

export async function executeRegistrarSalida(
  req: RegistrarSalidaRequest
): Promise<OperationResult> {
  const activePool = await getActivePool(false);
  if (!activePool) {
    return serverMemoryEngine.registrarSalida(req, "memory");
  }

  try {
    return await runSqlQuery(activePool, async (p) => {
      const dt = toSqlDateTime(req.fecha_hora_salida);
      const request = p.request();
      request.input("folio_salida", sql.VarChar(30), req.folio_salida.trim());
      request.input("fecha_hora_salida", sql.DateTime, dt);
      request.input("id_tipo_salida", sql.Int, req.id_tipo_salida);
      request.input("id_cliente", sql.Int, req.id_cliente);
      request.input("id_transportista", sql.Int, req.id_transportista);
      request.input(
        "id_responsable_almacen",
        sql.Int,
        req.id_responsable_almacen
      );
      request.input("id_producto", sql.Int, req.id_producto);
      request.input("cantidad_total", sql.Int, req.cantidad_total);
      await request.execute("sp_RegistrarSalida");

      const detRes = await p
        .request()
        .input("folio", sql.VarChar(30), req.folio_salida.trim())
        .query<{
          id_salida: number;
          id_tarima: number;
          codigo_tarima: string;
          id_ubicacion: number | null;
          codigo_ubicacion: string | null;
          estatus_tarima: string;
        }>(
          `SELECT s.id_salida, t.id_tarima, t.codigo_tarima, t.id_ubicacion, u.codigo_ubicacion, t.estatus_tarima
           FROM SALIDA_ALMACEN s
           INNER JOIN DETALLE_SALIDA ds ON ds.id_salida = s.id_salida
           INNER JOIN TARIMA t ON t.id_tarima = ds.id_tarima
           LEFT JOIN UBICACION u ON u.id_ubicacion = t.id_ubicacion
           WHERE s.folio_salida = @folio
           ORDER BY ds.id_detalle_salida`
        );

      const idSalida = detRes.recordset[0]?.id_salida;
      const reuRes = idSalida
        ? await p
            .request()
            .input("prefix", sql.VarChar(40), `REU-S${idSalida}-%`)
            .query<{
              id_ubicacion_origen: number | null;
              id_ubicacion_destino: number | null;
              codigo_origen: string | null;
              codigo_destino: string | null;
            }>(
              `SELECT r.id_ubicacion_origen, r.id_ubicacion_destino,
                      uo.codigo_ubicacion AS codigo_origen,
                      ud.codigo_ubicacion AS codigo_destino
               FROM REUBICACION r
               LEFT JOIN UBICACION uo ON uo.id_ubicacion = r.id_ubicacion_origen
               LEFT JOIN UBICACION ud ON ud.id_ubicacion = r.id_ubicacion_destino
               WHERE r.folio_reubicacion LIKE @prefix
               ORDER BY r.id_reubicacion`
            )
        : { recordset: [] };

      const affectedTarimaIds = detRes.recordset.map((r) => r.id_tarima);
      const ubiSet = new Set<number>();
      let stagingCodigo: string | null = null;
      for (const r of reuRes.recordset) {
        if (r.id_ubicacion_origen) ubiSet.add(r.id_ubicacion_origen);
        if (r.id_ubicacion_destino) ubiSet.add(r.id_ubicacion_destino);
        if (r.codigo_destino?.startsWith("STAG-")) {
          stagingCodigo = r.codigo_destino;
        }
      }

      const returned = detRes.recordset.find(
        (r) => r.estatus_tarima === "EN_ALMACEN" && r.codigo_ubicacion
      );
      const snapshot = await fetchBootstrapSql(p);
      const fechaStr = formatSqlDate(dt);

      return {
        ok: true,
        message: `Salida ${req.folio_salida.trim()} ejecutada en SQL Server (${req.cantidad_total} pzas).`,
        sqlCommand: `EXEC sp_RegistrarSalida @folio_salida='${escapeSqlText(
          req.folio_salida.trim()
        )}', @fecha_hora_salida='${fechaStr}', @id_tipo_salida=${
          req.id_tipo_salida
        }, @id_cliente=${req.id_cliente}, @id_transportista=${
          req.id_transportista
        }, @id_responsable_almacen=${
          req.id_responsable_almacen
        }, @id_producto=${req.id_producto}, @cantidad_total=${
          req.cantidad_total
        };`,
        affectedTarimaIds,
        affectedUbicacionIds: Array.from(ubiSet),
        focusUbicacionCodigo: returned?.codigo_ubicacion ?? stagingCodigo,
        focusTarimaCodigo: returned?.codigo_tarima ?? null,
        snapshot,
      };
    });
  } catch (err) {
    if (isConnectionError(err)) {
      return serverMemoryEngine.registrarSalida(req, "memory");
    }
    throw err;
  }
}

export async function executeRegistrarReubicacion(
  req: RegistrarReubicacionRequest
): Promise<OperationResult> {
  const activePool = await getActivePool(false);
  if (!activePool) {
    return serverMemoryEngine.registrarReubicacion(req, "memory");
  }

  try {
    return await runSqlQuery(activePool, async (p) => {
      const dt = toSqlDateTime(req.fecha_hora_reubicacion);
      const request = p.request();
      request.input(
        "folio_reubicacion",
        sql.VarChar(30),
        req.folio_reubicacion.trim()
      );
      request.input("fecha_hora_reubicacion", sql.DateTime, dt);
      request.input(
        "id_ubicacion_destino",
        sql.Int,
        req.id_ubicacion_destino ?? null
      );
      request.input("id_tarima", sql.Int, req.id_tarima);
      request.input(
        "id_responsable_almacen",
        sql.Int,
        req.id_responsable_almacen
      );
      await request.execute("sp_RegistrarReubicacion");

      const reuRes = await p
        .request()
        .input("folio", sql.VarChar(30), req.folio_reubicacion.trim())
        .query<{
          id_ubicacion_origen: number | null;
          id_ubicacion_destino: number | null;
          codigo_origen: string | null;
          codigo_destino: string | null;
          codigo_tarima: string;
        }>(
          `SELECT r.id_ubicacion_origen, r.id_ubicacion_destino,
                  uo.codigo_ubicacion AS codigo_origen,
                  ud.codigo_ubicacion AS codigo_destino,
                  t.codigo_tarima
           FROM REUBICACION r
           INNER JOIN TARIMA t ON t.id_tarima = r.id_tarima
           LEFT JOIN UBICACION uo ON uo.id_ubicacion = r.id_ubicacion_origen
           LEFT JOIN UBICACION ud ON ud.id_ubicacion = r.id_ubicacion_destino
           WHERE r.folio_reubicacion = @folio`
        );

      const row = reuRes.recordset[0];
      const affectedUbicacionIds: number[] = [];
      if (row?.id_ubicacion_origen)
        affectedUbicacionIds.push(row.id_ubicacion_origen);
      if (row?.id_ubicacion_destino)
        affectedUbicacionIds.push(row.id_ubicacion_destino);

      const snapshot = await fetchBootstrapSql(p);
      const fechaStr = formatSqlDate(dt);
      const destSql =
        req.id_ubicacion_destino === null
          ? "NULL"
          : String(req.id_ubicacion_destino);

      return {
        ok: true,
        message: `Reubicación ${req.folio_reubicacion.trim()} ejecutada en SQL Server.`,
        sqlCommand: `EXEC sp_RegistrarReubicacion @folio_reubicacion='${escapeSqlText(
          req.folio_reubicacion.trim()
        )}', @fecha_hora_reubicacion='${fechaStr}', @id_ubicacion_destino=${destSql}, @id_tarima=${
          req.id_tarima
        }, @id_responsable_almacen=${req.id_responsable_almacen};`,
        affectedTarimaIds: [req.id_tarima],
        affectedUbicacionIds,
        focusUbicacionCodigo: row?.codigo_destino ?? row?.codigo_origen ?? null,
        focusTarimaCodigo:
          req.id_ubicacion_destino !== null
            ? (row?.codigo_tarima ?? null)
            : null,
        snapshot,
      };
    });
  } catch (err) {
    if (isConnectionError(err)) {
      return serverMemoryEngine.registrarReubicacion(req, "memory");
    }
    throw err;
  }
}

export async function queryExistencias(
  codigo_zona?: string,
  codigo_cat?: string
): Promise<ExistenciaRow[]> {
  const activePool = await getActivePool(false);
  if (!activePool) {
    return serverMemoryEngine.consultarExistencias(codigo_zona, codigo_cat);
  }

  try {
    return await runSqlQuery(activePool, async (p) => {
      const request = p.request();
      request.input("codigo_zona", sql.VarChar(20), codigo_zona || null);
      request.input("codigo_cat", sql.VarChar(10), codigo_cat || null);
      const [spRes, ubiRes, tarRes, prodRes] = await Promise.all([
        request.execute<Record<string, unknown>>("sp_ConsultarExistencias"),
        p
          .request()
          .query<{ id_ubicacion: number; codigo_ubicacion: string }>(
            "SELECT id_ubicacion, codigo_ubicacion FROM UBICACION"
          ),
        p
          .request()
          .query<{ id_tarima: number; codigo_tarima: string }>(
            "SELECT id_tarima, codigo_tarima FROM TARIMA"
          ),
        p.request().query<{ sku: string; codigo_cat: CategoriaCodigo }>(
          `SELECT p.sku, c.codigo_cat
           FROM PRODUCTO p
           INNER JOIN CATEGORIA_PRODUCTO c ON c.id_categoria = p.id_categoria`
        ),
      ]);

      const ubiIdByCode = new Map(
        ubiRes.recordset.map((u) => [u.codigo_ubicacion, u.id_ubicacion])
      );
      const tarIdByCode = new Map(
        tarRes.recordset.map((t) => [t.codigo_tarima, t.id_tarima])
      );
      const catBySku = new Map(
        prodRes.recordset.map((pr) => [pr.sku, pr.codigo_cat])
      );

      return spRes.recordset.map((r) => {
        const sku = String(r["SKU"] ?? "");
        const ubicacion = String(r["Ubicación"] ?? "");
        const tarima = String(r["Tarima"] ?? "");
        return {
          sku,
          descripcion: String(r["Descripción"] ?? ""),
          categoria: String(r["Categoría"] ?? ""),
          codigo_cat: catBySku.get(sku) ?? "CEL",
          zona: String(r["Zona"] ?? "Z-ALM") as ZonaCodigo,
          ubicacion,
          tarima,
          soporte: String(r["Soporte"] ?? ""),
          existenciaPiezas: Number(r["Existencia Piezas"] ?? 0),
          pesoTotalTarimaKg: Number(r["Peso Total Tarima (kg)"] ?? 0),
          capacidadMaxSoporteKg: Number(r["Capacidad Máx Soporte (kg)"] ?? 0),
          id_ubicacion: ubiIdByCode.get(ubicacion) ?? 0,
          id_tarima: tarIdByCode.get(tarima) ?? 0,
        };
      });
    });
  } catch (err) {
    if (isConnectionError(err)) {
      return serverMemoryEngine.consultarExistencias(codigo_zona, codigo_cat);
    }
    throw err;
  }
}

export async function queryAlertasMinimos(): Promise<AlertaMinimoRow[]> {
  const activePool = await getActivePool(false);
  if (!activePool) {
    return serverMemoryEngine.alertaResurtidoMinimos();
  }

  try {
    return await runSqlQuery(activePool, async (p) => {
      const res = await p
        .request()
        .execute<Record<string, unknown>>("sp_AlertaResurtidoMinimos");
      return res.recordset.map((r) => ({
        sku: String(r["SKU"] ?? ""),
        producto: String(r["Producto"] ?? ""),
        categoria: String(r["Categoría"] ?? ""),
        stockMinimo: Number(r["Stock Mínimo"] ?? 0),
        stockIdeal: Number(r["Stock Ideal"] ?? 0),
        existenciaActual: Number(r["Existencia Actual"] ?? 0),
        sugerenciaFabricacionPiezas: Number(
          r["Sugerencia Fabricación (Piezas)"] ?? 0
        ),
        costoEstimadoProduccion: Number(
          r["Costo Estimado Producción ($)"] ?? 0
        ),
      }));
    });
  } catch (err) {
    if (isConnectionError(err)) {
      return serverMemoryEngine.alertaResurtidoMinimos();
    }
    throw err;
  }
}

export async function queryRotacion(
  fechaInicio?: string,
  fechaFin?: string
): Promise<RotacionRow[]> {
  const activePool = await getActivePool(false);
  if (!activePool) {
    return serverMemoryEngine.rotacionInventario(fechaInicio, fechaFin);
  }

  try {
    return await runSqlQuery(activePool, async (p) => {
      const request = p.request();
      if (fechaInicio) {
        request.input("fecha_inicio", sql.DateTime, toSqlDateTime(fechaInicio, false));
      }
      if (fechaFin) {
        request.input("fecha_fin", sql.DateTime, toSqlDateTime(fechaFin, true));
      }
      const res = await request.execute<Record<string, unknown>>(
        "sp_RotacionInventario"
      );
      return res.recordset.map((r) => ({
        sku: String(r["SKU"] ?? ""),
        producto: String(r["Producto"] ?? ""),
        categoria: String(r["Categoría"] ?? ""),
        unidadesVendidas: Number(r["Unidades Vendidas"] ?? 0),
        precioUnitarioVenta: Number(r["Precio Unitario Venta ($)"] ?? 0),
        importeTotalVenta: Number(r["Importe Total Venta ($)"] ?? 0),
        margenBrutoTotal: Number(r["Margen Bruto Total ($)"] ?? 0),
        numeroPedidosSurtidos: Number(r["Número de Pedidos Surtidos"] ?? 0),
      }));
    });
  } catch (err) {
    if (isConnectionError(err)) {
      return serverMemoryEngine.rotacionInventario(fechaInicio, fechaFin);
    }
    throw err;
  }
}

export async function queryValorInventario(
  fechaCorte?: string
): Promise<ValorInventarioRow[]> {
  const activePool = await getActivePool(false);
  if (!activePool) {
    return serverMemoryEngine.valorInventarioFecha(fechaCorte);
  }

  try {
    return await runSqlQuery(activePool, async (p) => {
      const request = p.request();
      if (fechaCorte) {
        request.input("fecha_corte", sql.DateTime, toSqlDateTime(fechaCorte, true));
      }
      const res = await request.execute<Record<string, unknown>>(
        "sp_ValorInventarioFecha"
      );
      return res.recordset.map((r) => ({
        sku: String(r["SKU"] ?? ""),
        producto: String(r["Producto"] ?? ""),
        categoria: String(r["Categoría"] ?? ""),
        costoUnitario: Number(r["Costo Unitario ($)"] ?? 0),
        existenciaFechaCorte: Number(r["Existencia a Fecha Corte"] ?? 0),
        valorTotalInventario: Number(r["Valor Total Inventario ($)"] ?? 0),
      }));
    });
  } catch (err) {
    if (isConnectionError(err)) {
      return serverMemoryEngine.valorInventarioFecha(fechaCorte);
    }
    throw err;
  }
}

export async function querySinMovimiento(
  fechaInicio?: string,
  fechaFin?: string
): Promise<SinMovimientoRow[]> {
  const activePool = await getActivePool(false);
  if (!activePool) {
    return serverMemoryEngine.productosSinMovimiento(fechaInicio, fechaFin);
  }

  try {
    return await runSqlQuery(activePool, async (p) => {
      const request = p.request();
      if (fechaInicio) {
        request.input("fecha_inicio", sql.DateTime, toSqlDateTime(fechaInicio, false));
      }
      if (fechaFin) {
        request.input("fecha_fin", sql.DateTime, toSqlDateTime(fechaFin, true));
      }
      const res = await request.execute<Record<string, unknown>>(
        "sp_ProductosSinMovimiento"
      );
      return res.recordset.map((r) => ({
        sku: String(r["SKU"] ?? ""),
        producto: String(r["Producto"] ?? ""),
        categoria: String(r["Categoría"] ?? ""),
        existenciaActualAlmacen: Number(r["Existencia Actual Almacén"] ?? 0),
        capitalInmovilizado: Number(r["Capital Inmovilizado ($)"] ?? 0),
      }));
    });
  } catch (err) {
    if (isConnectionError(err)) {
      return serverMemoryEngine.productosSinMovimiento(fechaInicio, fechaFin);
    }
    throw err;
  }
}

export async function queryKardex(sku: string): Promise<KardexRow[]> {
  if (!sku.trim()) {
    throw new SqlValidationError("Debe especificar un SKU para consultar el Kardex.");
  }

  const activePool = await getActivePool(false);
  if (!activePool) {
    return serverMemoryEngine.kardexArticulo(sku);
  }

  try {
    return await runSqlQuery(activePool, async (p) => {
      const res = await p
        .request()
        .input("sku", sql.VarChar(50), sku.trim())
        .execute<Record<string, unknown>>("sp_KardexArticulo");

      return res.recordset.map((r) => ({
        fechaHora: formatSqlDate(r["Fecha y Hora"]),
        operacion: String(r["Operación"] ?? ""),
        folioDocumento: String(r["Folio Documento"] ?? ""),
        codigoTarima: String(r["Tarima Afectada"] ?? ""),
        responsable: String(r["Responsable"] ?? ""),
        entrada: Number(r["Entrada (+)"] ?? 0),
        salida: Number(r["Salida (-)"] ?? 0),
        saldoAcumulado: Number(r["Saldo Acumulado (Piezas)"] ?? 0),
      }));
    });
  } catch (err) {
    if (isConnectionError(err)) {
      return serverMemoryEngine.kardexArticulo(sku);
    }
    throw err;
  }
}
