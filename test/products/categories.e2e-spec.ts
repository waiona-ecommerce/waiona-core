import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';

import { CategoryController } from '../../src/modules/products/categories/controllers/category.controller';
import { CategoryService } from '../../src/modules/products/categories/services/category.service';
import { CategoryEntity } from '../../src/modules/products/categories/entities/category.entity';
import { ProductEntity } from '../../src/modules/products/product/entities/product.entity';
import { ComboEntity } from '../../src/modules/products/combos/entities/combo.entity';

// ProductEntity y ComboEntity solo se usan en CategoryService para .count() en delete.
// Los mockeamos para evitar arrastrar toda su cadena de dependencias.
// El caso 409 "tiene productos/combos asignados" está cubierto en unit tests.
const mockCountRepo = () => ({ count: jest.fn().mockResolvedValue(0) });

describe('Categories (e2e)', () => {
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
            host: config.get('POSTGRES_HOST'),
            port: parseInt(config.get('POSTGRES_TEST_PORT') || '5433'),
            username: config.get('POSTGRES_USER'),
            password: config.get('POSTGRES_PASSWORD'),
            database: config.get('POSTGRES_TEST_DB'),
            entities: [CategoryEntity],
            synchronize: true,
            dropSchema: true,
          }),
        }),
        TypeOrmModule.forFeature([CategoryEntity]),
      ],
      controllers: [CategoryController],
      providers: [
        CategoryService,
        {
          provide: getRepositoryToken(ProductEntity),
          useFactory: mockCountRepo,
        },
        { provide: getRepositoryToken(ComboEntity), useFactory: mockCountRepo },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    dataSource = moduleFixture.get(DataSource);
  }, 30000);

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  // -------------------------
  // CREATE
  // -------------------------

  it('POST /categories → 201 con datos válidos', async () => {
    const res = await request(app.getHttpServer())
      .post('/categories')
      .send({
        name: 'Bebidas',
        description: 'Bebidas en general',
        isActive: true,
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Bebidas');
    expect(res.body.isActive).toBe(true);
    expect(res.body.parentId).toBeNull();
  });

  it('POST /categories → 400 con datos inválidos', async () => {
    await request(app.getHttpServer()).post('/categories').send({}).expect(400);
  });

  it('POST /categories → 201 con categoría padre', async () => {
    const parent = await request(app.getHttpServer())
      .post('/categories')
      .send({ name: 'Gaseosas', isActive: true })
      .expect(201);

    const child = await request(app.getHttpServer())
      .post('/categories')
      .send({ name: 'Cola', parentId: parent.body.id })
      .expect(201);

    expect(child.body.parentId).toBe(parent.body.id);
  });

  // -------------------------
  // GET ALL
  // -------------------------

  it('GET /categories → 200 paginado', async () => {
    const res = await request(app.getHttpServer())
      .get('/categories')
      .expect(200);

    expect(res.body.data).toBeDefined();
    expect(res.body.total).toBeGreaterThan(0);
  });

  // -------------------------
  // GET TREE
  // -------------------------

  it('GET /categories/tree → 200 árbol con hijos', async () => {
    const res = await request(app.getHttpServer())
      .get('/categories/tree')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    const root = res.body.find((c: any) => c.name === 'Gaseosas');
    expect(root).toBeDefined();
    expect(root.children).toBeDefined();
  });

  // -------------------------
  // GET BY ID
  // -------------------------

  it('GET /categories/:id → 200', async () => {
    const created = await request(app.getHttpServer())
      .post('/categories')
      .send({ name: 'Lácteos' });

    const res = await request(app.getHttpServer())
      .get(`/categories/${created.body.id}`)
      .expect(200);

    expect(res.body.name).toBe('Lácteos');
  });

  it('GET /categories/:id → 404 si no existe', async () => {
    await request(app.getHttpServer()).get('/categories/999999').expect(404);
  });

  // -------------------------
  // UPDATE
  // -------------------------

  it('PATCH /categories/:id → 200', async () => {
    const created = await request(app.getHttpServer())
      .post('/categories')
      .send({ name: 'Snacks' });

    const res = await request(app.getHttpServer())
      .patch(`/categories/${created.body.id}`)
      .send({ name: 'Snacks Premium', isActive: false })
      .expect(200);

    expect(res.body.name).toBe('Snacks Premium');
    expect(res.body.isActive).toBe(false);
  });

  it('PATCH /categories/:id → 404 si no existe', async () => {
    await request(app.getHttpServer())
      .patch('/categories/999999')
      .send({ name: 'Actualizado' })
      .expect(404);
  });

  // -------------------------
  // DELETE (soft)
  // -------------------------

  it('DELETE /categories/:id → 204 y luego 404', async () => {
    const created = await request(app.getHttpServer())
      .post('/categories')
      .send({ name: 'A borrar' });

    await request(app.getHttpServer())
      .delete(`/categories/${created.body.id}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/categories/${created.body.id}`)
      .expect(404);
  });

  it('DELETE /categories/:id → 404 si no existe', async () => {
    await request(app.getHttpServer()).delete('/categories/999999').expect(404);
  });
});
