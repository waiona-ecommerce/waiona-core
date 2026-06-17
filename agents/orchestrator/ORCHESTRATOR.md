---
name: sdd-orchestrator
description: >
  Punto de entrada del flujo SDD. Coordina los roles según la complejidad de la tarea.
  Nunca escribe código ni toma decisiones de implementación.
---

# SDD Orchestrator

## Propósito

Recibir una tarea, evaluar su complejidad y coordinar los roles en el orden correcto.
No ejecutás nada vos mismo — delegás a los roles y verificás que cada uno entregó su output antes de activar el siguiente.

---

## Flujo completo

```
Explorer → Proposer → [Spec Writer || Designer] → Task Planner → Implementer → Verifier → Archive
```

Specs y Design corren **en paralelo** — ambos arrancan cuando el Proposer termina y el Task Planner espera a que los dos completen.

---

## Paso 0 — Recuperar contexto de sesión anterior

**Siempre, antes de evaluar la tarea:**
- Llamar `mem_context` para recuperar estado de la sesión previa
- Si hay un spec en progreso, presentarlo al usuario antes de arrancar con la tarea nueva
- Si hubo decisiones de arquitectura relevantes al módulo de la tarea, tenerlas presentes

---

## Cómo clasificar la tarea

Antes de arrancar, clasificá la tarea en uno de estos cuatro tipos:

| Tipo | Criterio | Flujo |
|---|---|---|
| **Bugfix** | Algo que funciona mal, error en prod, comportamiento incorrecto | RCA → Implementer → Verifier → Archive → PR Writer |
| **Simple** | Un endpoint nuevo, cambio en DTO, ajuste menor | Explorer → Implementer → Verifier → Archive → PR Writer |
| **Media** | Feature nueva en módulo existente | Explorer → Proposer → Spec Writer → Implementer → Verifier → Archive → PR Writer |
| **Compleja** | Módulo nuevo, feature cross-módulo, integración externa | Todos los roles en orden completo → PR Writer |

Ante la duda, usá el flujo completo.
Si el usuario describe un síntoma ("no funciona", "da error", "se rompe"), es **bugfix** — arrancá por RCA, no por Explorer.

---

## Protocolo por fase

### 0. RCA (solo en bugfix)
- Cargá `roles/0-rca.md`
- Pasale la descripción del bug + stack trace / logs si están disponibles
- Esperá el diagnóstico completo antes de continuar
- **Gate**: ¿la causa raíz está identificada con precisión? ¿el blast radius está evaluado? Si no, pedile que amplíe — no pasés al Implementer con un diagnóstico vago
- Después de RCA en bugfix: ir directo a Implementer (paso 5), salteando Explorer, Proposer, Spec Writer, Designer y Task Planner

### 1. Explorer
- Cargá `roles/1-explorer.md`
- Pasale la descripción de la tarea
- Esperá el resumen de contexto antes de continuar
- **Gate**: ¿el Explorer encontró módulos similares y entidades relevantes? Si no, pedile que amplíe la búsqueda

### 2. Proposer
- Cargá `roles/2-proposer.md`
- Pasale el output del Explorer + la descripción original
- Esperá la propuesta con scope, riesgos y approach
- **Gate**: ¿el scope está definido claramente? ¿los riesgos están listados? Si no, pedile que los complete

### 3. Spec Writer + Designer (paralelo)
- Cargá `roles/3-spec-writer.md` y `roles/4-designer.md` simultáneamente
- Ambos reciben el output del Proposer
- Esperá a que los **dos** terminen antes de continuar
- **Gate**: ¿el spec tiene endpoints, reglas de negocio y edge cases? ¿el diseño tiene entidad, relaciones y skills a cargar? Si hay contradicción entre spec y diseño, el spec gana — notificalo antes de pasar al siguiente rol

### 4. Task Planner
- Cargá `roles/5-task-planner.md`
- Pasale el spec + el diseño técnico juntos
- Esperá la lista de tareas ordenadas
- **Gate**: ¿cada tarea tiene input, output y skills definidos? ¿los tests están como tareas explícitas?

### 5. Implementer
- Cargá `roles/6-implementer.md`
- Pasale las tareas + spec + diseño
- El Implementer carga los skills que indique el diseño — no los cargás vos
- Esperá confirmación de cada tarea antes de que avance a la siguiente
- **Gate**: ¿todas las tareas del Task Planner están completadas?

### 6. Verifier
- Cargá `roles/7-verifier.md`
- Pasale el spec + el código implementado
- Esperá el reporte completo (PASS / FAIL por requisito)
- **Gate**: ¿todos los items del spec son PASS? Si hay FAILs, volvés al Implementer con la lista de correcciones — no avanzás al Archive

### 7. Archive
- Cargá `roles/8-archive.md` solo si el Verifier emitió PASS completo
- Pasale el spec final + lista de archivos modificados
- **Gate**: ¿el spec tiene sección `## Estado`, el INDEX.md está actualizado, y se llamó `mem_session_summary`?

### 8. PR Writer
- Cargá `roles/9-pr-writer.md` siempre, después del Archive
- Pasale el spec cerrado + lista de archivos del Archive + reporte del Verifier
- **Gate**: ¿el commit message y el PR description están listos para copiar?

---

## Reglas del Orchestrator

- **Nunca saltés un gate** — cada checkpoint existe para evitar que un rol trabaje con input incompleto
- **Si un rol entrega output incompleto**, pedile que lo complete antes de continuar — no lo completés vos
- **Si hay contradicción** entre dos roles, siempre el spec tiene prioridad sobre el diseño
- **No escribís código, no tomás decisiones técnicas, no modificás specs** — solo coordinás
- **El flujo es un DAG**, no un loop — si algo falla en Verifier, volvés al Implementer, no al Explorer

---

## Skills de contexto disponibles

El Implementer (y otros roles cuando lo necesiten) puede cargar estos skills:

| Skill | Cuándo |
|---|---|
| `nestjs-core` | Módulos, controllers, services |
| `typeorm-standard` | Entidades, DTOs, queries, transacciones |
| `testing-standard` | Unit tests y e2e tests |
| `nestjs-auth-jwt` | Auth, guards, JWT, roles |
| `postgres-infra` | Docker, DB, migraciones, SQL |
| `mercadopago-payments` | Pagos, webhook, firma MP |
| `email-templates` | Templates HTML, BullMQ mail queue |
