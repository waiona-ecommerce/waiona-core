import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';

import { TaxesController } from '../../src/modules/taxation/taxes/controllers/taxes.controller';
import { TaxesService } from '../../src/modules/taxation/taxes/services/taxes.service';
import { TaxEntity } from '../../src/modules/taxation/taxes/entities/tax.entity';
import { TaxTypeEntity } from '../../src/modules/taxation/tax-types/entities/tax-types.entity';
import { TaxTypesController } from '../../src/modules/taxation/tax-types/controllers/tax-types.controller';
import { TaxTypesService } from '../../src/modules/taxation/tax-types/services/tax-types.service';

describe('Taxes (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let taxTypeId: number;

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
            entities: [TaxEntity, TaxTypeEntity],
            synchronize: true,
            dropSchema: true,
          }),
        }),
        TypeOrmModule.forFeature([TaxEntity, TaxTypeEntity]),
      ],
      controllers: [TaxesController, TaxTypesController],
      providers: [TaxesService, TaxTypesService],
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

    const res = await request(app.getHttpServer())
      .post('/tax-types')
      .send({ code: 'IVA', name: 'Impuesto al Valor Agregado' });

    taxTypeId = res.body.id;
  }, 30000);

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  // -------------------------
  // CREATE
  // -------------------------

  it('POST /tax-types/:id/taxes -> should create percentage tax', async () => {
    const res = await request(app.getHttpServer())
      .post(`/tax-types/${taxTypeId}/taxes`)
      .send({ value: 21, isPercentage: true })
      .expect(201);

    expect(res.body.value).toBe(21);
    expect(res.body.isPercentage).toBe(true);
    expect(res.body.taxTypeId).toBe(taxTypeId);
  });

  it('POST /tax-types/:id/taxes -> should create fixed tax with currency', async () => {
    const res = await request(app.getHttpServer())
      .post(`/tax-types/${taxTypeId}/taxes`)
      .send({ value: 50, isPercentage: false, currency: 'ARS' })
      .expect(201);

    expect(res.body.isPercentage).toBe(false);
    expect(res.body.currency).toBe('ARS');
  });

  it('POST /tax-types/:id/taxes -> should fail if fixed tax has no currency', async () => {
    await request(app.getHttpServer())
      .post(`/tax-types/${taxTypeId}/taxes`)
      .send({ value: 50, isPercentage: false })
      .expect(400);
  });

  it('POST /tax-types/:id/taxes -> should fail if percentage tax has currency', async () => {
    await request(app.getHttpServer())
      .post(`/tax-types/${taxTypeId}/taxes`)
      .send({ value: 21, isPercentage: true, currency: 'ARS' })
      .expect(400);
  });

  it('POST /tax-types/:id/taxes -> should fail if taxType not found', async () => {
    await request(app.getHttpServer())
      .post('/tax-types/999/taxes')
      .send({ value: 21, isPercentage: true })
      .expect(400);
  });

  it('POST /tax-types/:id/taxes -> should fail if value is negative', async () => {
    await request(app.getHttpServer())
      .post(`/tax-types/${taxTypeId}/taxes`)
      .send({ value: -5, isPercentage: true })
      .expect(400);
  });

  // -------------------------
  // FIND ALL
  // -------------------------

  it('GET /tax-types/:id/taxes -> should return array', async () => {
    const res = await request(app.getHttpServer())
      .get(`/tax-types/${taxTypeId}/taxes`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('GET /tax-types/:id/taxes -> should return empty array if no taxes', async () => {
    const newType = await request(app.getHttpServer())
      .post('/tax-types')
      .send({ code: 'IIBB', name: 'Ingresos Brutos' });

    const res = await request(app.getHttpServer())
      .get(`/tax-types/${newType.body.id}/taxes`)
      .expect(200);

    expect(res.body).toEqual([]);
  });

  // -------------------------
  // FIND ONE
  // -------------------------

  it('GET /tax-types/:id/taxes/:taxId -> should return one', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/tax-types/${taxTypeId}/taxes`)
      .send({ value: 10.5, isPercentage: true });

    const res = await request(app.getHttpServer())
      .get(`/tax-types/${taxTypeId}/taxes/${createRes.body.id}`)
      .expect(200);

    expect(res.body.value).toBe(10.5);
  });

  it('GET /tax-types/:id/taxes/:taxId -> should return 404', async () => {
    await request(app.getHttpServer())
      .get(`/tax-types/${taxTypeId}/taxes/999999`)
      .expect(404);
  });

  // -------------------------
  // UPDATE
  // -------------------------

  it('PATCH /tax-types/:id/taxes/:taxId -> should update value', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/tax-types/${taxTypeId}/taxes`)
      .send({ value: 5, isPercentage: true });

    const res = await request(app.getHttpServer())
      .patch(`/tax-types/${taxTypeId}/taxes/${createRes.body.id}`)
      .send({ value: 8 })
      .expect(200);

    expect(res.body.value).toBe(8);
  });

  it('PATCH /tax-types/:id/taxes/:taxId -> should fail if percentage tax gets currency', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/tax-types/${taxTypeId}/taxes`)
      .send({ value: 21, isPercentage: true });

    await request(app.getHttpServer())
      .patch(`/tax-types/${taxTypeId}/taxes/${createRes.body.id}`)
      .send({ currency: 'ARS' })
      .expect(400);
  });

  it('PATCH /tax-types/:id/taxes/:taxId -> should return 404 if not found', async () => {
    await request(app.getHttpServer())
      .patch(`/tax-types/${taxTypeId}/taxes/999999`)
      .send({ value: 10 })
      .expect(404);
  });

  // -------------------------
  // DELETE
  // -------------------------

  it('DELETE /tax-types/:id/taxes/:taxId -> should soft delete', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/tax-types/${taxTypeId}/taxes`)
      .send({ value: 3, isPercentage: true });

    await request(app.getHttpServer())
      .delete(`/tax-types/${taxTypeId}/taxes/${createRes.body.id}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/tax-types/${taxTypeId}/taxes/${createRes.body.id}`)
      .expect(404);
  });

  it('DELETE /tax-types/:id/taxes/:taxId -> should return 404 if not found', async () => {
    await request(app.getHttpServer())
      .delete(`/tax-types/${taxTypeId}/taxes/999999`)
      .expect(404);
  });
});
