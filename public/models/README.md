# Modelos 3D de Productos TAYO

Coloca aquí los archivos `.glb` o `.gltf` definitivos cuando estén listos y regístralos en `src/components/TayoProductMeshes.tsx` (`MODEL_REGISTRY`):

- `CEL` (Celosías): ej. `/models/celosia.glb`
- `MES` (Mesas): ej. `/models/mesa.glb`
- `LAM` (Lámparas): ej. `/models/lampara.glb`
- `MAC` (Macetas): ej. `/models/maceta.glb`

Mientras `MODEL_REGISTRY` tenga `null` para una categoría o modelo, `TayoProductMeshes.tsx` renderiza automáticamente el placeholder geométrico sencillo tintado con el pigmento mineral real (`GN`, `BL`, `TC`, `NG`).
