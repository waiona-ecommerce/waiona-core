---
name: futura_implementacion_excel
description: "Plan completo para importar productos desde Excel — fases, estructura de columnas, validaciones y decisiones de diseño"
metadata: 
  node_type: memory
  type: project
  originSessionId: f81c705d-cc19-4c3b-9324-927db820865c
---

# Importación de Productos desde Excel

## Contexto
Permitir que un admin cargue un archivo `.xlsx` para crear productos en bulk, evitando la carga manual uno a uno.

**Why:** Operación frecuente cuando el catálogo es grande o viene de un proveedor externo.
**How to apply:** Implementar como endpoint nuevo en `products/product`, sin tocar la lógica existente de creación individual.

---

## Dependencias a instalar

```bash
npm install xlsx
npm install --save-dev @types/multer
```

`multer` ya viene incluido en `@nestjs/platform-express` — solo faltan los types y `xlsx`.

---

## Estructura del Excel esperado

**Primera fila = headers exactos (case insensitive al parsear):**

| Columna           | Tipo    | Requerido | Reglas                                      |
|-------------------|---------|-----------|---------------------------------------------|
| `SKU`             | string  | SI        | Único, 3–50 chars. Se normaliza a mayúsculas |
| `NAME`            | string  | SI        | 2–150 chars. Se normaliza a mayúsculas       |
| `DESCRIPTION`     | string  | SI        | 5–255 chars                                  |
| `CATEGORY_NAME`   | string  | SI        | Nombre exacto de la categoría (lookup en DB) |
| `MEASUREMENT_UNIT`| string  | SI        | Uno de: `unit` `kg` `gram` `liter` `ml` `meter` `cm` `pack` `box` `dozen` |
| `MEASUREMENT_VALUE`| number | NO        | Decimal >= 0. Requerido solo si la unidad no es `unit` |
| `IS_ACTIVE`       | boolean | NO        | `TRUE`/`FALSE` o `1`/`0`. Default: `true`   |

**Nota de diseño:** Se usa `CATEGORY_NAME` en vez de `CATEGORY_ID` porque el usuario no conoce los IDs internos. El service hace un bulk lookup previo de todas las categorías mencionadas en el archivo para evitar N queries.

---

## Fases de implementación

### Fase 1 — Parseo y validación del archivo
- Crear `src/modules/products/product/dto/import-product-row.dto.ts`  
  DTO plano (sin decoradores de class-validator, validación manual) que representa una fila parseada.
- Crear `src/modules/products/product/utils/excel-product.parser.ts`  
  Función que recibe el `Buffer` del archivo, usa `xlsx.read(buffer)`, itera las filas y devuelve `ImportProductRowDto[]`.
- El parser normaliza headers a mayúsculas y trim, convierte `IS_ACTIVE` a boolean, `MEASUREMENT_VALUE` a número.

### Fase 2 — Service: validación de negocio + persistencia
Agregar método `importFromExcel(rows: ImportProductRowDto[])` en `ProductService`:

1. Extraer todos los `CATEGORY_NAME` únicos del array.
2. Hacer **un solo query** `findBy({ name: In([...names]) })` en el repo de categorías.
3. Construir un `Map<categoryName, categoryId>`.
4. Por cada fila: validar campos + resolver `categoryId` desde el map.
5. Separar filas válidas de inválidas (no abortar todo).
6. Usar `dataSource.transaction()` para `repo.save(validRows)` en bulk.
7. Devolver `{ imported: number, errors: { row: number, sku: string, reason: string }[] }`.

### Fase 3 — Controller + FileInterceptor
Agregar endpoint en `ProductController`:

```typescript
@Post('import')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleType.ADMIN)
@UseInterceptors(FileInterceptor('file'))
importFromExcel(@UploadedFile() file: Express.Multer.File) {
  // validar mimetype, parsear, llamar service
}
```

- Aceptar solo `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` y `application/vnd.ms-excel`.
- El archivo queda **en memoria** (no se guarda en disco ni Cloudinary).
- Límite de tamaño: 5MB vía `limits: { fileSize: 5 * 1024 * 1024 }` en `FileInterceptor`.

### Fase 4 — Tests
- Unit test del parser: Excel con filas válidas, headers mal escritos, celdas vacías.
- Unit test del service method: mock de category repo, filas con errores mezcladas con válidas.
- Controller spec: mock del service, verificar que rechaza archivos no-Excel.

---

## Respuesta del endpoint

```json
{
  "imported": 42,
  "errors": [
    { "row": 3, "sku": "PROD-001", "reason": "Categoría 'Bebidas frias' no encontrada" },
    { "row": 7, "sku": "PROD-005", "reason": "SKU ya existe" }
  ]
}
```

---

## Decisiones de diseño tomadas

- **Modo permisivo**: filas con error se reportan, no abortan el import. Si querés modo estricto (todo o nada), envolver el bulk en una transacción única y hacer rollback si hay cualquier error.
- **Sin imágenes**: el Excel no carga imágenes — eso sigue siendo via el endpoint de `product-images` (Cloudinary).
- **Sin precios**: pricing es módulo separado — el import solo crea el producto base.
- **CATEGORY_NAME lookup**: bulk previo, no query por fila. Si el catálogo de categorías es chico (< 500), traer todas y filtrar en memoria es incluso más simple.
- **SKU duplicado**: detectar antes de intentar insertar, agregar al array de errores con reason clara.
