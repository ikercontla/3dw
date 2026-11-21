# TAYO WMS · 3D Warehouse

Demo web interactiva en 3D del Centro de Distribución (CEDIS) de **TAYO**, construida con **Vite, React, TypeScript, Three.js (`@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`)** y **Express**.

Representa fielmente el esquema relacional `TAYO_WMS`:
- **42 ubicaciones físicas** en `Z-ALM` (Pasillos A y B en Piso Nivel 0 y Racks Niveles 1 y 2) y `Z-STAG` (6 bahías de pre-embarque).
- **30 tarimas** (`TAR-001` a `TAR-030`) con control de estatus (`VACIA`, `EN_ALMACEN`, `EN_STAGING`) y capacidad máxima por soporte (`1,000 kg` en Rack para `CEL`/`LAM`, `2,500 kg` en Piso para `MES`/`MAC`).
- **44 SKUs** en 4 categorías (`CEL`, `MES`, `LAM`, `MAC`), 4 modelos (`HEX`, `BRU`, `CIL`, `REC`) y 4 colores minerales (`GN`, `BL`, `TC`, `NG`).
- **5 transportistas** en los andenes exteriores y **5 operadores activos** en montacargas.

---

## Requisitos

- **Node.js** 18 o superior (probado en Node 24)
- **npm**
- *(Opcional)* **SQL Server** con la base `TAYO_WMS` cargada si deseas ejecutar los Stored Procedures en vivo

---

## Cómo correrlo sin base de datos (Motor en Memoria)

No necesitas instalar ni conectar SQL Server. El proyecto incluye un motor determinista en TypeScript (`src/data/tayoEngine.ts`) que replica las reglas de negocio, los procedimientos almacenados y las 120 operaciones de simulación de Mayo a Octubre 2026.

```bash
npm install
npm run dev
```

Abre `http://localhost:5173/` en tu navegador:
- `npm run dev` levanta el cliente Vite (`5173`) y el servidor Express (`3001`). Sin archivo `.env` (o con SQL Server apagado), el sistema arranca automáticamente en modo **Motor en Memoria**.
- Si prefieres correr únicamente el frontend sin Express, ejecuta `npm run dev:client` (`wmsApi.ts` cambia automáticamente al motor en memoria dentro del navegador).
- En el drawer **Operaciones y Reportes SQL** dispones del botón **Reiniciar Simulación** para volver al cierre inicial de Octubre 2026 (`772` piezas en `22` tarimas activas, `8` vacías y `17` alertas de mínimo).

---

## Cómo conectarlo a SQL Server (`TAYO_WMS`)

1. Ejecuta en tu instancia de SQL Server los scripts del proyecto en orden:
   1. `creacion_tablas.sql`
   2. `sp_poblacion_catalogos.sql`
   3. `sp_operaciones_almacen.sql`
   4. `sp_consultas_reportes.sql`
   5. `simulacion_operaciones.sql`
2. Copia `.env.example` a `.env` y coloca tus credenciales locales:

```env
PORT=3001
DB_SERVER=localhost
DB_PORT=1433
DB_DATABASE=TAYO_WMS
DB_USER=sa
DB_PASSWORD=tu_password
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
```

3. Inicia con `npm run dev`. El indicador superior cambiará a **SQL Server Live** (también puedes reintentar la conexión o alternar a simulación local desde ese botón).

---

## Funcionalidades principales

- **Vistas Exterior e Interior**: Cambio de cámara con apertura de andenes y corte del techo y anexo de oficinas para inspeccionar el almacén por dentro.
- **Inspección 3D**: Haz clic en cualquier ubicación, tarima, zona (`Z-ALM`, `Z-STAG`), montacargas o camión para ver existencias, peso en kg vs capacidad del soporte, y accesos directos a Kardex o Reubicación.
- **Seguir Tarima (Recorrido en 5 etapas)**: Animación y seguimiento de cámara a través de `01 Entrada` -> `02 Acomodo Z-ALM` -> `03 Slotting` -> `04 Staging Z-STAG` -> `05 Despacho`, con velocidades `1×` / `2×` / `4×` / `8×`, pausa y selector de calidad `High` / `Balanced`.
- **Drawer Operaciones y Reportes SQL**:
  - **Operaciones**: Formularios para `sp_RegistrarEntrada`, `sp_RegistrarSalida` y `sp_RegistrarReubicacion` con previsualización de soporte/tarimas y comando `EXEC sp_...` generado.
  - **Reportes Analíticos**: Pestañas para `sp_ConsultarExistencias` (con clic en fila para enfocar en 3D), `sp_AlertaResurtidoMinimos`, `sp_RotacionInventario`, `sp_ValorInventarioFecha`, `sp_ProductosSinMovimiento` y `sp_KardexArticulo`.

### Atajos de teclado

- `Space`: Pausar o reanudar animaciones
- `←` / `→`: Retroceder o avanzar etapa del recorrido en vista Interior
- `Esc`: Cerrar el drawer o limpiar la selección actual

---

## Modelos 3D de productos (`public/models/`)

Actualmente las tarimas muestran placeholders geométricos simples tintados con el color mineral de cada SKU (`GN`, `BL`, `TC`, `NG`).

Para reemplazarlos por modelos `.glb` o `.gltf` definitivos:
1. Coloca los archivos dentro de `public/models/` (por ejemplo `/models/celosia.glb`).
2. Registra las rutas en `MODEL_REGISTRY` o `MODEL_VARIANT_REGISTRY` dentro de `src/components/TayoProductMeshes.tsx`.

---

## Scripts disponibles

- `npm run dev`: Inicia Vite (`5173`) y Express (`3001`) en paralelo.
- `npm run dev:client`: Inicia solo el frontend Vite.
- `npm run dev:server`: Inicia solo el servidor Express con `tsx watch`.
- `npm run typecheck`: Verifica tipos con `tsc --noEmit`.
- `npm run build`: Verifica tipos y genera el bundle de producción en `dist/`.
- `npm run preview`: Sirve el build de producción localmente.

---

## Estructura del proyecto

```text
3dw/
├── public/models/         # Modelos .glb/.gltf futuros de productos TAYO
├── server/
│   ├── db.ts              # Conexión mssql a TAYO_WMS + fallback en memoria
│   └── index.ts           # API REST Express (/api/wms/*)
├── src/
│   ├── components/        # Escena 3D (R3F), vehículos, HUD y drawer SQL
│   ├── data/              # Catálogos, coordenadas 3D y motor TAYO_WMS
│   ├── services/          # Cliente Dual Mode (wmsApi.ts)
│   └── types/             # Contrato compartido TypeScript (wms.ts)
├── .env.example
├── package.json
└── vite.config.ts
```
