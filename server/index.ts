import cors from "cors";
import express, { type Request, type Response } from "express";
import {
  executeRegistrarEntrada,
  executeRegistrarReubicacion,
  executeRegistrarSalida,
  getBootstrapData,
  getWmsStatus,
  initDb,
  queryAlertasMinimos,
  queryExistencias,
  queryKardex,
  queryRotacion,
  querySinMovimiento,
  queryValorInventario,
  serverMemoryEngine,
  SqlValidationError,
} from "./db";
import type {
  RegistrarEntradaRequest,
  RegistrarReubicacionRequest,
  RegistrarSalidaRequest,
} from "../src/types/wms";

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json());

function handleError(res: Response, err: unknown): void {
  const message =
    err instanceof Error ? err.message : "Error desconocido en el servidor.";
  const status =
    err instanceof SqlValidationError ? err.statusCode : 400;
  res.status(status).json({ error: message });
}

function queryStr(val: unknown): string | undefined {
  if (typeof val === "string") {
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

app.get("/api/wms/status", async (req: Request, res: Response) => {
  try {
    const retry =
      req.query.retry === "1" || req.query.retry === "true";
    const status = await getWmsStatus(retry);
    res.json(status);
  } catch (err) {
    handleError(res, err);
  }
});

app.get("/api/wms/bootstrap", async (_req: Request, res: Response) => {
  try {
    const data = await getBootstrapData();
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

app.post("/api/wms/reset", async (_req: Request, res: Response) => {
  try {
    const status = await getWmsStatus(false);
    if (status.mode === "sqlserver" && status.sqlConnected) {
      res.status(400).json({
        error:
          "El reinicio rápido sólo aplica en Modo Motor en Memoria (SQL Server Live mantiene persistencia real).",
      });
      return;
    }
    serverMemoryEngine.reset(true);
    res.json(serverMemoryEngine.getSnapshot("memory"));
  } catch (err) {
    handleError(res, err);
  }
});

app.post("/api/wms/entrada", async (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<RegistrarEntradaRequest>;
    if (
      !body ||
      typeof body.folio_entrada !== "string" ||
      !body.id_responsable_almacen ||
      !body.id_tipo_entrada ||
      !body.id_producto ||
      body.cantidad_total === undefined
    ) {
      res.status(400).json({
        error:
          "Faltan parámetros requeridos para sp_RegistrarEntrada (folio, responsable, tipo, producto, cantidad).",
      });
      return;
    }

    const payload: RegistrarEntradaRequest = {
      folio_entrada: body.folio_entrada,
      fecha_hora_entrada:
        typeof body.fecha_hora_entrada === "string"
          ? body.fecha_hora_entrada
          : "",
      id_responsable_almacen: Number(body.id_responsable_almacen),
      id_tipo_entrada: Number(body.id_tipo_entrada),
      id_producto: Number(body.id_producto),
      cantidad_total: Number(body.cantidad_total),
    };

    const result = await executeRegistrarEntrada(payload);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

app.post("/api/wms/salida", async (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<RegistrarSalidaRequest>;
    if (
      !body ||
      typeof body.folio_salida !== "string" ||
      !body.id_tipo_salida ||
      !body.id_cliente ||
      !body.id_transportista ||
      !body.id_responsable_almacen ||
      !body.id_producto ||
      body.cantidad_total === undefined
    ) {
      res.status(400).json({
        error:
          "Faltan parámetros requeridos para sp_RegistrarSalida (folio, tipo, cliente, transportista, responsable, producto, cantidad).",
      });
      return;
    }

    const payload: RegistrarSalidaRequest = {
      folio_salida: body.folio_salida,
      fecha_hora_salida:
        typeof body.fecha_hora_salida === "string"
          ? body.fecha_hora_salida
          : "",
      id_tipo_salida: Number(body.id_tipo_salida),
      id_cliente: Number(body.id_cliente),
      id_transportista: Number(body.id_transportista),
      id_responsable_almacen: Number(body.id_responsable_almacen),
      id_producto: Number(body.id_producto),
      cantidad_total: Number(body.cantidad_total),
    };

    const result = await executeRegistrarSalida(payload);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

app.post("/api/wms/reubicacion", async (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<RegistrarReubicacionRequest>;
    if (
      !body ||
      typeof body.folio_reubicacion !== "string" ||
      !body.id_tarima ||
      !body.id_responsable_almacen
    ) {
      res.status(400).json({
        error:
          "Faltan parámetros requeridos para sp_RegistrarReubicacion (folio, tarima, responsable).",
      });
      return;
    }

    const payload: RegistrarReubicacionRequest = {
      folio_reubicacion: body.folio_reubicacion,
      fecha_hora_reubicacion:
        typeof body.fecha_hora_reubicacion === "string"
          ? body.fecha_hora_reubicacion
          : "",
      id_ubicacion_destino:
        body.id_ubicacion_destino === null ||
        body.id_ubicacion_destino === undefined
          ? null
          : Number(body.id_ubicacion_destino),
      id_tarima: Number(body.id_tarima),
      id_responsable_almacen: Number(body.id_responsable_almacen),
    };

    const result = await executeRegistrarReubicacion(payload);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

app.get(
  "/api/wms/reportes/existencias",
  async (req: Request, res: Response) => {
    try {
      const codigo_zona = queryStr(req.query.codigo_zona);
      const codigo_cat = queryStr(req.query.codigo_cat);
      const rows = await queryExistencias(codigo_zona, codigo_cat);
      res.json(rows);
    } catch (err) {
      handleError(res, err);
    }
  }
);

app.get(
  "/api/wms/reportes/alertas-minimos",
  async (_req: Request, res: Response) => {
    try {
      const rows = await queryAlertasMinimos();
      res.json(rows);
    } catch (err) {
      handleError(res, err);
    }
  }
);

app.get("/api/wms/reportes/rotacion", async (req: Request, res: Response) => {
  try {
    const fechaInicio = queryStr(req.query.fecha_inicio);
    const fechaFin = queryStr(req.query.fecha_fin);
    const rows = await queryRotacion(fechaInicio, fechaFin);
    res.json(rows);
  } catch (err) {
    handleError(res, err);
  }
});

app.get(
  "/api/wms/reportes/valor-inventario",
  async (req: Request, res: Response) => {
    try {
      const fechaCorte = queryStr(req.query.fecha_corte);
      const rows = await queryValorInventario(fechaCorte);
      res.json(rows);
    } catch (err) {
      handleError(res, err);
    }
  }
);

app.get(
  "/api/wms/reportes/sin-movimiento",
  async (req: Request, res: Response) => {
    try {
      const fechaInicio = queryStr(req.query.fecha_inicio);
      const fechaFin = queryStr(req.query.fecha_fin);
      const rows = await querySinMovimiento(fechaInicio, fechaFin);
      res.json(rows);
    } catch (err) {
      handleError(res, err);
    }
  }
);

app.get("/api/wms/reportes/kardex", async (req: Request, res: Response) => {
  try {
    const sku = queryStr(req.query.sku) ?? "";
    const rows = await queryKardex(sku);
    res.json(rows);
  } catch (err) {
    handleError(res, err);
  }
});

void initDb(false).finally(() => {
  app.listen(PORT, () => {
    console.log(
      `[TAYO WMS] Servidor Express escuchando en http://localhost:${PORT}`
    );
  });
});
