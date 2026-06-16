# Waiona — Agents

Sistema SDD (Spec-Driven Development) para trabajar en este proyecto.
El punto de entrada siempre es el **Orchestrator** — él decide qué roles invocar según la complejidad de la tarea.

---

## Cómo usar

1. Cargá `orchestrator/ORCHESTRATOR.md`
2. Describile la tarea
3. El Orchestrator coordina el flujo — no cargás roles ni skills manualmente

---

## Flujo SDD

```
Explorer → Proposer → [Spec Writer || Designer] → Task Planner → Implementer → Verifier → Archive
```

Spec Writer y Designer corren en paralelo. El resto es secuencial con gates entre cada fase.

---

## Roles

| # | Rol | Archivo | Qué hace |
|---|---|---|---|
| 1 | Explorer | `roles/1-explorer.md` | Lee el código y construye contexto |
| 2 | Proposer | `roles/2-proposer.md` | Define qué cambiar y por qué |
| 3 | Spec Writer | `roles/3-spec-writer.md` | Escribe el spec formal en `specs/` |
| 4 | Designer | `roles/4-designer.md` | Define entidad, relaciones y decisiones técnicas |
| 5 | Task Planner | `roles/5-task-planner.md` | Parte el diseño en tareas ordenadas |
| 6 | Implementer | `roles/6-implementer.md` | Escribe el código siguiendo spec y diseño |
| 7 | Verifier | `roles/7-verifier.md` | Valida que lo implementado matchea el spec |
| 8 | Archive | `roles/8-archive.md` | Cierra el loop y registra el spec como completado |

---

## Skills de contexto

Los skills los carga el Implementer (o cualquier rol que los necesite) — no se cargan manualmente.

| Skill | Archivo | Cuándo |
|---|---|---|
| `nestjs-core` | `skills/nestjs-core/SKILL.md` | Módulos, controllers, services |
| `typeorm-standard` | `skills/typeorm-standard/SKILL.md` | Entidades, DTOs, relaciones, transacciones |
| `testing-standard` | `skills/testing-standard/SKILL.md` | Unit tests y e2e tests |
| `nestjs-auth-jwt` | `skills/nestjs-auth-jwt/SKILL.md` | Auth, guards, JWT, roles |
| `postgres-infra` | `skills/postgres-infra/SKILL.md` | Docker, DB, migraciones, SQL directo |
| `mercadopago-payments` | `skills/mercadopago-payments/SKILL.md` | Pagos, webhook, firma MP |
| `email-templates` | `skills/email-templates/SKILL.md` | Templates HTML, BullMQ mail queue |

---

## Contexto del proyecto

Ver `CLAUDE.md` en la raíz para el stack, módulos, flujos y convenciones completas.
