# Seed — Análisis Técnico Completo

## ¿Qué es el módulo seed?

El módulo seed es un servicio de inicialización que corre automáticamente cada vez que la aplicación arranca, antes de que comience a aceptar tráfico. No expone endpoints HTTP — opera exclusivamente via el hook `OnApplicationBootstrap` de NestJS. Su responsabilidad es garantizar que la base de datos siempre tenga los datos mínimos necesarios para que el sistema funcione: los tres roles base y el usuario superadmin.

```
App arranca
  ↓
SeedService.onApplicationBootstrap()
  ↓
seedRoles()     → crea SUPER_ADMIN, ADMIN, CLIENT si no existen
  ↓
seedSuperAdmin() → crea usuario superadmin si no existe (isActive: true)
```

Es idempotente: puede ejecutarse en cada boot sin efectos secundarios — si los datos ya existen, no hace nada.

---

## Cuándo se usa en el negocio

| Escenario | Ejemplo |
|---|---|
| Primer deploy en producción | Crea los roles y el superadmin desde cero |
| Reinicio de la aplicación | Verifica que los datos existen — no hace nada si ya están |
| Reset de base de datos en desarrollo | Recrea los datos base automáticamente al levantar la app |

---

## Tipos de datos

### Roles creados (`RoleEntity`)

```typescript
{
  id:   number;
  type: 'super_admin' | 'admin' | 'client'; // RoleType enum
}
```

Los tres valores de `RoleType` se crean en orden. Si alguno ya existe, se saltea.

### Usuario superadmin creado (`UserEntity`)

```typescript
{
  email:    string;   // valor de SUPERADMIN_EMAIL (env var)
  password: string;   // valor de SUPERADMIN_PASSWORD (env var) — hasheado via @BeforeInsert con bcrypt
  isActive: true;     // explícito — sin esto el superadmin no puede hacer login (DB default es false)
  profile: {
    name:     'Super';
    lastName: 'Admin';
  };
  role: RoleEntity;   // el rol SUPER_ADMIN recién creado o existente
}
```

> El perfil se pasa como plain object — TypeORM lo crea via `cascade: true` en la relación `OneToOne` de `UserEntity`. No se necesita inyectar `ProfileRepository`.

---

## Lógica de inicialización

### `seedRoles()`

```typescript
for (const type of Object.values(RoleType)) {
  const existing = await this.roleRepo.findOne({ where: { type } });
  if (!existing) {
    await this.roleRepo.save(this.roleRepo.create({ type }));
  }
}
```

Itera los 3 valores del enum. Por cada uno: si no existe en la DB, lo crea. Si ya existe, lo saltea. N queries secuenciales (sin batch) — aceptable dado que ocurre una sola vez por boot y sobre 3 registros.

### `seedSuperAdmin()`

```typescript
const existing = await this.userRepo.findOne({
  where: { role: { type: RoleType.SUPER_ADMIN } },
});
if (existing) return;
// ... crea el superadmin
```

Busca si ya existe un usuario con rol `SUPER_ADMIN`. Si existe, retorna temprano. Si no, lee las credenciales del `ConfigService` y crea el usuario con `isActive: true`. El orden de ejecución garantiza que el rol ya existe cuando llega a este punto.

---

## Reglas de negocio

| Regla | Dónde se aplica |
|---|---|
| Siempre corre al arrancar | `implements OnApplicationBootstrap` |
| Idempotente — nunca duplica datos | `findOne` + early return antes de cada creación |
| `isActive: true` obligatorio en superadmin | Explícito en `userRepo.create()` — el default de la DB es `false` |
| Credenciales del superadmin vienen de env vars | `ConfigService<Env>` con `SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD` |
| La password se hashea automáticamente | `@BeforeInsert hashPassword()` en `UserEntity` — bcrypt, salt 10 |
| `seedRoles()` siempre corre antes que `seedSuperAdmin()` | Orden secuencial con `await` en `onApplicationBootstrap()` |
| No hay rollback manual | Si `seedRoles()` lanza, la excepción propaga y `seedSuperAdmin()` no corre |

---

## Variables de entorno requeridas

| Variable | Descripción |
|---|---|
| `SUPERADMIN_EMAIL` | Email del usuario superadmin |
| `SUPERADMIN_PASSWORD` | Contraseña en texto plano — se hashea antes de guardar |

Si alguna de estas variables no está definida, el usuario se creará con `undefined` como valor — el sistema no valida explícitamente su existencia. Deben estar configuradas antes del primer boot.

---

## Cumplimiento con agent skills

| Check | Estado |
|---|---|
| Sin controller — no expone endpoints HTTP | ✅ |
| `ConfigService<Env>` con `{ infer: true }` — nunca `process.env` directo | ✅ |
| `ProfileEntity` no inyectado — cascade maneja la creación del perfil | ✅ |
| `isActive: true` seteado explícitamente en el superadmin | ✅ |
| Idempotente — `findOne` + early return antes de cada escritura | ✅ |
| `roleRepo` y `userRepo` — únicos repos inyectados | ✅ |
| Unit tests con mocks de ambos repos + `ConfigService` | ✅ |
| No usa `DataSource.transaction()` — el cascade es suficiente para user+profile | ✅ |

---

## Tests

### Unit tests (`src/modules/seed/services/seed.service.spec.ts`)

```bash
npx jest --testPathPattern="seed" --no-coverage
```

| Suite | Tests | Cobertura |
|---|---|---|
| `SeedService` | 7 | defined (1), bootstrap llama ambos métodos (1), seedRoles crea cuando no existe (1), seedRoles saltea cuando existe (1), seedSuperAdmin crea cuando no existe (1), seedSuperAdmin saltea cuando existe (1), superadmin creado con isActive=true (1) |

> No hay tests E2E para este módulo — el seed corre al boot de la app y no expone endpoints HTTP. Los casos críticos (isActive, idempotencia) están cubiertos en unit tests.

---

## Integración con otros módulos

```
SeedModule
  ├── UserEntity       → verifica existencia del superadmin, lo crea
  │     └── cascade → ProfileEntity creado automáticamente
  └── RoleEntity       → crea los 3 roles base, asigna SUPER_ADMIN al superadmin

Los datos que crea SeedModule son consumidos por:
  ├── AuthModule       → login valida contra UserEntity (isActive, role)
  ├── RolesGuard       → lee RoleType del JWT payload
  └── UsersModule      → CRUD de usuarios usa RoleEntity para asignación de roles
```
