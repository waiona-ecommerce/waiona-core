---
name: testing-standard
description: >
  Testing conventions for this repo: unit tests (Jest + mocks) and e2e tests (PostgreSQL real via Docker).
  Load when writing service specs, controller specs, or e2e tests.
metadata:
  author: @rodrigozucchini
  version: "1.0"
---

# Testing Standard Skill

---

## When to Use

Load when the user:
- Writes a service spec (`.service.spec.ts`)
- Writes a controller spec (`.controller.spec.ts`)
- Writes an e2e test (`.e2e-spec.ts`)
- Debugs a failing test

Do NOT load when:
- Writing production code (use `nestjs-core` or `typeorm-standard`)

---

## Two Types of Tests

| Type | Location | DB | What it tests |
|---|---|---|---|
| Unit | `src/modules/**/*.spec.ts` | No DB — mocked repos | Service logic and controller delegation |
| E2E | `test/**/*.e2e-spec.ts` | Real PostgreSQL | HTTP endpoints end-to-end |

---

## Unit Test — Service Spec

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { NombreService } from './nombre.service';
import { NombreEntity } from '../entities/nombre.entity';

describe('NombreService', () => {
  let service: NombreService;
  let repo: any;

  // mock del repositorio — sin DB real
  const mockRepo = () => ({
    find:         jest.fn(),
    findOne:      jest.fn(),
    findAndCount: jest.fn(),
    create:       jest.fn(),
    save:         jest.fn(),
    merge:        jest.fn(),
    softDelete:   jest.fn(),
  });

  // factory de datos de prueba — siempre con overrides
  const mockEntity = (overrides = {}): NombreEntity =>
    ({
      id: 1, name: 'Test', isActive: true, deletedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
      ...overrides,
    }) as unknown as NombreEntity;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NombreService,
        { provide: getRepositoryToken(NombreEntity), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get<NombreService>(NombreService);
    repo    = module.get(getRepositoryToken(NombreEntity));
  });

  afterEach(() => jest.clearAllMocks()); // siempre limpiar entre tests

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
    it('should return item by id', async () => {
      repo.findOne.mockResolvedValue(mockEntity());
      expect((await service.findById(1)).id).toBe(1);
    });

    it('should throw NotFoundException if not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create and return item', async () => {
      const entity = mockEntity();
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);
      const result = await service.create({ name: 'Test' } as any);
      expect(result.name).toBe('Test');
    });
  });

  describe('delete', () => {
    it('should soft delete', async () => {
      const entity = mockEntity();
      repo.findOne.mockResolvedValue(entity);
      repo.softDelete.mockResolvedValue(undefined);
      await service.delete(1);
      expect(repo.softDelete).toHaveBeenCalledWith(entity.id);
    });

    it('should throw NotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
    });
  });
});
```

**Si el service usa `DataSource` (transacciones):**

```typescript
const mockEntityManager = { create: jest.fn(), save: jest.fn(), findOne: jest.fn() };
const mockDataSource    = { transaction: jest.fn(cb => cb(mockEntityManager)) };

// en providers:
{ provide: DataSource, useValue: mockDataSource }

// verificar que se usó la transacción:
expect(mockDataSource.transaction).toHaveBeenCalled();
```

---

## Unit Test — Controller Spec

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { RoleType } from 'src/common/enums/role-type.enum';

describe('NombreController', () => {
  let controller: NombreController;
  let service: jest.Mocked<NombreService>;

  const mockService    = () => ({ findAll: jest.fn(), findById: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() });
  const mockAuthGuard  = { canActivate: jest.fn(() => true) };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };

  // helper para request con usuario mockeado
  const mockRequest = (sub: number, role = RoleType.CLIENT) =>
    ({ user: { sub, role } }) as any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [NombreController],
      providers: [
        { provide: NombreService, useFactory: mockService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt')).useValue(mockAuthGuard)
      .overrideGuard(RolesGuard).useValue(mockRolesGuard)
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

## E2E Test — PostgreSQL Real

Los e2e usan la **DB de test** (puerto 5433) levantada con Docker. No SQLite — PostgreSQL garantiza tipos de datos correctos (enums, timestamps, soft delete, etc.).

Variables de entorno para e2e:
```
POSTGRES_TEST_PORT=5433
POSTGRES_TEST_DB=waiona_test
```

### Setup requerido

```bash
docker compose up -d
npx jest --config test/jest-e2e.json --testPathPattern="nombre"
```

### Ubicación

```
test/
└── {modulo}/
    └── {modulo}.e2e-spec.ts
```

### Configuración del módulo e2e

```typescript
// test/nombre/nombre.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';

describe('Nombre (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            type: 'postgres',
            host:     config.get('POSTGRES_HOST'),
            port:     parseInt(config.get('POSTGRES_TEST_PORT') || '5433'),
            username: config.get('POSTGRES_USER'),
            password: config.get('POSTGRES_PASSWORD'),
            database: config.get('POSTGRES_TEST_DB'),
            entities: [NombreEntity],   // solo las entidades del módulo
            synchronize: true,
            dropSchema: true,           // limpia la DB antes de cada suite
          }),
        }),
        TypeOrmModule.forFeature([NombreEntity]),
      ],
      controllers: [NombreController],
      providers: [NombreService],
    })
      .overrideGuard(AuthGuard('jwt')).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));

    await app.init();
    dataSource = moduleFixture.get(DataSource);
  }, 30000); // timeout para conexión inicial a PostgreSQL

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  // -------------------------
  // CREATE
  // -------------------------

  it('POST /nombres -> 201 con datos correctos', async () => {
    const res = await request(app.getHttpServer())
      .post('/nombres')
      .send({ name: 'Test' })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Test');
  });

  it('POST /nombres -> 400 con datos inválidos', async () => {
    await request(app.getHttpServer())
      .post('/nombres')
      .send({})
      .expect(400);
  });

  // -------------------------
  // GET
  // -------------------------

  it('GET /nombres -> 200 array', async () => {
    const res = await request(app.getHttpServer()).get('/nombres').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /nombres/:id -> 404 si no existe', async () => {
    await request(app.getHttpServer()).get('/nombres/999').expect(404);
  });

  // -------------------------
  // DELETE (soft)
  // -------------------------

  it('DELETE /nombres/:id -> 204 y luego 404', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/nombres')
      .send({ name: 'A borrar' });

    await request(app.getHttpServer())
      .delete(`/nombres/${createRes.body.id}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/nombres/${createRes.body.id}`)
      .expect(404);
  });
});
```

### Cross-module repo dependencies en e2e

Cuando el service inyecta repositorios de otros módulos (solo para validaciones, no para crear datos), incluirlos en el schema arrastraría toda su cadena de entidades relacionadas. En ese caso: **mockeá esos repos** y registrá solo la entidad principal del módulo.

```typescript
// El service inyecta ProductPricingEntity para verificar si un margen está en uso.
// ProductPricingEntity → ProductEntity → CategoryEntity... demasiadas dependencias.
// Se mockea con findOne: null (sin uso) — el caso 409 queda cubierto en unit tests.

const mockPricingRepo = () => ({ findOne: jest.fn().mockResolvedValue(null) });

providers: [
  NombreService,
  { provide: getRepositoryToken(RelatedEntity), useFactory: mockPricingRepo },
],
```

### Correr los e2e

```bash
# levantar DB primero
docker compose up -d

# correr e2e
npx jest --config test/jest-e2e.json

# correr módulo específico
npx jest --config test/jest-e2e.json --testPathPattern="margins"
```

---

## Comandos

```bash
# Unit tests
npx jest                                    # todos
npx jest --testPathPattern="orders"         # módulo específico
npx jest --coverage                         # con coverage

# E2E tests (requiere Docker corriendo)
npx jest --config test/jest-e2e.json
```

---

## Common Mistakes

- **SQLite en e2e**: Tipos de datos distintos a PostgreSQL — usar siempre PostgreSQL real.
- **`dropSchema: false` en e2e**: Los tests se contaminan entre runs — siempre `dropSchema: true`.
- **`module.get()` dentro de `it()`**: Siempre asignar repos a variables en `beforeEach`.
- **Sin `afterEach(() => jest.clearAllMocks())`**: Mocks de un test contaminan el siguiente.
- **Sin `await app.close()` en `afterAll`**: Conexiones colgadas que hacen que Jest no termine.
- **Olvidar `overrideGuard`**: Tests e2e fallan con 401/403 sin esto.