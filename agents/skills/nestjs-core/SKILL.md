---
name: nestjs-core
description: >
  NestJS core conventions for this repo: module structure, controllers, services, global config, entity patterns, and unit testing.
  Load when creating modules, controllers, services, configuring the app bootstrap, or writing unit tests.
metadata:
  author: @rodrigozucchini
  version: "3.0"
---

# NestJS Core Skill

Defines the structural conventions, patterns, and rules for all NestJS modules in this project. Based on the actual codebase. Works alongside `nestjs-auth-jwt` (auth/guards) and `typeorm-standard` (entities/DTOs/transactions).

---

## When to Use This Skill

Load when the user:
- Creates a new module, controller, or service
- Configures `main.ts` or `app.module.ts`
- Writes or fixes unit tests (service spec or controller spec)
- Implements soft delete, findAll, findOne, or update patterns

Do NOT load when:
- Setting up Docker or database connection (use `nestjs-docker-postgres`)
- Implementing auth, guards, or JWT (use `nestjs-auth-jwt`)
- Writing migrations (use `postgres-standard`)
- Creating entities or DTOs in detail (use `typeorm-standard`)

---

## Core Rules

1. **All entities extend `BaseEntity`**: Every entity gets `id`, `createdAt`, `updatedAt`, `deletedAt` (`@DeleteDateColumn`).
2. **Soft delete only**: Never hard delete. Use `repo.softDelete(id)`.
3. **No manual filter needed**: TypeORM auto-adds `WHERE deletedAt IS NULL` via `@DeleteDateColumn`.
4. **Services return DTOs**: Never return raw entities from a service.
5. **`ParseIntPipe` on all ID params**: Every `:id` route param uses it.
6. **Specific routes before generic ones**: `GET /user/:userId` must come before `GET /:id`.
7. **Transactions for multi-table writes**: Use `dataSource.transaction()`.

---

## Project Structure

```
src/
├── main.ts                          # Bootstrap: GlobalPipe, GlobalInterceptor, PORT
├── app.module.ts                    # Root module: ConfigModule, TypeOrmModule, all modules
├── env.model.ts                     # Env interface (typed ConfigService)
├── common/
│   ├── decorators/roles.decorator.ts
│   ├── entities/base.entity.ts      # id, createdAt, updatedAt, deletedAt
│   ├── enums/
│   │   ├── role-type.enum.ts        # SUPER_ADMIN | ADMIN | CLIENT
│   │   └── currency-code.enum.ts
│   ├── guards/
│   │   ├── roles.guard.ts           # reads role from JWT — no DB query
│   │   └── guards.module.ts
│   └── theme/email-theme.ts         # colors + logo for email templates
└── modules/
    └── {module}/
        ├── {module}.module.ts
        ├── entities/{module}.entity.ts
        ├── dto/
        │   ├── create-{module}.dto.ts
        │   ├── update-{module}.dto.ts    → PartialType(CreateDto)
        │   └── {module}-response.dto.ts  → constructor(entity)
        ├── services/
        │   ├── {module}.service.ts
        │   └── {module}.service.spec.ts
        └── controllers/
            ├── {module}.controller.ts
            └── {module}.controller.spec.ts
```

---

## main.ts Bootstrap

```typescript
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor, VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // activa @Exclude() en todas las respuestas
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // URI versioning: todas las rutas de negocio bajo /v1/
  app.enableVersioning({ type: VersioningType.URI });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

---

## Controller Pattern

```typescript
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

@ApiTags('Nombres')
@ApiBearerAuth()
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ version: '1', path: 'nombres' })
export class NombreController {
  constructor(private readonly service: NombreService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nombre' })
  @ApiResponse({ status: 201, type: NombreResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'Ya existe' })
  create(@Body() dto: CreateNombreDto) { return this.service.create(dto); }

  @Get()
  @ApiOperation({ summary: 'Listar nombres paginados' })
  @ApiResponse({ status: 200, type: NombreResponseDto, isArray: true })
  findAll() { return this.service.findAll(); }

  // ⚠️ Specific routes BEFORE generic /:id
  @Get('by-product/:productId')
  findByProduct(@Param('productId', ParseIntPipe) productId: number) {
    return this.service.findByProduct(productId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener por ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: NombreResponseDto })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  findById(@Param('id', ParseIntPipe) id: number) { return this.service.findById(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar (parcial)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: NombreResponseDto })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNombreDto,
  ) { return this.service.update(id, dto); }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar (soft delete)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Eliminado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  delete(@Param('id', ParseIntPipe) id: number) { return this.service.delete(id); }
}
```

---

## Module Pattern

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([NombreEntity])],
  controllers: [NombreController],
  providers: [NombreService],
  exports: [NombreService], // only if other modules need it
})
export class NombreModule {}
```

**Rules:**
- Do NOT import `GuardsModule` — `RolesGuard` no longer needs `UserEntity`
- Import external modules instead of re-registering their entities
- Export services only when consumed by other modules

---

## Unit Test — Service Spec

```typescript
describe('NombreService', () => {
  let service: NombreService;
  let repo: any;

  const mockRepo = () => ({
    find: jest.fn(), findOne: jest.fn(),
    create: jest.fn(), save: jest.fn(), merge: jest.fn(),
  });

  // factory — always use overrides pattern
  const mockEntity = (overrides = {}): NombreEntity =>
    ({ id: 1, name: 'Test', deletedAt: null,
       createdAt: new Date(), updatedAt: new Date(), ...overrides }) as NombreEntity;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        NombreService,
        { provide: getRepositoryToken(NombreEntity), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get<NombreService>(NombreService);
    repo    = module.get(getRepositoryToken(NombreEntity));
  });

  afterEach(() => jest.clearAllMocks()); // always clear between tests

  describe('findAll', () => {
    it('should return all items', async () => {
      repo.find.mockResolvedValue([mockEntity()]);
      const result = await service.findAll();
      expect(result).toHaveLength(1);
    });

    it('should return empty array', async () => {
      repo.find.mockResolvedValue([]);
      expect(await service.findAll()).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return item', async () => {
      repo.findOne.mockResolvedValue(mockEntity());
      expect((await service.findById(1)).id).toBe(1);
    });

    it('should throw NotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });
});
```

---

## Unit Test — Controller Spec

```typescript
describe('NombreController', () => {
  let controller: NombreController;
  let service: jest.Mocked<NombreService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [NombreController],
      providers: [
        {
          provide: NombreService,
          useFactory: () => ({ findAll: jest.fn(), findById: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() }),
        },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt')).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<NombreController>(NombreController);
    service    = module.get(NombreService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  it('findAll delegates to service', async () => {
    service.findAll.mockResolvedValue([]);
    await controller.findAll();
    expect(service.findAll).toHaveBeenCalled();
  });
});
```

---

## env.model.ts

```typescript
export interface Env {
  POSTGRES_HOST: string;
  POSTGRES_PORT: number;
  POSTGRES_DB: string;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  JWT_SECRET: string;
  SUPERADMIN_EMAIL: string;
  SUPERADMIN_PASSWORD: string;
  MP_ACCESS_TOKEN: string;
  MP_PUBLIC_KEY: string;
  MP_NOTIFICATION_URL: string;
  MP_WEBHOOK_SECRET: string;
  FRONTEND_URL: string;
  RESEND_API_KEY: string;
  MAIL_FROM: string;
  API_URL: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
}
```

---

## Common Mistakes

- **Manual `deletedAt = new Date()`**: Use `repo.softDelete(id)` — `@DeleteDateColumn` handles filtering automatically.
- **Returning entities from services**: Always return DTOs.
- **Missing `ParseIntPipe`**: Allows string IDs to reach the service.
- **Specific route after `/:id`**: `GET /user/:userId` after `GET /:id` never matches — swap them.
- **Importing `GuardsModule` in feature modules**: Not needed — `RolesGuard` reads from JWT.
- **Multi-table writes without transaction**: Leaves DB in inconsistent state on failure.
- **`module.get()` inside `it()`**: Always assign repos to variables in `beforeEach`.

---

## Edge Cases

| Situation | How to handle it |
|-----------|-----------------|
| Service depends on multiple repos | Add each with `getRepositoryToken(Entity)` in spec providers |
| Service uses `DataSource` | Mock with `{ transaction: jest.fn(cb => cb(mockEntityManager)) }` |
| Controller reads `req.user` | Pass mock request `{ user: { sub: 1, role: RoleType.CLIENT } }` |
| `ConfigService` needed in spec | `{ provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('value') } }` |