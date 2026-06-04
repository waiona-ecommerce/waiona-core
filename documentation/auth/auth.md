# Auth — Análisis Técnico Completo

## ¿Qué es el módulo auth?

El módulo de autenticación gestiona el ciclo de vida de la sesión en Waiona: registro, activación por email, login con JWT + refresh token, recuperación y reset de contraseña. No tiene entidad propia — opera sobre `UserEntity` (del módulo `users`) y `TokenEntity` (del módulo `mail`). Es el único punto de entrada para obtener un JWT válido que el resto de los módulos protegidos requieren.

```
POST /v1/auth/register         → crea UserEntity inactivo + envía token de activación
GET  /v1/auth/activate         → valida token → isActive = true
POST /v1/auth/login            → valida credenciales → emite access_token + refresh_token
POST /v1/auth/refresh          → rota refresh token → nuevos access_token + refresh_token
POST /v1/auth/logout           → revoca refresh token (logout de un dispositivo)
POST /v1/auth/logout-all       → revoca todos los refresh tokens del usuario (JWT requerido)
PATCH /v1/auth/change-password → cambia contraseña validando la actual (JWT requerido)
POST /v1/auth/forgot-password  → invalida tokens de reset previos + envía email de reset
POST /v1/auth/reset-password   → valida token de reset → actualiza password
                                        ↓
                   Authorization: Bearer <access_token>  ← requerido por todos los módulos protegidos
```

---

## Cuándo se usa en el negocio

| Escenario | Ejemplo |
|---|---|
| Registro de cliente nuevo | El cliente completa el formulario y recibe un email para activar la cuenta |
| Activación de cuenta | El cliente hace clic en el link del email para habilitar el login |
| Login | El cliente ingresa email y contraseña y obtiene un JWT para operar |
| Recuperación de contraseña | El cliente solicita un link de reset por email |
| Reset de contraseña | El cliente ingresa el token del email y elige una nueva contraseña |
| Cambio de contraseña autenticado | El cliente cambia su contraseña estando logueado, validando la actual |
| Logout en un dispositivo | El cliente revoca su refresh token (invalida esa sesión) |
| Logout en todos los dispositivos | El cliente revoca todos sus refresh tokens activos |

---

## Tipos de datos

### Modelo de payload JWT (`Payload`)

```typescript
{
  sub:  number;        // userId — identifica al usuario en req.user
  role: RoleType | null; // 'super_admin' | 'admin' | 'client' — leído por RolesGuard sin query a DB
}
```

### Entidad refresh token (`RefreshTokenEntity`)

```typescript
{
  id:        number;
  userId:    number;          // FK → users.id — CASCADE al eliminar el usuario
  tokenHash: string;          // SHA-256 del refresh token — no se guarda el token en claro; unique index
  expiresAt: Date;            // timestamptz — +30 días desde emisión
  revokedAt: Date | null;     // timestamptz — null = activo; != null = revocado
  // computed getters:
  isExpired: boolean;         // new Date() > expiresAt
  isRevoked:  boolean;        // revokedAt !== null
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### Entidad token de email (`TokenEntity`) — compartida con módulo `mail`

```typescript
{
  id:        number;
  token:     string;          // randomBytes(32).toString('hex') — 64 chars hex, único en la tabla
  type:      TokenType;       // 'account_activation' | 'password_reset'
  userId:    number;          // FK a users.id — CASCADE al eliminar el usuario
  expiresAt: Date;            // timestamptz — activación: +24h, reset: +1h
  usedAt:    Date | null;     // timestamptz — null = no usado aún
  // computed getters:
  isExpired: boolean;         // new Date() > expiresAt
  isUsed:    boolean;         // usedAt !== null
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### Request: registrar (`CreateUserDto`)

```typescript
{
  email:    string;   // requerido, formato email
  password: string;   // requerido, 8–255 chars — debe tener mayúscula + minúscula + número
  name:     string;   // requerido, máx 255 chars
  lastName: string;   // requerido, máx 255 chars
  avatar?:  string;   // opcional, URL válida, máx 255 chars
}
```

### Request: login

Passport LocalStrategy extrae `email` y `password` del body directamente. No hay DTO explícito.

```typescript
{
  email:    string;
  password: string;
}
```

### Response: login

```typescript
{
  user: {
    id:        number;
    email:     string;
    isActive:  boolean;
    profileId: number;
    profile: {
      id:        number;
      name:      string;
      lastName:  string;
      avatar:    string | null;
      createdAt: Date;
      updatedAt: Date;
      deletedAt: Date | null;
    };
    roleId: number | null;
    role: {
      id:        number;
      type:      'super_admin' | 'admin' | 'client'; // RoleEntity — no es un string plano
      createdAt: Date;
      updatedAt: Date;
      deletedAt: Date | null;
    } | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    // password: NUNCA expuesto — @Exclude() en UserEntity + ClassSerializerInterceptor global
  };
  access_token: string; // JWT firmado con JWT_SECRET, expira en 15 minutos
}
```

### Request: refresh / logout (`RefreshTokenDto`)

```typescript
{
  refresh_token: string; // requerido — el refresh token emitido por login o refresh
}
```

### Request: change-password (`ChangePasswordDto`)

```typescript
{
  currentPassword: string; // requerido — contraseña actual para verificar identidad
  newPassword:     string; // requerido, 8–100 chars — debe tener mayúscula + minúscula + número
}
```

### Request: forgot-password (`ForgotPasswordDto`)

```typescript
{
  email: string; // requerido, formato email
}
```

### Request: reset-password (`ResetPasswordDto`)

```typescript
{
  token:    string; // requerido — el token del email
  password: string; // requerido, 8–100 chars
}
```

---

## Endpoints

Todas las rutas tienen prefijo `/v1/` — el controller usa `{ version: '1', path: 'auth' }`.

### `POST /v1/auth/register`

Crea un usuario inactivo y envía un email de activación.

**Request:**
```json
{
  "email": "juan@example.com",
  "password": "Password123",
  "name": "Juan",
  "lastName": "Pérez"
}
```

**Response 201:**
```json
{ "message": "Registration successful — check your email to activate your account" }
```

**Errores posibles:**
- `400` — datos inválidos (email mal formateado, password sin mayúscula, campos faltantes)
- `409` — el email ya está registrado

> Throttle: máx 5 requests por minuto por IP.

---

### `GET /v1/auth/activate?token=xxx`

Activa la cuenta usando el token recibido por email.

**Response 200:**
```json
{ "message": "Account activated successfully" }
```

**Errores posibles:**
- `400` — token no existe, ya fue usado, o está expirado (mensaje genérico, no distingue el caso)
- `400` — la cuenta ya estaba activada

---

### `POST /v1/auth/login`

Valida credenciales y emite un access token + refresh token. Gestionado por `AuthGuard('local')` → `LocalStrategy` → `AuthService.validateUser()`.

**Request:**
```json
{
  "email": "juan@example.com",
  "password": "Password123"
}
```

**Response 200:**
```json
{
  "user": {
    "id": 1,
    "email": "juan@example.com",
    "isActive": true,
    "profileId": 1,
    "profile": {
      "id": 1,
      "name": "Juan",
      "lastName": "Pérez",
      "avatar": null,
      "createdAt": "2026-05-19T10:00:00.000Z",
      "updatedAt": "2026-05-19T10:00:00.000Z",
      "deletedAt": null
    },
    "roleId": 3,
    "role": {
      "id": 3,
      "type": "client",
      "createdAt": "2026-05-19T10:00:00.000Z",
      "updatedAt": "2026-05-19T10:00:00.000Z",
      "deletedAt": null
    },
    "createdAt": "2026-05-19T10:00:00.000Z",
    "updatedAt": "2026-05-19T10:00:00.000Z",
    "deletedAt": null
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "abc123..."
}
```

**Errores posibles:**
- `401` — email no existe, password incorrecta, o cuenta no activada (mensaje genérico `"Invalid credentials"`)

> Throttle: máx 5 requests por minuto por IP.

---

### `POST /v1/auth/refresh`

Rota el refresh token: revoca el anterior y emite uno nuevo. Implementa token rotation — un refresh token solo se puede usar una vez.

**Request:**
```json
{ "refresh_token": "abc123..." }
```

**Response 200:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "xyz789..."
}
```

**Errores posibles:**
- `401` — token no existe, ya fue revocado, o está expirado

---

### `POST /v1/auth/logout`

Revoca el refresh token del body. No requiere JWT — solo el refresh token válido.

**Request:**
```json
{ "refresh_token": "abc123..." }
```

**Response 204** (sin cuerpo)

**Errores posibles:**
- `401` — token no existe o ya fue revocado
- `400` — body inválido

---

### `POST /v1/auth/forgot-password`

Envía un email con link de reset de contraseña. Invalida todos los tokens de reset previos del usuario antes de crear uno nuevo.

**Request:**
```json
{ "email": "juan@example.com" }
```

**Response 200:**
```json
{ "message": "If the email exists, you will receive a reset link shortly" }
```

> Siempre responde 200 — no revela si el email existe o no (previene enumeración de usuarios). El email solo se envía si la cuenta existe **y** está activa.

> Throttle: máx 3 requests por minuto por IP.

---

### `POST /v1/auth/reset-password`

Valida el token de reset e invalida todos los tokens de reset del usuario.

**Request:**
```json
{
  "token": "a3f8c2...",
  "password": "NuevoPassword123"
}
```

**Response 200:**
```json
{ "message": "Password reset successfully" }
```

**Errores posibles:**
- `400` — token no existe, ya fue usado, o está expirado

> Throttle: máx 5 requests por minuto por IP.

---

### `PATCH /v1/auth/change-password`

Cambia la contraseña del usuario autenticado. Requiere JWT. Valida la contraseña actual antes de actualizar.

**Request:**
```json
{
  "currentPassword": "Password123",
  "newPassword": "NuevoPassword456"
}
```

**Response 200:**
```json
{ "message": "Password changed successfully" }
```

**Errores posibles:**
- `400` — contraseña actual incorrecta o `newPassword` no cumple el formato
- `401` — no autenticado (sin JWT)

---

### `POST /v1/auth/logout-all`

Revoca todos los refresh tokens activos del usuario. Requiere JWT. Cierra sesión en todos los dispositivos.

**Response 204** (sin cuerpo)

**Errores posibles:**
- `401` — no autenticado (sin JWT)

---

## Reglas de negocio

| Regla | Dónde se aplica |
|---|---|
| Token de activación expira en 24 horas | `createToken()` con `expiresInHours: 24` |
| Token de reset expira en 1 hora | `createToken()` con `expiresInHours: 1` |
| Token marcado como usado tras consumirse | `activateAccount` y `findValidToken` → `tokenEntity.usedAt = new Date()` |
| Tokens de reset previos invalidados al solicitar nuevo | `forgotPassword` → `tokenRepo.update({ userId, type: PASSWORD_RESET }, { usedAt })` antes de crear el nuevo |
| `forgotPassword` silencioso si email no existe o cuenta inactiva | early return sin enviar email ni error |
| Login rechazado si `isActive === false` | `validateUser` → `401 UnauthorizedException` |
| `password` jamás expuesto en respuestas | `@Exclude()` en `UserEntity` + `ClassSerializerInterceptor` global en `main.ts` |
| JWT (access token) expira en 15 minutos | `JwtModule` con `signOptions: { expiresIn: '15m' }` |
| Refresh token expira en 30 días | `issueRefreshToken()` — se guarda el hash (SHA-256), no el token en claro |
| Refresh token rotation — un refresh token es de un solo uso | `refresh()` emite el nuevo token PRIMERO, luego revoca el viejo — si falla la emisión, el cliente conserva el token anterior y puede reintentar |
| `logout` revoca el refresh token del body sin JWT | `findValidRefreshToken()` valida que exista, no esté revocado ni expirado; luego `revokedAt = new Date()` |
| `logout-all` revoca todos los refresh tokens activos del usuario | `refreshTokenRepo.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() })` |
| `change-password` valida contraseña actual antes de actualizar | `usersService.findEntityWithPassword()` + `bcrypt.compare()` → `400` si no coincide |
| `RolesGuard` lee rol del JWT — sin query a DB | `JwtStrategy.validate()` retorna el payload completo |

---

## Ejemplos de uso real

**Flujo completo de registro y primer login:**
```
POST /v1/auth/register   { email, password, name, lastName }  → 201
GET  /v1/auth/activate?token=<token-del-email>                → 200
POST /v1/auth/login      { email, password }                  → 200 + access_token + refresh_token
```

**Renovar el access token con el refresh token:**
```
POST /v1/auth/refresh  { refresh_token: "abc..." }  → 200 + nuevos access_token + refresh_token
```

**Cerrar sesión:**
```
POST /v1/auth/logout      { refresh_token: "xyz..." }  → 204  (invalida ese dispositivo)
POST /v1/auth/logout-all                               → 204  (invalida todos los dispositivos, requiere JWT)
```

**Flujo de reset de contraseña:**
```
POST /v1/auth/forgot-password  { email }                              → 200
POST /v1/auth/reset-password   { token: <token-del-email>, password } → 200
POST /v1/auth/login            { email, nuevaPassword }               → 200 + tokens
```

**Cambiar contraseña estando logueado:**
```
PATCH /v1/auth/change-password  { currentPassword, newPassword }  → 200  (requiere JWT)
```

**Usar el JWT en rutas protegidas:**
```
GET /v1/users/1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
→ 200
```

---

## Cumplimiento con agent skills

| Check | Estado |
|---|---|
| Dos estrategias: `local` solo para login, `jwt` para rutas protegidas | ✅ |
| JWT payload incluye `role` — sin query a DB en `RolesGuard` | ✅ |
| `JwtStrategy.validate()` retorna payload completo | ✅ |
| `JWT_SECRET` via `ConfigService<Env>` — nunca `process.env` | ✅ |
| `validateUser()` verifica `isActive` → 401 | ✅ |
| `forgotPassword` no revela existencia del email | ✅ |
| Token de email generado con `randomBytes(32)` | ✅ |
| Throttle en todos los endpoints sensibles | ✅ register / login / forgot-password / reset-password |
| `ClassSerializerInterceptor` global en `main.ts` — sin redundancia en controller | ✅ |
| Refresh token guardado como hash (SHA-256), no en claro | ✅ |
| Token rotation — un refresh token es de un solo uso | ✅ `refresh()` revoca el anterior antes de emitir el nuevo |
| `logout-all` revoca todas las sesiones activas | ✅ `UPDATE ... WHERE userId = X AND revokedAt IS NULL` |
| `change-password` valida contraseña actual con bcrypt | ✅ `usersService.findEntityWithPassword()` + `bcrypt.compare()` |
| Swagger — `@ApiTags`, `@ApiOperation`, `@ApiResponse` en los 9 endpoints | ✅ |
| Tipo de retorno explícito en `login` | ✅ `{ user: UserEntity; access_token: string; refresh_token: string }` |
| URI versioning `/v1/` en el controller | ✅ `@Controller({ version: '1', path: 'auth' })` |
| Unit tests | ✅ 41 casos — service (31) + controller (10) |
| E2E tests — PostgreSQL real, `dropSchema: true`, 29 casos | ✅ |

---

## Tests

### Unit tests (`src/modules/auth/`)

```bash
npx jest --testPathPattern="src/modules/auth" --no-coverage
```

| Suite | Tests | Cobertura |
|---|---|---|
| `auth.service.spec.ts` | 31 | validateUser (4), generateToken (1), login (1), refresh (5 — incluye test de rotation order), logout (2), register (1), activateAccount (5), forgotPassword (3), resetPassword (2), changePassword (3), logoutAll (2), defined (1) |
| `auth.controller.spec.ts` | 10 | register, activate, login, refresh, logout, forgotPassword, resetPassword, changePassword, logoutAll + defined |

### E2E tests (`test/auth/auth.e2e-spec.ts`)

```bash
docker compose up -d
npx jest --config test/jest-e2e.json --testPathPattern="auth"
```

| Caso | Status esperado |
|---|---|
| POST /v1/auth/register con datos válidos | 201 |
| POST /v1/auth/register email duplicado | 409 |
| POST /v1/auth/register body inválido | 400 |
| POST /v1/auth/login cuenta no activada | 401 |
| GET /v1/auth/activate token válido | 200 |
| GET /v1/auth/activate token ya usado | 400 |
| GET /v1/auth/activate token inválido | 400 |
| POST /v1/auth/login credenciales correctas — 200 + access_token + refresh_token | 200 |
| POST /v1/auth/login password incorrecta | 401 |
| POST /v1/auth/refresh — retorna nuevos tokens | 200 |
| POST /v1/auth/refresh — token inválido | 401 |
| POST /v1/auth/refresh — token ya rotado (revocado) | 401 |
| POST /v1/auth/refresh — body inválido | 400 |
| POST /v1/auth/logout — revoca refresh token | 204 |
| POST /v1/auth/logout — token ya revocado | 401 |
| POST /v1/auth/logout — token inválido | 401 |
| POST /v1/auth/logout — body inválido | 400 |
| POST /v1/auth/forgot-password email inexistente — sin email enviado | 200 |
| POST /v1/auth/forgot-password email válido — envía email | 200 |
| POST /v1/auth/reset-password token válido + login con nueva contraseña | 200 → 200 |
| POST /v1/auth/reset-password token inválido | 400 |
| PATCH /v1/auth/change-password sin JWT | 401 |
| PATCH /v1/auth/change-password contraseña actual incorrecta | 400 |
| PATCH /v1/auth/change-password body inválido | 400 |
| PATCH /v1/auth/change-password exitoso + login con nueva contraseña | 200 → 200 |
| POST /v1/auth/logout-all sin JWT | 401 |
| POST /v1/auth/logout-all revoca todas las sesiones | 204 |
| POST /v1/auth/refresh con token previo al logout-all | 401 |

---

## Integración con otros módulos

```
AuthModule
  ├── consume UsersService
  │     ├── create()                   → POST /v1/auth/register
  │     ├── findByEmail()              → validateUser (login)
  │     ├── findOne()                  → activateAccount (verifica isActive)
  │     ├── findEntityWithPassword()   → PATCH /v1/auth/change-password (expone hash para bcrypt.compare)
  │     ├── activate()                 → GET /v1/auth/activate
  │     └── updatePassword()           → POST /v1/auth/reset-password y PATCH /v1/auth/change-password
  │
  ├── consume MailService
  │     ├── sendActivationEmail()    → POST /v1/auth/register
  │     └── sendPasswordResetEmail() → POST /v1/auth/forgot-password
  │
  ├── consume TokenEntity (repo directo — no via MailModule service)
  │     ├── createToken()     → genera y persiste token de activación/reset
  │     └── findValidToken()  → valida token en activate y reset-password
  │
  └── consume RefreshTokenEntity (repo directo)
        ├── issueRefreshToken()      → genera token, guarda hash
        ├── findValidRefreshToken()  → valida en refresh y logout
        └── revokedAt = new Date()   → en refresh (rotación), logout y logout-all

JwtStrategy (jwt)
  └── emitido por AuthModule → validado en TODOS los módulos con AuthGuard('jwt')
        └── req.user = { sub: userId, role: RoleType } — disponible en cualquier controller protegido
```
