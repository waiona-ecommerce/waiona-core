## TokenEntity — tokens de email para activación y reset

`TokenEntity` es la tabla en DB que almacena los tokens de un solo uso que se envían
por email. Los usa `AuthService` directamente (no a través de un service del módulo mail).

Hay dos tipos: activación de cuenta y reset de contraseña. El ciclo es siempre el mismo:
crear token → enviar por email → validar cuando el usuario hace clic → marcar como usado.

---

## La entidad

```ts
@Entity('tokens')
@Index(['token'], { unique: true })
// Índice único en token — es el campo de búsqueda principal (findOne por token).
// La búsqueda ocurre en cada click en un link de email, necesita ser rápida.

@Index(['userId', 'type'])
// Índice compuesto — se usa en forgotPassword para invalidar todos los tokens
// de reset previos de un usuario: UPDATE WHERE userId = X AND type = 'password_reset'.
// Sin este índice, esa operación haría un full scan de la tabla.
export class TokenEntity extends BaseEntity {

  @Column({ type: 'varchar', length: 255, nullable: false })
  token: string;
  // randomBytes(32).toString('hex') — 64 caracteres hexadecimales.
  // Se guarda el token en claro (a diferencia de los refresh tokens que
  // se guardan como hash SHA-256). Para tokens de email está aceptado
  // porque: (1) expiran en 1-24 horas, (2) son de un solo uso,
  // (3) el vector de ataque es el email del usuario, no la DB.

  @Column({ type: 'enum', enum: TokenType, nullable: false })
  type: TokenType;
  // 'account_activation' | 'password_reset'
  // Evita que un token de activación se use para resetear contraseña y viceversa.

  @Column({ name: 'user_id', type: 'int', nullable: false })
  userId: number;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
  // CASCADE — si el usuario se elimina, sus tokens se eliminan automáticamente.
  // Sin CASCADE, habría tokens huérfanos con userId que ya no existe.

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: false })
  expiresAt: Date;
  // timestamptz = timestamp with time zone — PostgreSQL lo guarda en UTC
  // y lo devuelve en la timezone de la sesión. Evita bugs con DST.
  // Activación: +24 horas. Reset: +1 hora.

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;
  // null = token aún válido. != null = ya fue usado.
  // Se marca con usedAt = new Date() en el momento de consumirlo.
  // No se borra físicamente — queda como registro de auditoría.

  get isExpired(): boolean {
    return new Date() > this.expiresAt;
    // Getter computado — no es una columna en DB, se evalúa en memoria.
    // Se llama en findValidToken() de AuthService para verificar sin lógica adicional.
  }

  get isUsed(): boolean {
    return this.usedAt !== null;
  }
}
```

---

## Enum de tipos

```ts
export enum TokenType {
  ACCOUNT_ACTIVATION = 'account_activation',
  PASSWORD_RESET     = 'password_reset',
}
// Los valores del enum son los que se guardan en la columna de PostgreSQL.
// TypeORM crea el tipo ENUM en la DB con estos valores exactos.
```

---

## Cómo los usa AuthService

### Crear un token

```ts
// En AuthService — método privado createToken()
private async createToken(
  userId: number,
  type: TokenType,
  expiresInHours: number,
): Promise<string> {
  const raw = randomBytes(32).toString('hex');
  // 32 bytes de entropía criptográfica → 64 caracteres hex.
  // Es impredecible por fuerza bruta — 2^256 posibilidades.

  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  const entity = this.tokenRepo.create({ token: raw, type, userId, expiresAt });
  await this.tokenRepo.save(entity);

  return raw;
  // Solo se retorna el raw aquí — después se pasa a MailService.sendActivationEmail()
  // que construye la URL y encola el job. AuthService no construye URLs.
}
```

### Validar un token

```ts
private async findValidToken(raw: string, type: TokenType): Promise<TokenEntity> {
  const tokenEntity = await this.tokenRepo.findOne({ where: { token: raw, type } });

  // Tres validaciones en orden específico:
  // 1. ¿Existe en DB? (podría ser un token inventado o de otro entorno)
  if (!tokenEntity) throw new BadRequestException('Token inválido o expirado');
  // El mensaje es genérico a propósito — no distingue "no existe" de "expirado"
  // para no dar información extra a un atacante.

  // 2. ¿Ya fue usado?
  if (tokenEntity.isUsed) throw new BadRequestException('El token ya fue utilizado');

  // 3. ¿Expiró?
  if (tokenEntity.isExpired) throw new BadRequestException('El token ha expirado');

  return tokenEntity;
}
```

### Consumir un token (marcarlo como usado)

```ts
// En activateAccount():
const tokenEntity = await this.findValidToken(token, TokenType.ACCOUNT_ACTIVATION);
tokenEntity.usedAt = new Date();  // ← marca como usado
await this.tokenRepo.save(tokenEntity);
// Después se llama a usersService.activate(tokenEntity.userId)
```

### Invalidar tokens previos al crear uno nuevo

```ts
// En forgotPassword() — antes de crear el nuevo token de reset:
await this.tokenRepo.update(
  { userId: user.id, type: TokenType.PASSWORD_RESET, usedAt: IsNull() },
  { usedAt: new Date() },
);
// IsNull() es un operador de TypeORM que genera WHERE used_at IS NULL.
// Solo invalida los tokens activos, no los que ya habían sido usados.
// Esto previene que un usuario tenga múltiples links de reset activos
// simultáneamente — si pedía un nuevo reset, el anterior quedaba inválido.
```

---

## Ciclo de vida de un token de activación

```
POST /auth/register
  → AuthService.register()
  → UsersService.create()                    → UserEntity { isActive: false }
  → createToken(userId, ACCOUNT_ACTIVATION, 24)
      → randomBytes(32) → raw token
      → TokenEntity { token, userId, type, expiresAt: +24h, usedAt: null }
      → guardado en DB
  → MailService.sendActivationEmail(email, name, raw)
      → encola job en Redis con activationUrl = `${frontendUrl}/auth/activate?token=${raw}`
  → 201

... el usuario hace clic en el link del email ...

GET /auth/activate?token=<raw>
  → AuthService.activateAccount(raw)
  → findValidToken(raw, ACCOUNT_ACTIVATION)
      → tokenRepo.findOne({ where: { token: raw, type: 'account_activation' } })
      → verifica isUsed = false, isExpired = false
  → tokenEntity.usedAt = new Date()   ← invalida el token
  → tokenRepo.save(tokenEntity)
  → usersService.activate(userId)     → user.isActive = true
  → 200 { message: 'Account activated successfully' }
```

---

## Ciclo de vida de un token de reset

```
POST /auth/forgot-password { email }
  → AuthService.forgotPassword(email)
  → usersService.findByEmail(email)
  → Si no existe o isActive = false → return (silencioso — no revela si el email existe)
  → tokenRepo.update({ userId, type: PASSWORD_RESET, usedAt: IsNull() }, { usedAt: now })
     ← invalida tokens de reset anteriores
  → createToken(userId, PASSWORD_RESET, 1)   ← expira en 1 hora
  → MailService.sendPasswordResetEmail(email, name, raw)
  → 200 { message: 'If the email exists, you will receive a reset link shortly' }

POST /auth/reset-password { token, password }
  → AuthService.resetPassword({ token, password })
  → findValidToken(token, PASSWORD_RESET)
  → tokenEntity.usedAt = new Date()
  → tokenRepo.save(tokenEntity)
  → usersService.updatePassword(userId, password)
     → el @BeforeInsert de UserEntity hashea con bcrypt automáticamente
  → 200 { message: 'Password reset successfully' }
```

---

## Por qué TokenEntity está en el módulo mail y no en auth

`AuthModule` consume `TokenEntity` directamente via `TypeOrmModule.forFeature([TokenEntity])`.
Está en el módulo mail porque el token es conceptualmente una pieza de la infraestructura
de email — nació para ser enviado por correo. Auth lo usa pero no lo posee.

Esta decisión tiene una consecuencia: `AuthModule` importa `MailModule` (para `MailService`)
y también registra `TokenEntity` por su cuenta. `MailModule` no exporta un service para
TokenEntity — Auth lo accede directamente al repositorio.
