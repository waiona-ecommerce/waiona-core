# Users — Análisis Técnico Completo

## ¿Qué es un usuario?

Un usuario es la entidad central de la plataforma Waiona. Concentra las credenciales de autenticación (email/password), el perfil personal (nombre, apellido, avatar) y el rol que determina qué puede hacer en el sistema. Es el punto de entrada del flujo de auth y el sujeto de todas las operaciones protegidas por propiedad.

```
POST /v1/auth/register  → crea el usuario (inactivo)
GET  /v1/auth/activate  → activa la cuenta
POST /v1/auth/login     → emite JWT con { sub: userId, role: RoleType }
                             ↓
                       userId se usa como guardián en GET/PATCH/DELETE /v1/users/:id
```

---

## Cuándo se usa en el negocio

| Escenario | Ejemplo |
|---|---|
| Registro de cliente nuevo | El cliente se registra con email, nombre y contraseña |
| Activación de cuenta | El usuario hace clic en el link del email de activación |
| Login y JWT | El cliente inicia sesión y obtiene un token para operar |
| Actualización de perfil | El cliente cambia su nombre o foto de perfil |
| Listado de usuarios | Un admin busca usuarios por nombre o email con paginación |
| Baja de cuenta | El cliente solicita eliminar su cuenta (soft delete) |
| Reset de contraseña | El auth module llama a `updatePassword()` internamente |

---

## Tipos de datos

### Entidad principal (`UserEntity`)

```typescript
{
  id:        number;       // PK autoincremental
  email:     string;       // único en la tabla, máx 255 chars
  password:  string;       // hash bcrypt — @Exclude() en respuestas, nunca expuesto
  isActive:  boolean;      // false al crear, true tras activar con token
  profileId: number;       // FK explícita a profiles.id
  profile:   ProfileEntity; // eager: true, cascade: true — siempre cargado
  roleId:    number | null; // FK explícita a roles.id, nullable
  role:      RoleEntity | null; // eager: true — null si no asignado aún
  deletedAt: Date | null;  // soft delete vía @DeleteDateColumn
  createdAt: Date;
  updatedAt: Date;
}
```

> `password` tiene `@Exclude()` de `class-transformer` — el `ClassSerializerInterceptor` global nunca lo expone en ninguna respuesta HTTP.

### Entidad perfil (`ProfileEntity`)

```typescript
{
  id:        number;
  name:      string;       // máx 255 chars
  lastName:  string;       // columna DB: last_name
  avatar:    string | null; // URL, nullable
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### Entidad rol (`RoleEntity`)

```typescript
{
  id:   number;
  type: RoleType;  // 'super_admin' | 'admin' | 'client' — unique
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### Request: crear usuario (`CreateUserDto`)

Usado por `POST /auth/register` — no hay endpoint `POST /users`.

```typescript
{
  email:    string;   // requerido, formato email
  password: string;   // requerido, 8–255 chars, debe tener mayúscula + minúscula + número
  name:     string;   // requerido, máx 255 chars
  lastName: string;   // requerido, máx 255 chars
  avatar?:  string;   // opcional, URL válida, máx 255 chars
}
```

### Request: actualizar usuario (`UpdateUserDto`)

`PartialType(OmitType(CreateUserDto, ['email', 'password']))` — email y contraseña no se actualizan por este endpoint.

```typescript
{
  name?:     string;
  lastName?: string;
  avatar?:   string | null;  // null explícito limpia el avatar
}
```

### Request: búsqueda paginada (`SearchUsersDto`)

```typescript
{
  page?:  number;  // default: 1, mín: 1
  limit?: number;  // default: 20, mín: 1, máx: 100
  email?: string;  // búsqueda parcial con ILIKE — acepta fragmento de email (ej: "juan", "test@")
  name?:  string;  // busca en name Y lastName con ILIKE (OR)
}
```

### Response: usuario (`UserResponseDto`)

```typescript
{
  id:        number;
  email:     string;
  isActive:  boolean;
  role:      'super_admin' | 'admin' | 'client' | null;  // null si sin rol asignado
  profile: {
    id:       number;
    name:     string;
    lastName: string;
    avatar:   string | null;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Response: listado paginado (`PaginatedResponseDto<UserResponseDto>`)

```typescript
{
  data:        UserResponseDto[];
  total:       number;
  page:        number;
  limit:       number;
  totalPages:  number;
  hasNextPage: boolean;
}
```

---

## Endpoints

Todas las rutas tienen prefijo `/v1/` — el controller usa `{ version: '1', path: 'users' }`.

### `GET /v1/users?page&limit&email&name`

Lista paginada de usuarios activos. Requiere JWT con rol `SUPER_ADMIN` o `ADMIN`.

**Query params** (todos opcionales):
```
page  → default: 1
limit → default: 20, máx: 100
email → filtra por email con ILIKE (parcial)
name  → filtra por name O lastName con ILIKE (OR entre ambos campos)
```

**Response 200:**
```json
{
  "data": [
    {
      "id": 1,
      "email": "juan@example.com",
      "isActive": true,
      "role": "client",
      "profile": {
        "id": 1,
        "name": "Juan",
        "lastName": "Pérez",
        "avatar": null
      },
      "createdAt": "2026-05-19T10:00:00.000Z",
      "updatedAt": "2026-05-19T10:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1,
  "hasNextPage": false
}
```

---

### `GET /v1/users/:id`

Obtiene el propio usuario. Requiere JWT. Solo puede acceder a su propio perfil (`req.user.sub === id`).

**Response 200:** `UserResponseDto`

**Errores posibles:**
- `403` — el JWT pertenece a otro usuario
- `404` — usuario no encontrado (o ya eliminado)

---

### `PATCH /v1/users/:id`

Actualización parcial del perfil. Requiere JWT. Solo puede modificar su propio perfil.

**Request:**
```json
{ "name": "Carlos" }
```

**Response 200:** `UserResponseDto` actualizado

**Errores posibles:**
- `400` — campo inválido o no permitido (`email` o `password` en el body → 400 por `forbidNonWhitelisted`)
- `403` — el JWT pertenece a otro usuario
- `404` — usuario no encontrado

> El campo `avatar` puede enviarse como `null` para borrarlo explícitamente. Omitirlo no lo modifica.

---

### `DELETE /v1/users/:id`

Soft delete del propio usuario. Requiere JWT. Solo puede eliminar su propia cuenta.

**Response 204:** sin body

**Errores posibles:**
- `403` — el JWT pertenece a otro usuario
- `404` — usuario no encontrado

---

## Reglas de negocio

| Regla | Dónde se aplica |
|---|---|
| Email único en la tabla | `create` — verifica antes del INSERT + catch `23505` en la transacción |
| Password hasheado con bcrypt | `@BeforeInsert` en `UserEntity` — automático al hacer `manager.save()` |
| Usuario creado inactivo (`isActive: false`) | `create` — default de la columna |
| Solo el propio usuario puede ver/editar/eliminar su perfil | `findOne`, `update`, `remove` — compara `req.user.sub !== id` |
| Admins pueden listar todos los usuarios | `findAll` — `@Roles(SUPER_ADMIN, ADMIN)` |
| Soft delete — `deletedAt` nunca `null` en registros eliminados | `remove` vía `repo.softDelete(id)` |
| Creación en transacción (usuario + perfil atómicos) | `create` — `dataSource.transaction()` evita perfiles huérfanos |
| Avatar `null` borra el valor; omitido no lo modifica | `update` — check `!== undefined` antes de asignar |
| `findEntityWithPassword` expone el hash de bcrypt | Usado internamente por `AuthService` en el flujo de `PATCH /v1/auth/change-password`; usa `addSelect('user.password')` porque la columna tiene `select: false` |

---

## Ejemplos de uso real

**Listar usuarios paginados (admin):**
```json
GET /v1/users?page=1&limit=10
```

**Filtrar por email:**
```json
GET /v1/users?email=juan
```

**Filtrar por nombre:**
```json
GET /v1/users?name=Pérez
```

**Ver propio perfil:**
```json
GET /v1/users/1
Authorization: Bearer <jwt-con-sub=1>
```

**Actualizar nombre y quitar avatar:**
```json
PATCH /v1/users/1
Authorization: Bearer <jwt-con-sub=1>
{ "name": "Carlos", "avatar": null }
```

**Eliminar propia cuenta:**
```json
DELETE /v1/users/1
Authorization: Bearer <jwt-con-sub=1>
→ 204 No Content
```

**Intentar acceder a otro usuario:**
```json
GET /v1/users/2
Authorization: Bearer <jwt-con-sub=1>
→ 403 Forbidden: "Access denied"
```

---

## Cumplimiento con agent skills

| Check | Estado |
|---|---|
| Entidades extienden `BaseEntity` con `@DeleteDateColumn` | ✅ |
| Soft delete vía `repo.softDelete(id)` | ✅ |
| TypeORM filtra `deletedAt IS NULL` automáticamente | ✅ |
| Service retorna DTOs, nunca entidades crudas | ✅ (`findByEmail` excepción deliberada: auth necesita el hash) |
| `ParseIntPipe` en todos los params de ID | ✅ |
| `@Patch` para actualización parcial | ✅ |
| `@HttpCode(204)` en DELETE | ✅ |
| `PartialType` de `@nestjs/swagger` en `UpdateUserDto` | ✅ |
| FKs explícitas (`profileId`, `roleId`) en la entidad | ✅ |
| `onDelete: 'RESTRICT'` en ambas relaciones | ✅ |
| `ProfileEntity` no inyectada como repo (cascade via `UserEntity`) | ✅ |
| `findEntity()` privado para búsquedas internas | ✅ |
| `FindOptionsWhere<UserEntity>` en lugar de `any` | ✅ |
| `SearchUsersDto.email` usa `@IsString()` (no `@IsEmail()`) — permite búsqueda parcial | ✅ |
| `GuardsModule` no importado en el módulo | ✅ |
| Swagger — `@ApiTags`, `@ApiBearerAuth` en controller | ✅ |
| Swagger — `@ApiOperation`, `@ApiResponse`, `@ApiParam` por endpoint | ✅ |
| Swagger — `@ApiProperty` en `CreateUserDto`, `SearchUsersDto`, `UserResponseDto` | ✅ |
| Unit tests — 26 tests, service + controller | ✅ |
| E2E tests — PostgreSQL real, `dropSchema: true`, 12 casos | ✅ |

---

## Tests

### Unit tests (`src/modules/users/`)

```bash
npx jest --testPathPattern="users" --no-coverage
```

| Suite | Tests | Cobertura |
|---|---|---|
| `users.service.spec.ts` | 17 | create, findByEmail, findAll (filtros), findOne, update, remove, activate, updatePassword |
| `users.controller.spec.ts` | 9 | findAll (params), findOne, update, remove — happy path + 403 por propiedad |

### E2E tests (`test/users/users.e2e-spec.ts`)

```bash
# Requiere Docker con la DB de test corriendo (puerto 5433)
docker compose up -d
npx jest --config test/jest-e2e.json --testPathPattern="users"
```

| Caso | Status code esperado |
|---|---|
| GET /v1/users paginado | 200 |
| GET /v1/users?email=test filtra por email | 200 |
| GET /v1/users?name=Test filtra por nombre | 200 |
| GET /v1/users/:id propio usuario | 200 |
| GET /v1/users/:id otro usuario | 403 |
| GET /v1/users/999999 inexistente | 404 |
| PATCH /v1/users/:id actualiza nombre | 200 |
| PATCH /v1/users/:id limpia avatar con null | 200 |
| PATCH /v1/users/:id con campo email (no permitido) | 400 |
| PATCH /v1/users/:id otro usuario | 403 |
| PATCH /v1/users/999999 inexistente | 404 |
| DELETE /v1/users/:id otro usuario | 403 |
| DELETE /v1/users/999999 inexistente | 404 |
| DELETE /v1/users/:id propio + GET posterior | 204 → 404 |

> La creación de usuarios en e2e se hace directamente via `UsersService.create()` — no existe `POST /users` en el controller (el registro es responsabilidad del módulo `auth`).

---

## Swagger

Disponible en `/api/docs` una vez que la app está corriendo.

Decoradores aplicados:
- Controller: `@ApiTags('Users')`, `@ApiBearerAuth()`
- Cada endpoint: `@ApiOperation`, `@ApiResponse` (200/204/400/403/404), `@ApiParam` en rutas con `:id`
- DTOs: `@ApiProperty` con ejemplos en todos los campos

---

## Integración con otros módulos

```
AuthModule
  └── consume UsersService
        ├── create()          → POST /auth/register (crea usuario + perfil en transacción)
        ├── findByEmail()             → POST /auth/login (valida credenciales, retorna UserEntity con hash)
        ├── findOne()                 → JwtStrategy.validate() (verifica que el usuario exista y esté activo)
        ├── findEntityWithPassword()  → PATCH /v1/auth/change-password (expone hash con addSelect para comparar)
        ├── activate()                → GET /auth/activate (marca isActive = true con token)
        └── updatePassword()          → POST /auth/reset-password (hashea y actualiza password)

SeedModule
  └── crea RoleEntity al arrancar (SUPER_ADMIN, ADMIN, CLIENT)
        └── UserEntity.role apunta a uno de estos registros

UsersModule
  └── exporta UsersService (disponible para AuthModule vía import)
```
