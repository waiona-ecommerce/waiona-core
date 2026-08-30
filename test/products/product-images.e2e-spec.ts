import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../src/common/guards/roles.guard';

import { ProductImageController } from '../../src/modules/products/product-images/controllers/product-image.controller';
import { ProductImageService } from '../../src/modules/products/product-images/services/product-image.service';
import { ProductImageEntity } from '../../src/modules/products/product-images/entities/product-image.entity';
import { ProductEntity } from '../../src/modules/products/product/entities/product.entity';
import { ComboEntity } from '../../src/modules/products/combos/entities/combo.entity';
import { ComboItemEntity } from '../../src/modules/products/combos/entities/combo-item.entity';
import { ComboImageEntity } from '../../src/modules/products/combo-images/entities/combo-image.entity';
import { CategoryEntity } from '../../src/modules/products/categories/entities/category.entity';
import { ProductMeasurementUnit } from '../../src/modules/products/product/enums/product-measurement-unit.enum';
import { StorageService } from '../../src/modules/storage/storage.service';

describe('ProductImages (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let productId: number;
  let categoryId: number;

  const mockUpload = jest.fn();
  const mockDelete = jest.fn();

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
            entities: [
              ProductImageEntity,
              ProductEntity,
              ComboEntity,
              ComboItemEntity,
              ComboImageEntity,
              CategoryEntity,
            ],
            synchronize: true,
            dropSchema: true,
          }),
        }),
        TypeOrmModule.forFeature([ProductImageEntity, ProductEntity]),
      ],
      controllers: [ProductImageController],
      providers: [
        ProductImageService,
        {
          provide: StorageService,
          useValue: { upload: mockUpload, delete: mockDelete },
        },
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

    app.enableVersioning({ type: VersioningType.URI });
    await app.init();
    dataSource = moduleFixture.get(DataSource);

    const category = await dataSource.getRepository(CategoryEntity).save({
      name: 'Bebidas',
      isActive: true,
    });
    const product = await dataSource.getRepository(ProductEntity).save({
      sku: 'IMG-TEST-001',
      name: 'Coca Cola',
      description: 'Gaseosa 500ml',
      isActive: true,
      categoryId: category.id,
      measurementUnit: ProductMeasurementUnit.UNIT,
    });
    productId = product.id;
    categoryId = category.id;
  }, 30000);

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  beforeEach(() => {
    mockUpload.mockReset().mockResolvedValue({
      url: 'https://cdn.example.com/img.jpg',
      publicId: 'test/img',
    });
    mockDelete.mockReset().mockResolvedValue(undefined);
  });

  // -------------------------
  // CREATE
  // -------------------------

  it('POST /product-images → 201 con datos válidos', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/product-images')
      .send({ productId, url: 'https://img.com/coca1.jpg', position: 1 })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.productId).toBe(productId);
    expect(res.body.position).toBe(1);
  });

  it('POST /product-images → 404 si producto no existe', async () => {
    await request(app.getHttpServer())
      .post('/v1/product-images')
      .send({ productId: 999999, url: 'https://img.com/x.jpg', position: 1 })
      .expect(404);
  });

  it('POST /product-images → 400 con datos inválidos', async () => {
    await request(app.getHttpServer())
      .post('/v1/product-images')
      .send({})
      .expect(400);
  });

  it('POST /product-images → 409 si la posición ya está ocupada', async () => {
    await request(app.getHttpServer())
      .post('/v1/product-images')
      .send({ productId, url: 'https://img.com/coca-dup-a.jpg', position: 20 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/v1/product-images')
      .send({ productId, url: 'https://img.com/coca-dup-b.jpg', position: 20 })
      .expect(409);
  });

  // -------------------------
  // GET ALL BY PRODUCT
  // -------------------------

  it('GET /product-images/product/:productId → 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/product-images/product/${productId}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  // -------------------------
  // GET BY ID
  // -------------------------

  it('GET /product-images/:id → 200', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/product-images')
      .send({ productId, url: 'https://img.com/coca2.jpg', position: 2 });

    await request(app.getHttpServer())
      .get(`/v1/product-images/${created.body.id}`)
      .expect(200);
  });

  it('GET /product-images/:id → 404 si no existe', async () => {
    await request(app.getHttpServer())
      .get('/v1/product-images/999999')
      .expect(404);
  });

  // -------------------------
  // UPDATE
  // -------------------------

  it('PATCH /product-images/:id → 200', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/product-images')
      .send({ productId, url: 'https://img.com/coca3.jpg', position: 3 });

    const res = await request(app.getHttpServer())
      .patch(`/v1/product-images/${created.body.id}`)
      .send({ position: 10 })
      .expect(200);

    expect(res.body.position).toBe(10);
  });

  it('PATCH /product-images/:id → 404 si no existe', async () => {
    await request(app.getHttpServer())
      .patch('/v1/product-images/999999')
      .send({ position: 1 })
      .expect(404);
  });

  it('PATCH /product-images/:id → 409 si la nueva posición ya está ocupada', async () => {
    const first = await request(app.getHttpServer())
      .post('/v1/product-images')
      .send({
        productId,
        url: 'https://img.com/coca-patch-a.jpg',
        position: 21,
      });

    await request(app.getHttpServer()).post('/v1/product-images').send({
      productId,
      url: 'https://img.com/coca-patch-b.jpg',
      position: 22,
    });

    await request(app.getHttpServer())
      .patch(`/v1/product-images/${first.body.id}`)
      .send({ position: 22 })
      .expect(409);
  });

  // -------------------------
  // DELETE (soft)
  // -------------------------

  it('DELETE /product-images/:id → 204 y luego 404', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/product-images')
      .send({ productId, url: 'https://img.com/coca4.jpg', position: 4 });

    await request(app.getHttpServer())
      .delete(`/v1/product-images/${created.body.id}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/v1/product-images/${created.body.id}`)
      .expect(404);
  });

  it('DELETE /product-images/:id → 404 si no existe', async () => {
    await request(app.getHttpServer())
      .delete('/v1/product-images/999999')
      .expect(404);
  });

  // -------------------------
  // UPLOAD (multipart → Cloudinary)
  // -------------------------

  describe('UPLOAD', () => {
    const attachFile = (
      req: request.Test,
      filename = 'test.jpg',
      contentType = 'image/jpeg',
    ) =>
      req.attach('file', Buffer.from('fake-image-data'), {
        filename,
        contentType,
      });

    it('POST /product-images/upload → 201 con archivo válido', async () => {
      const res = await attachFile(
        request(app.getHttpServer())
          .post('/v1/product-images/upload')
          .field('productId', String(productId))
          .field('position', '30'),
      ).expect(201);

      expect(res.body.url).toBe('https://cdn.example.com/img.jpg');
      expect(mockUpload).toHaveBeenCalledWith(
        expect.anything(),
        'waiona/products',
      );
    });

    it('POST /product-images/upload → 400 si no se envía archivo', async () => {
      await request(app.getHttpServer())
        .post('/v1/product-images/upload')
        .field('productId', String(productId))
        .field('position', '31')
        .expect(400);

      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('POST /product-images/upload → 400 si el tipo de archivo no está permitido', async () => {
      await attachFile(
        request(app.getHttpServer())
          .post('/v1/product-images/upload')
          .field('productId', String(productId))
          .field('position', '32'),
        'test.txt',
        'text/plain',
      ).expect(400);

      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('POST /product-images/upload → 404 si el producto no existe', async () => {
      await attachFile(
        request(app.getHttpServer())
          .post('/v1/product-images/upload')
          .field('productId', '999999')
          .field('position', '1'),
      ).expect(404);

      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('POST /product-images/upload → 409 si la posición ya está ocupada', async () => {
      await request(app.getHttpServer()).post('/v1/product-images').send({
        productId,
        url: 'https://img.com/coca-upload-dup.jpg',
        position: 33,
      });

      await attachFile(
        request(app.getHttpServer())
          .post('/v1/product-images/upload')
          .field('productId', String(productId))
          .field('position', '33'),
      ).expect(409);

      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('POST /product-images/upload → 404 y elimina el archivo de Cloudinary si el producto fue eliminado durante el upload', async () => {
      const tempProduct = await dataSource.getRepository(ProductEntity).save({
        sku: `ROLLBACK-DEL-${Date.now()}`,
        name: 'Producto Temporal',
        description: 'Para test de rollback',
        isActive: true,
        categoryId,
        measurementUnit: ProductMeasurementUnit.UNIT,
      });

      mockUpload.mockImplementationOnce(async () => {
        await dataSource.getRepository(ProductEntity).delete(tempProduct.id);
        return {
          url: 'https://cdn.example.com/rollback-deleted.jpg',
          publicId: 'test/rollback-deleted-product',
        };
      });

      await attachFile(
        request(app.getHttpServer())
          .post('/v1/product-images/upload')
          .field('productId', String(tempProduct.id))
          .field('position', '1'),
      ).expect(404);

      expect(mockDelete).toHaveBeenCalledWith('test/rollback-deleted-product');

      const persisted = await dataSource
        .getRepository(ProductImageEntity)
        .findOne({ where: { publicId: 'test/rollback-deleted-product' } });
      expect(persisted).toBeNull();
    });

    it('POST /product-images/upload → 409 y elimina el archivo de Cloudinary si la posición fue tomada durante el upload', async () => {
      const tempProduct = await dataSource.getRepository(ProductEntity).save({
        sku: `ROLLBACK-RACE-${Date.now()}`,
        name: 'Producto Temporal Race',
        description: 'Para test de rollback',
        isActive: true,
        categoryId,
        measurementUnit: ProductMeasurementUnit.UNIT,
      });

      mockUpload.mockImplementationOnce(async () => {
        await dataSource.getRepository(ProductImageEntity).save({
          productId: tempProduct.id,
          url: 'https://img.com/race-winner.jpg',
          position: 1,
        });
        return {
          url: 'https://cdn.example.com/rollback-race.jpg',
          publicId: 'test/rollback-race',
        };
      });

      await attachFile(
        request(app.getHttpServer())
          .post('/v1/product-images/upload')
          .field('productId', String(tempProduct.id))
          .field('position', '1'),
      ).expect(409);

      expect(mockDelete).toHaveBeenCalledWith('test/rollback-race');

      const persisted = await dataSource
        .getRepository(ProductImageEntity)
        .findOne({ where: { publicId: 'test/rollback-race' } });
      expect(persisted).toBeNull();
    });
  });
});
