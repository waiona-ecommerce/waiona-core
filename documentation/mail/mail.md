# Mail — Análisis Técnico Completo

## ¿Qué es el módulo mail?

El módulo mail es el servicio de comunicación por correo electrónico de Waiona. No expone endpoints HTTP — es un servicio interno consumido por otros módulos (principalmente `auth`) para enviar emails transaccionales. Usa el SDK de **Resend** para el envío y gestiona los **tokens de un solo uso** (`TokenEntity`) que permiten verificar acciones sensibles como la activación de cuenta y el reset de contraseña.

```
AuthModule
  ├── sendActivationEmail()  → TokenEntity (account_activation) → email al usuario
  └── sendPasswordResetEmail() → TokenEntity (password_reset)   → email al usuario
                                        ↓
                              Resend SDK → entrega el email
```

---

## Cuándo se usa en el negocio

| Escenario | Ejemplo |
|---|---|
| Registro de usuario nuevo | Se envía un email con link de activación (expira en 24hs) |
| Recuperación de contraseña | Se envía un email con link de reset (expira en 1h) |

---

## Tipos de datos

### Entidad token (`TokenEntity`)

```typescript
{
  id:        number;
  token:     string;          // 64 chars hex — generado con randomBytes(32).toString('hex')
  type:      TokenType;       // 'account_activation' | 'password_reset'
  userId:    number;          // FK a users.id — CASCADE al eliminar el usuario
  expiresAt: Date;            // timestamptz — activación: +24h, reset: +1h
  usedAt:    Date | null;     // null = no usado aún; se setea al consumirse
  // computed getters — no son columnas de DB:
  isExpired: boolean;         // new Date() > expiresAt
  isUsed:    boolean;         // usedAt !== null
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
```

> Índices: `token` único + compuesto `[userId, type]` para búsquedas rápidas por usuario.

### Enum `TokenType`

```typescript
enum TokenType {
  ACCOUNT_ACTIVATION = 'account_activation',
  PASSWORD_RESET     = 'password_reset',
}
```

### Parámetros de `sendActivationEmail`

```typescript
sendActivationEmail(
  to:    string,  // email del destinatario
  name:  string,  // nombre del usuario — aparece en el saludo del email
  token: string,  // token hex — se embebe en la URL del link
): Promise<void>
```

URL generada: `${FRONTEND_URL}/auth/activate?token=${token}`

### Parámetros de `sendPasswordResetEmail`

```typescript
sendPasswordResetEmail(
  to:    string,  // email del destinatario
  name:  string,  // nombre del usuario — aparece en el saludo del email
  token: string,  // token hex — se embebe en la URL del link
): Promise<void>
```

URL generada: `${FRONTEND_URL}/auth/reset-password?token=${token}`

---

## Templates de email

| Template | Archivo | Asunto | Link expira |
|---|---|---|---|
| Activación de cuenta | `activation.template.ts` | `Activá tu cuenta en Waiona` | 24 horas |
| Reset de contraseña | `reset-password.template.ts` | `Recuperá tu contraseña en Waiona` | 1 hora |

Ambos templates:
- Usan `EMAIL_THEME` para colores y logo — nunca valores hardcodeados
- Layout con `<table>` (compatibilidad con clientes de email)
- Estilos 100% inline (Gmail elimina bloques `<style>`)
- Incluyen el link como botón CTA + URL copiable de respaldo
- Footer con año dinámico `${new Date().getFullYear()}`

---

## Reglas de negocio

| Regla | Dónde se aplica |
|---|---|
| Token generado con `randomBytes(32)` — 64 chars hex, único en la tabla | `AuthService.createToken()` |
| Token de activación expira en 24 horas | `AuthService` — `expiresAt = now + 24h` |
| Token de reset expira en 1 hora | `AuthService` — `expiresAt = now + 1h` |
| Token marcado como usado al consumirse | `AuthService` — `usedAt = new Date()` |
| Tokens de reset previos invalidados al solicitar uno nuevo | `AuthService.forgotPassword()` |
| `MailService` no lanza errores silenciosos — propaga excepciones de Resend | Caller (`AuthService`) decide cómo manejarlos |
| `MAIL_FROM` con fallback a `onboarding@resend.dev` | Constructor de `MailService` |

---

## Variables de entorno requeridas

| Variable | Descripción |
|---|---|
| `RESEND_API_KEY` | API key de Resend para autenticar el envío |
| `MAIL_FROM` | Dirección remitente — ej: `Waiona <noreply@waiona.com>` |
| `FRONTEND_URL` | Base URL del frontend — se usa para construir los links de los emails |

> En desarrollo con `onboarding@resend.dev` solo se puede enviar al email verificado en la cuenta de Resend. Para enviar a cualquier destinatario hay que verificar un dominio propio.

---

## Cumplimiento con agent skills

| Check | Estado |
|---|---|
| Sin controller — no expone endpoints HTTP | ✅ |
| `ConfigService<Env>` con `{ infer: true }` en todos los `.get()` | ✅ |
| Templates en archivos separados — no HTML inline en el service | ✅ |
| `EMAIL_THEME` usado en todos los templates — sin colores hardcodeados | ✅ |
| Layout con `<table>`, estilos inline — compatible con Gmail | ✅ |
| `MailModule` exporta `MailService` — consumible por otros módulos | ✅ |
| `TokenEntity` extiende `BaseEntity` | ✅ |
| FK `user_id` explícita + `onDelete: 'CASCADE'` | ✅ |
| Índice único en `token` + compuesto `[userId, type]` | ✅ |
| Unit tests — 9 casos, mock del SDK Resend a nivel de módulo | ✅ |

---

## Tests

### Unit tests (`src/modules/mail/services/mail.service.spec.ts`)

```bash
npx jest --testPathPattern="mail.service" --no-coverage
```

| Suite | Tests | Cobertura |
|---|---|---|
| `sendActivationEmail` | 4 | params correctos (from/to/subject), URL en html, nombre en html, error de Resend |
| `sendPasswordResetEmail` | 4 | params correctos (from/to/subject), URL en html, nombre en html, error de Resend |
| Definición | 1 | should be defined |

> No hay tests E2E propios — el flujo de envío queda cubierto por los e2e de `auth` (`POST /auth/register` y `POST /auth/forgot-password`). Testear el envío real de Resend en e2e requeriría un dominio verificado y no aporta valor adicional.

---

## Integración con otros módulos

```
MailModule
  └── exporta MailService → consumido por:
        └── AuthModule
              ├── register()       → sendActivationEmail()
              └── forgotPassword() → sendPasswordResetEmail()

TokenEntity → gestionada directamente por AuthModule (repo directo)
  └── userId FK → UserEntity (CASCADE — tokens se eliminan con el usuario)
```
