---
name: module-docs
description: >
  Generates two documentation files per module: a technical doc for developers and a business doc for non-technical leaders.
  Load when the user asks to document a module, create docs for a leader, or write module documentation.
metadata:
  author: @rodrigozucchini
  version: "1.0"
---

# Module Documentation Skill

Generates two complementary Markdown files for any module in this project. One targets developers (endpoints, types, agent skill compliance). The other targets non-technical leaders (plain language, business context, no code).

Both files go in `documentation/` at the project root.

---

## When to Use This Skill

Load when the user:
- Asks to document a module (`"documentame el módulo de taxes"`)
- Asks for a doc for the leader or a non-technical audience
- Creates a new module and needs both docs generated
- Updates an existing module and needs the docs refreshed

Do NOT load when:
- Writing inline code comments or JSDoc — use `nestjs-core`
- Generating API contracts for external consumers (Swagger/OpenAPI)
- Documenting infrastructure or deployment config

---

## Core Rules

1. **Two files, always**: Every module gets `{module}.md` (technical) and `{module}_negocio.md` (business). Never merge them into one.
2. **Business doc has zero code**: No TypeScript, no JSON, no HTTP methods, no status codes — plain Spanish only.
3. **Technical doc is tied to the actual code**: Read the entity, DTOs, service, and controller before writing. Never invent fields or endpoints.
4. **Save to `documentation/`**: Both files go in `/documentation/` at the project root.
5. **Spanish throughout**: Both documents are written in Spanish.

---

## Step-by-Step Process

**Step 1 — Read the module**
Read these files before writing anything:
- `src/modules/{module}/entities/{module}.entity.ts`
- `src/modules/{module}/dto/create-{module}.dto.ts`
- `src/modules/{module}/dto/update-{module}.dto.ts`
- `src/modules/{module}/dto/response-{module}.dto.ts`
- `src/modules/{module}/services/{module}.service.ts`
- `src/modules/{module}/controllers/{module}.controller.ts`

**Step 2 — Write the technical doc (`documentation/{module}.md`)**
Follow the Technical Doc Structure section below.

**Step 3 — Write the business doc (`documentation/{module}_negocio.md`)**
Follow the Business Doc Structure section below.

---

## Technical Doc Structure

File: `documentation/{module}.md`

```markdown
# {Module} — Análisis Técnico Completo

## ¿Qué es un {module}?
One paragraph. What it represents in the system and where it sits in the price/order/auth flow.

## Cuándo se usa en el negocio
Table: Escenario | Ejemplo

## Tipos de datos

### Entidad
TypeScript block with all fields and inline comments.

### Request: crear (CreateDto)
TypeScript block.

### Request: actualizar (UpdateDto)
TypeScript block. Note which fields are optional.

### Response (ResponseDto)
TypeScript block. Note any type conversions (e.g. decimal → number).

### Response: listado paginado (if applicable)
TypeScript block for PaginatedResponseDto<T>.

## Endpoints
One subsection per endpoint. Each has: HTTP method + path, description, Request JSON, Response JSON, possible errors (400/404/409).

## Reglas de negocio
Table: Regla | Dónde se aplica

## Ejemplos de uso real
JSON blocks showing real-world calls.

## Cumplimiento con agent skills
Checklist table against nestjs-core + typeorm-standard conventions. Include Swagger and test rows.

## Tests
Two subsections:
- **Unit tests**: comando para correr, tabla suite → cantidad → qué cubre.
- **E2E tests**: comando para correr, tabla con caso → status code esperado. Nota explícita si algún caso está cubierto solo en unit tests y por qué.

## Integración con otros módulos
ASCII diagram showing which modules consume this one and why.
```

---

## Business Doc Structure

File: `documentation/{module}_negocio.md`

```markdown
# Módulo de {Module} — Guía para el Negocio

## ¿Qué es un {module}?
Plain-language paragraph. Use a concrete money/product example.

## ¿Cómo se calcula / ¿Cómo funciona?
Simple step-by-step flow with arrows. No code. No field names.

## ¿Para qué sirve este módulo?
Business value. Why does the admin need this?

## Tipos de {module}
Table if there are categories (e.g. porcentual vs fijo). Skip if not applicable.

## Cuándo se usa en el negocio
Table: Situación | Ejemplo de uso

## ¿Qué puede hacer un administrador?
Table: Acción | Descripción
Followed by: note about who has access (roles), no technical role names.

## Reglas importantes
Bullet list. Plain language. No field names, no HTTP codes.

## Ejemplos del día a día
Blockquotes describing admin actions step by step. No JSON.

## ¿Cómo se conecta con el resto del sistema?
Plain paragraph explaining the relationship to other parts of the platform.
```

---

## Patterns: Do This, Not That

### Pattern 1: Business doc language

**Do this:**
```markdown
**No se puede eliminar un margen en uso** — si algún producto tiene ese margen asignado,
el sistema bloquea la eliminación y avisa.
```

**Not this:**
```markdown
`DELETE /margins/:id` retorna `409 Conflict` si `productPricingRepository.findOne` retorna un registro.
```
> Why: el doc de negocio es para personas sin contexto técnico — ningún código, ningún HTTP status.

---

### Pattern 2: Technical doc types

**Do this:**
```typescript
{
  value: number;  // decimal(10,2) — viene como string de PG, convertido en DTO
}
```

**Not this:**
```typescript
{
  value: number;
}
```
> Why: las notas sobre comportamiento real de la DB evitan bugs silenciosos.

---

### Pattern 3: No inventar campos

**Do this:**
Read the actual entity file. Copy field names and types exactly.

**Not this:**
Assume fields based on the module name (e.g. assuming `description` exists without checking).

> Why: docs desactualizados o incorrectos son peores que no tener docs.

---

## Common Mistakes to Avoid

- **Mezclar audiencias**: no agregar JSON o TypeScript al doc de negocio, ni explicaciones en lenguaje llano al técnico.
- **Inventar endpoints**: verificar el controller real antes de documentar rutas.
- **Omitir la sección de cumplimiento**: el checklist de agent skills es obligatorio en el doc técnico — sirve como auditoría del módulo.
- **No documentar errores posibles**: cada endpoint debe listar sus códigos de error con el motivo en español.
- **Archivo en el lugar equivocado**: siempre en `documentation/`, nunca dentro de `src/`.

---

## Expected Output

Para el módulo `taxes`, la salida correcta es:

```
documentation/
  taxes.md           ← doc técnico
  taxes_negocio.md   ← doc de negocio
```

Características de una buena salida:
- El doc técnico tiene una sección por endpoint con ejemplos JSON reales
- El doc de negocio no contiene ningún bloque de código
- Ambos archivos están en español
- El doc técnico tiene el checklist de agent skills completo
- Los tipos de datos coinciden exactamente con el código fuente

---

## Edge Cases

| Situación | Cómo manejarlo |
|---|---|
| El módulo no tiene paginación | Omitir la sección `PaginatedResponseDto` del doc técnico |
| El módulo no tiene DELETE | Omitir esa sección; no inventar un endpoint que no existe |
| El módulo tiene endpoints públicos (sin auth) | Notarlo explícitamente en la sección Endpoints del doc técnico y en la sección de permisos del doc de negocio |
| El módulo tiene lógica de negocio compleja (cálculos) | Agregar un diagrama de flujo en texto en ambos docs |
| Ya existe un doc previo | Actualizar en lugar de recrear; revisar que los tipos y endpoints sigan siendo correctos |
