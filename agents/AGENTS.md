# Waiona — Agents

Este directorio define las skills disponibles para IAs (Claude, Cursor, Copilot, etc.) que trabajen en este proyecto.

---

## Cómo usar las skills

Antes de generar código, la IA debe cargar la skill relevante. Cada skill tiene un `When to Use` que indica cuándo cargarla.

**Combinaciones frecuentes:**
- Crear un módulo nuevo → `nestjs-core` + `typeorm-standard`
- Implementar auth o guards → `nestjs-auth-jwt`
- Escribir unit tests → `nestjs-core` (sección testing) + `testing-standard`
- Escribir e2e tests → `testing-standard` + `nestjs-docker-postgres`
- Configurar Docker/DB → `nestjs-docker-postgres` + `postgres-standard`
- Trabajar con pagos → `mercadopago-payments`
- Crear templates de email → `email-templates`
- Operaciones SQL directas → `postgres-standard`

---

## Skills disponibles

| Skill | Archivo | Cuándo cargar |
|---|---|---|
| `nestjs-core` | `skills/nestjs-core/SKILL.md` | Crear módulos, controllers, services |
| `nestjs-auth-jwt` | `skills/nestjs-auth-jwt/SKILL.md` | Auth, guards, JWT, roles |
| `typeorm-standard` | `skills/typeorm-standard/SKILL.md` | Entidades, DTOs, relaciones, transacciones |
| `testing-standard` | `skills/testing-standard/SKILL.md` | Unit tests y e2e tests |
| `postgres-standard` | `skills/postgres-standard/SKILL.md` | SQL, naming, sync vs migraciones |
| `nestjs-docker-postgres` | `skills/nestjs-docker-postgres/SKILL.md` | Docker, conexión DB, e2e setup |
| `mercadopago-payments` | `skills/mercadopago-payments/SKILL.md` | Pagos, webhook, firma MP |
| `email-templates` | `skills/email-templates/SKILL.md` | Templates HTML, MailService, Resend |

---

## Contexto del proyecto

Ver `CLAUDE.md` en la raíz del proyecto para el contexto completo — stack, módulos, flujos y convenciones.