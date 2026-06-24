import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { OrdersService } from './orders.service';
import { OrderEntity } from '../entities/order.entity';
import { OrderItemEntity } from '../entities/order-item.entity';
import { ProductEntity } from '../../products/product/entities/product.entity';
import { ComboEntity } from '../../products/combos/entities/combo.entity';
import { CouponEntity } from '../../coupons/coupon/entities/coupon.entity';
import { CouponUsageEntity } from '../../coupons/usage/entities/coupon-usage.entity';
import { StockItemEntity } from '../../stocks/stock-item/entities/stock-item.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { StockItemsService } from '../../stocks/stock-item/services/stock-item.service';
import { CalculationService } from '../../pricing/calculation/services/calculation.service';
import { MailService } from '../../mail/services/mail.service';
import { OrderStatus } from '../enums/order-status.enum';
import { DeliveryType } from '../enums/delivery-type.enum';

describe('OrdersService', () => {
  let service: OrdersService;

  const mockOrderRepo = () => ({
    find: jest.fn(),
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  });
  const mockOrderItemRepo = () => ({ create: jest.fn() });
  const mockProductRepo = () => ({ findOne: jest.fn() });
  const mockComboRepo = () => ({ findOne: jest.fn() });
  const mockCouponRepo = () => ({ findOne: jest.fn(), save: jest.fn() });
  const mockStockItemRepo = () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
  });
  const mockUserRepo = () => ({ findOne: jest.fn() });
  const mockStockService = () => ({
    reserveStock: jest.fn(),
    dispatchStock: jest.fn(),
    releaseReservation: jest.fn(),
  });
  const mockCalcService = () => ({
    calculateProduct: jest.fn(),
    calculateCombo: jest.fn(),
  });
  const mockMailService = () => ({
    sendOrderConfirmedEmail: jest.fn().mockResolvedValue(undefined),
    sendOrderDispatchedEmail: jest.fn().mockResolvedValue(undefined),
    sendOrderCancelledEmail: jest.fn().mockResolvedValue(undefined),
    sendOrderDeliveredEmail: jest.fn().mockResolvedValue(undefined),
  });

  // Repo devuelto por manager.getRepository() — para reserveStock dentro de la transacción
  const mockManagerRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };
  const mockEntityManager = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
    getRepository: jest.fn(() => mockManagerRepo),
  };
  const mockDataSource = {
    transaction: jest.fn((cb) => cb(mockEntityManager)),
  };

  const mockUser = (overrides: any = {}) => ({
    id: 1,
    email: 'juan@test.com',
    isDeleted: false,
    ...overrides,
  });
  const mockProduct = (overrides: any = {}) => ({
    id: 1,
    name: 'Coca Cola 500ml',
    isDeleted: false,
    ...overrides,
  });
  const mockStock = (overrides: any = {}) => {
    const q = { quantityCurrent: 10, quantityReserved: 2, ...overrides };
    return {
      id: 1,
      productId: 1,
      locationId: 1,
      isDeleted: false,
      ...q,
      quantityAvailable: q.quantityCurrent - q.quantityReserved,
    };
  };
  const mockBreakdown = (overrides: any = {}) => ({
    unitPrice: 500,
    salePrice: 600,
    discount: 0,
    finalPrice: 653.4,
    fullPrice: 726,
    coupon: 0,
    orderTotal: 653.4,
    ...overrides,
  });
  const mockCombo = (overrides: any = {}) => ({
    id: 1,
    name: 'Combo Test',
    isDeleted: false,
    items: [
      { productId: 10, quantity: 2 },
      { productId: 11, quantity: 1 },
    ],
    ...overrides,
  });
  const mockOrder = (overrides: any = {}): OrderEntity => ({
    id: 1,
    status: OrderStatus.PENDING,
    subtotal: 653.4,
    total: 653.4,
    isDeleted: false,
    items: [
      {
        id: 1,
        quantity: 1,
        locationId: 1,
        product: mockProduct(),
        combo: null,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
  const mockComboOrder = (overrides: any = {}): OrderEntity => ({
    id: 1,
    status: OrderStatus.CONFIRMED,
    subtotal: 653.4,
    total: 653.4,
    isDeleted: false,
    items: [
      {
        id: 2,
        quantity: 2,
        locationId: null,
        product: null,
        combo: { id: 1 },
        comboReservations: [
          { productId: 10, locationId: 3, quantity: 4 },
          { productId: 11, locationId: 3, quantity: 2 },
        ],
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  let orderRepo: any;
  let productRepo: any;
  let comboRepo: any;
  let userRepo: any;
  let stockService: any;
  let calcService: any;
  let orderItemRepo: any;
  let mailService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(OrderEntity), useFactory: mockOrderRepo },
        {
          provide: getRepositoryToken(OrderItemEntity),
          useFactory: mockOrderItemRepo,
        },
        {
          provide: getRepositoryToken(ProductEntity),
          useFactory: mockProductRepo,
        },
        { provide: getRepositoryToken(ComboEntity), useFactory: mockComboRepo },
        {
          provide: getRepositoryToken(CouponEntity),
          useFactory: mockCouponRepo,
        },
        {
          provide: getRepositoryToken(StockItemEntity),
          useFactory: mockStockItemRepo,
        },
        { provide: getRepositoryToken(UserEntity), useFactory: mockUserRepo },
        { provide: StockItemsService, useFactory: mockStockService },
        { provide: CalculationService, useFactory: mockCalcService },
        { provide: MailService, useFactory: mockMailService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    orderRepo = module.get(getRepositoryToken(OrderEntity));
    productRepo = module.get(getRepositoryToken(ProductEntity));
    comboRepo = module.get(getRepositoryToken(ComboEntity));
    userRepo = module.get(getRepositoryToken(UserEntity));
    stockService = module.get(StockItemsService);
    calcService = module.get(CalculationService);
    orderItemRepo = module.get(getRepositoryToken(OrderItemEntity));
    mailService = module.get(MailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // resetear el repo del manager explícitamente (es singleton fuera del TestingModule)
    Object.values(mockManagerRepo).forEach((fn) => fn.mockReset?.());
  });

  // ==========================
  // create
  // ==========================

  describe('create', () => {
    const dto = {
      items: [{ productId: 1, quantity: 2 }],
      deliveryType: DeliveryType.PICKUP,
    };

    it('should create an order with product in transaction', async () => {
      const order = mockOrder();
      userRepo.findOne.mockResolvedValue(mockUser());
      productRepo.findOne.mockResolvedValue(mockProduct());
      calcService.calculateProduct.mockResolvedValue(mockBreakdown());
      orderItemRepo.create.mockReturnValue({});
      // findAvailableStockItem ahora usa manager.find dentro de la transacción
      mockEntityManager.find.mockResolvedValue([mockStock()]);
      mockEntityManager.create.mockReturnValue(order);
      mockEntityManager.save.mockResolvedValue(order);
      mockManagerRepo.findOne.mockResolvedValue(mockStock()); // reserveStock usa manager.getRepository().findOne
      mockManagerRepo.save.mockResolvedValue(undefined);
      stockService.reserveStock.mockResolvedValue(undefined);

      const result = await service.create(1, dto);

      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(stockService.reserveStock).toHaveBeenCalled();
      expect(result.id).toBe(1);
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.create(99, dto as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if item has no productId or comboId', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      await expect(
        service.create(1, {
          items: [{ quantity: 1 }],
          deliveryType: DeliveryType.PICKUP,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if item has both productId and comboId', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      await expect(
        service.create(1, {
          items: [{ productId: 1, comboId: 1, quantity: 1 }],
          deliveryType: DeliveryType.PICKUP,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if delivery without address', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      await expect(
        service.create(1, {
          items: [{ productId: 1, quantity: 1 }],
          deliveryType: DeliveryType.DELIVERY,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if product not found', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      productRepo.findOne.mockResolvedValue(null);
      await expect(service.create(1, dto as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if no stock exists for product', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      productRepo.findOne.mockResolvedValue(mockProduct());
      calcService.calculateProduct.mockResolvedValue(mockBreakdown());
      orderItemRepo.create.mockReturnValue({});
      // manager.find devuelve array vacío → no hay stock items para ese producto
      mockEntityManager.find.mockResolvedValue([]);
      await expect(service.create(1, dto as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if insufficient stock', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      productRepo.findOne.mockResolvedValue(mockProduct());
      calcService.calculateProduct.mockResolvedValue(mockBreakdown());
      orderItemRepo.create.mockReturnValue({});
      // findAvailableStockItem usa manager.find dentro de la transacción
      mockEntityManager.find.mockResolvedValue([
        mockStock({ quantityCurrent: 2, quantityReserved: 1 }),
      ]);
      await expect(
        service.create(1, {
          items: [{ productId: 1, quantity: 5 }],
          deliveryType: DeliveryType.PICKUP,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if coupon already used by user', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      productRepo.findOne.mockResolvedValue(mockProduct());
      calcService.calculateProduct.mockResolvedValue(mockBreakdown());
      orderItemRepo.create.mockReturnValue({});
      // findAvailableStockItem dentro de la transacción
      mockEntityManager.find.mockResolvedValue([mockStock()]);
      // findOne(CouponEntity) → cupón, findOne(CouponUsageEntity) → ya usado
      mockEntityManager.findOne
        .mockResolvedValueOnce({
          id: 1,
          code: 'DESC10',
          usageLimit: null,
          usageCount: 0,
          startsAt: null,
          endsAt: null,
        })
        .mockResolvedValueOnce({ id: 1 });

      await expect(
        service.create(1, { ...dto, couponCode: 'DESC10' } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if coupon not found in transaction', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      productRepo.findOne.mockResolvedValue(mockProduct());
      calcService.calculateProduct.mockResolvedValue(mockBreakdown());
      orderItemRepo.create.mockReturnValue({});
      // findAvailableStockItem dentro de la transacción
      mockEntityManager.find.mockResolvedValue([mockStock()]);
      // findOne(CouponEntity) → null → NotFoundException
      mockEntityManager.findOne.mockResolvedValueOnce(null);

      await expect(
        service.create(1, { ...dto, couponCode: 'NOEXISTE' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if coupon is expired', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      productRepo.findOne.mockResolvedValue(mockProduct());
      calcService.calculateProduct.mockResolvedValue(mockBreakdown());
      orderItemRepo.create.mockReturnValue({});
      mockEntityManager.find.mockResolvedValue([mockStock()]);
      mockEntityManager.findOne.mockResolvedValueOnce({
        id: 1,
        code: 'VENCIDO',
        usageLimit: null,
        usageCount: 0,
        startsAt: null,
        endsAt: new Date(Date.now() - 60_000), // expirado hace 1 minuto
      });

      await expect(
        service.create(1, { ...dto, couponCode: 'VENCIDO' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if coupon usage limit is reached', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      productRepo.findOne.mockResolvedValue(mockProduct());
      calcService.calculateProduct.mockResolvedValue(mockBreakdown());
      orderItemRepo.create.mockReturnValue({});
      mockEntityManager.find.mockResolvedValue([mockStock()]);
      mockEntityManager.findOne.mockResolvedValueOnce({
        id: 1,
        code: 'AGOTADO',
        usageLimit: 10,
        usageCount: 10, // límite alcanzado
        startsAt: null,
        endsAt: null,
      });

      await expect(
        service.create(1, { ...dto, couponCode: 'AGOTADO' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if coupon does not apply to any item', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      productRepo.findOne.mockResolvedValue(mockProduct());
      calcService.calculateProduct.mockResolvedValue(mockBreakdown());
      orderItemRepo.create.mockReturnValue({});
      // findAvailableStockItem (stock) → producto válido; luego target query devuelve []
      mockEntityManager.find
        .mockResolvedValueOnce([mockStock()]) // stock para el producto
        .mockResolvedValueOnce([]); // CouponProductTargetEntity: sin targets
      // cupón válido no global, sin uso previo
      mockEntityManager.findOne
        .mockResolvedValueOnce({
          id: 1,
          code: 'NOAPLICA',
          value: 10,
          isGlobal: false,
          usageLimit: null,
          usageCount: 0,
          startsAt: null,
          endsAt: null,
        })
        .mockResolvedValueOnce(null); // sin uso previo

      await expect(
        service.create(1, { ...dto, couponCode: 'NOAPLICA' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create an order with a global coupon, increment usageCount, and register usage', async () => {
      const coupon = {
        id: 5,
        code: 'GLOBAL10',
        value: 10,
        isGlobal: true,
        usageLimit: 100,
        usageCount: 5,
        startsAt: null,
        endsAt: null,
      };
      const order = mockOrder({
        subtotal: 653.4,
        total: 588.06,
        couponDiscount: 65.34,
      });

      userRepo.findOne.mockResolvedValue(mockUser());
      productRepo.findOne.mockResolvedValue(mockProduct());
      calcService.calculateProduct.mockResolvedValue(mockBreakdown());
      orderItemRepo.create.mockReturnValue({});

      // Dentro de la transacción:
      // 1. manager.find(StockItemEntity) → stock OK
      // 2. findOne(CouponEntity) con lock → cupón válido
      // 3. findOne(CouponUsageEntity) → null (no usado antes)
      mockEntityManager.find.mockResolvedValue([mockStock()]);
      mockEntityManager.findOne
        .mockResolvedValueOnce(coupon)
        .mockResolvedValueOnce(null);

      const mockUsage = { couponId: 5, userId: 1, orderId: 1 };
      mockEntityManager.create
        .mockReturnValueOnce(order) // manager.create(OrderEntity, ...)
        .mockReturnValueOnce(mockUsage); // manager.create(CouponUsageEntity, ...)
      mockEntityManager.save
        .mockResolvedValueOnce(order)
        .mockResolvedValueOnce({ ...coupon, usageCount: 6 })
        .mockResolvedValueOnce(undefined);
      mockManagerRepo.findOne.mockResolvedValue(mockStock());
      mockManagerRepo.save.mockResolvedValue(undefined);
      stockService.reserveStock.mockResolvedValue(undefined);

      const result = await service.create(1, {
        ...dto,
        couponCode: 'GLOBAL10',
      });

      expect(mockEntityManager.save).toHaveBeenCalledWith(
        CouponEntity,
        expect.objectContaining({ usageCount: 6 }),
      );
      expect(mockEntityManager.save).toHaveBeenCalledWith(
        CouponUsageEntity,
        expect.objectContaining({ couponId: 5, userId: 1 }),
      );
      expect(result.id).toBe(1);
    });

    it('should apply a non-global coupon targeting a specific product', async () => {
      const coupon = {
        id: 2,
        code: 'PROD10',
        value: 10,
        isGlobal: false,
        usageLimit: null,
        usageCount: 0,
        startsAt: null,
        endsAt: null,
      };
      const order = mockOrder({
        subtotal: 1306.8,
        total: 1176.12,
        couponDiscount: 130.68,
      });
      const mockUsage = { couponId: 2, userId: 1, orderId: 1 };

      userRepo.findOne.mockResolvedValue(mockUser());
      productRepo.findOne.mockResolvedValue(mockProduct());
      calcService.calculateProduct.mockResolvedValue(mockBreakdown());
      orderItemRepo.create.mockReturnValue({});

      // Dentro de la transacción:
      // 1. manager.find(StockItemEntity) → stock OK
      // 2. manager.find(CouponProductTargetEntity) → target encontrado
      mockEntityManager.find
        .mockResolvedValueOnce([mockStock()])
        .mockResolvedValueOnce([{ couponId: 2, productId: 1 }]);
      mockEntityManager.findOne
        .mockResolvedValueOnce(coupon) // cupón con lock
        .mockResolvedValueOnce(null); // sin uso previo
      mockEntityManager.create
        .mockReturnValueOnce(order)
        .mockReturnValueOnce(mockUsage);
      mockEntityManager.save
        .mockResolvedValueOnce(order)
        .mockResolvedValueOnce({ ...coupon, usageCount: 1 })
        .mockResolvedValueOnce(undefined);
      stockService.reserveStock.mockResolvedValue(undefined);

      const result = await service.create(1, {
        items: [{ productId: 1, quantity: 2 }],
        deliveryType: DeliveryType.PICKUP,
        couponCode: 'PROD10',
      });

      expect(mockEntityManager.save).toHaveBeenCalledWith(
        CouponEntity,
        expect.objectContaining({ usageCount: 1 }),
      );
      expect(mockEntityManager.save).toHaveBeenCalledWith(
        CouponUsageEntity,
        expect.objectContaining({ couponId: 2 }),
      );
      expect(result.id).toBe(1);
    });

    it('should apply a non-global coupon targeting a specific combo', async () => {
      const coupon = {
        id: 3,
        code: 'COMBO10',
        value: 10,
        isGlobal: false,
        usageLimit: null,
        usageCount: 0,
        startsAt: null,
        endsAt: null,
      };
      const combo = mockCombo();
      const order = mockComboOrder({
        subtotal: 653.4,
        total: 588.06,
        couponDiscount: 65.34,
      });
      const mockUsage = { couponId: 3, userId: 1, orderId: 1 };
      const stockForProduct10 = mockStock({
        productId: 10,
        locationId: 3,
        quantityCurrent: 10,
        quantityReserved: 0,
      });
      const stockForProduct11 = mockStock({
        productId: 11,
        locationId: 3,
        quantityCurrent: 10,
        quantityReserved: 0,
      });

      userRepo.findOne.mockResolvedValue(mockUser());
      comboRepo.findOne.mockResolvedValue(combo);
      calcService.calculateCombo.mockResolvedValue(mockBreakdown());
      orderItemRepo.create.mockReturnValue({
        combo,
        quantity: 1,
        comboReservations: [],
      });

      // Dentro de la transacción:
      // 1. manager.find(StockItemEntity, productId:10)
      // 2. manager.find(StockItemEntity, productId:11)
      // 3. manager.find(CouponComboTargetEntity) → target encontrado
      mockEntityManager.find
        .mockResolvedValueOnce([stockForProduct10])
        .mockResolvedValueOnce([stockForProduct11])
        .mockResolvedValueOnce([{ couponId: 3, comboId: 1 }]);
      mockEntityManager.findOne
        .mockResolvedValueOnce(coupon) // cupón con lock
        .mockResolvedValueOnce(null); // sin uso previo
      mockEntityManager.create
        .mockReturnValueOnce(order)
        .mockReturnValueOnce(mockUsage);
      mockEntityManager.save
        .mockResolvedValueOnce(order)
        .mockResolvedValueOnce({ ...coupon, usageCount: 1 })
        .mockResolvedValueOnce(undefined);
      stockService.reserveStock.mockResolvedValue(undefined);

      const result = await service.create(1, {
        items: [{ comboId: 1, quantity: 1 }],
        deliveryType: DeliveryType.PICKUP,
        couponCode: 'COMBO10',
      });

      expect(mockEntityManager.save).toHaveBeenCalledWith(
        CouponEntity,
        expect.objectContaining({ usageCount: 1 }),
      );
      expect(mockEntityManager.save).toHaveBeenCalledWith(
        CouponUsageEntity,
        expect.objectContaining({ couponId: 3 }),
      );
      expect(result.id).toBe(1);
    });

    it('should create an order with combo and populate comboReservations', async () => {
      const combo = mockCombo();
      const order = mockComboOrder();
      const stockForProduct10 = mockStock({
        productId: 10,
        locationId: 3,
        quantityCurrent: 10,
        quantityReserved: 0,
      });
      const stockForProduct11 = mockStock({
        productId: 11,
        locationId: 3,
        quantityCurrent: 10,
        quantityReserved: 0,
      });

      userRepo.findOne.mockResolvedValue(mockUser());
      comboRepo.findOne.mockResolvedValue(combo);
      calcService.calculateCombo.mockResolvedValue(mockBreakdown());

      // findAvailableStockItem ahora usa manager.find dentro de la transacción
      mockEntityManager.find
        .mockResolvedValueOnce([stockForProduct10]) // stock para productId 10
        .mockResolvedValueOnce([stockForProduct11]); // stock para productId 11

      const createdItem = { combo, quantity: 1, comboReservations: [] };
      orderItemRepo.create.mockReturnValue(createdItem);
      mockEntityManager.create.mockReturnValue(order);
      mockEntityManager.save.mockResolvedValue(order);
      mockManagerRepo.findOne.mockResolvedValue(stockForProduct10);
      mockManagerRepo.save.mockResolvedValue(undefined);
      stockService.reserveStock.mockResolvedValue(undefined);

      const result = await service.create(1, {
        items: [{ comboId: 1, quantity: 1 }],
        deliveryType: DeliveryType.PICKUP,
      });

      // comboReservations deben haberse asignado al orderItem dentro de la transacción
      expect(createdItem.comboReservations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ productId: 10, locationId: 3 }),
          expect.objectContaining({ productId: 11, locationId: 3 }),
        ]),
      );
      expect(result.id).toBe(1);
    });
  });

  // ==========================
  // findAll
  // ==========================

  describe('findAll', () => {
    it('should return all orders', async () => {
      orderRepo.findAndCount.mockResolvedValue([[mockOrder()], 1]);
      const result = await service.findAll();
      expect(result.data).toHaveLength(1);
    });

    it('should return empty array', async () => {
      orderRepo.findAndCount.mockResolvedValue([[], 0]);
      const result = await service.findAll();
      expect(result.data).toEqual([]);
    });
  });

  // ==========================
  // findOne
  // ==========================

  describe('findOne', () => {
    it('should return an order by id', async () => {
      orderRepo.findOne.mockResolvedValue(mockOrder());
      const result = await service.findOne(1);
      expect(result.id).toBe(1);
    });

    it('should throw NotFoundException', async () => {
      orderRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // findByUser
  // ==========================

  describe('findByUser', () => {
    it('should return orders for a user', async () => {
      orderRepo.find.mockResolvedValue([mockOrder()]);
      const result = await service.findByUser(1);
      expect(result).toHaveLength(1);
    });
  });

  // ==========================
  // updateStatus
  // ==========================

  describe('updateStatus', () => {
    it('should confirm a pending order', async () => {
      const updated = mockOrder({ status: OrderStatus.CONFIRMED });
      mockEntityManager.findOne.mockResolvedValue(mockOrder());
      mockEntityManager.save.mockResolvedValue(updated);

      const result = await service.updateStatus(1, {
        status: OrderStatus.CONFIRMED,
      });
      expect(result.status).toBe(OrderStatus.CONFIRMED);
    });

    it('should throw BadRequestException for invalid transition', async () => {
      mockEntityManager.findOne.mockResolvedValue(
        mockOrder({ status: OrderStatus.DELIVERED }),
      );
      await expect(
        service.updateStatus(1, { status: OrderStatus.PENDING } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException from CANCELLED', async () => {
      mockEntityManager.findOne.mockResolvedValue(
        mockOrder({ status: OrderStatus.CANCELLED }),
      );
      await expect(
        service.updateStatus(1, { status: OrderStatus.CONFIRMED } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should dispatch stock when status is DISPATCHED (product item)', async () => {
      const order = mockOrder({ status: OrderStatus.CONFIRMED });
      const dispatched = {
        ...mockOrder({ status: OrderStatus.DISPATCHED }),
        user: { email: 'juan@test.com', profile: { name: 'Juan' } },
      };
      mockEntityManager.findOne.mockResolvedValue(order);
      mockEntityManager.save.mockResolvedValue(dispatched);
      stockService.dispatchStock.mockResolvedValue(undefined);

      await service.updateStatus(1, { status: OrderStatus.DISPATCHED });
      expect(stockService.dispatchStock).toHaveBeenCalledWith(
        mockProduct().id,
        1,
        1,
        1,
        expect.anything(),
      );
      expect(mailService.sendOrderDispatchedEmail).toHaveBeenCalledWith(
        'juan@test.com',
        'Juan',
        1,
      );
    });

    it('should dispatch stock using comboReservations when status is DISPATCHED (combo item)', async () => {
      const order = mockComboOrder({ status: OrderStatus.CONFIRMED });
      mockEntityManager.findOne.mockResolvedValue(order);
      mockEntityManager.save.mockResolvedValue(
        mockComboOrder({ status: OrderStatus.DISPATCHED }),
      );
      stockService.dispatchStock.mockResolvedValue(undefined);

      await service.updateStatus(1, { status: OrderStatus.DISPATCHED });

      expect(stockService.dispatchStock).toHaveBeenCalledTimes(2);
      expect(stockService.dispatchStock).toHaveBeenCalledWith(
        10,
        3,
        4,
        1,
        expect.anything(),
      );
      expect(stockService.dispatchStock).toHaveBeenCalledWith(
        11,
        3,
        2,
        1,
        expect.anything(),
      );
    });

    it('should release stock when status is CANCELLED (product item)', async () => {
      const order = mockOrder({ status: OrderStatus.CONFIRMED });
      const cancelled = {
        ...mockOrder({ status: OrderStatus.CANCELLED }),
        user: { email: 'juan@test.com', profile: { name: 'Juan' } },
      };
      mockEntityManager.findOne.mockResolvedValue(order);
      mockEntityManager.save.mockResolvedValue(cancelled);
      stockService.releaseReservation.mockResolvedValue(undefined);

      await service.updateStatus(1, { status: OrderStatus.CANCELLED });
      expect(stockService.releaseReservation).toHaveBeenCalledWith(
        mockProduct().id,
        1,
        1,
        1,
        expect.anything(),
      );
      expect(mailService.sendOrderCancelledEmail).toHaveBeenCalledWith(
        'juan@test.com',
        'Juan',
        1,
      );
    });

    it('should release stock using comboReservations when status is CANCELLED (combo item)', async () => {
      const order = mockComboOrder({ status: OrderStatus.CONFIRMED });
      mockEntityManager.findOne.mockResolvedValue(order);
      mockEntityManager.save.mockResolvedValue(
        mockComboOrder({ status: OrderStatus.CANCELLED }),
      );
      stockService.releaseReservation.mockResolvedValue(undefined);

      await service.updateStatus(1, { status: OrderStatus.CANCELLED });

      expect(stockService.releaseReservation).toHaveBeenCalledTimes(2);
      expect(stockService.releaseReservation).toHaveBeenCalledWith(
        10,
        3,
        4,
        1,
        expect.anything(),
      );
      expect(stockService.releaseReservation).toHaveBeenCalledWith(
        11,
        3,
        2,
        1,
        expect.anything(),
      );
    });

    it('should throw NotFoundException if order not found', async () => {
      mockEntityManager.findOne.mockResolvedValue(null);
      await expect(
        service.updateStatus(999, { status: OrderStatus.CONFIRMED } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should send confirmation email when status is CONFIRMED and user has profile', async () => {
      const order = mockOrder({ status: OrderStatus.PENDING });
      const confirmed = {
        ...mockOrder({ status: OrderStatus.CONFIRMED }),
        user: { email: 'juan@test.com', profile: { name: 'Juan' } },
      };
      mockEntityManager.findOne.mockResolvedValue(order);
      mockEntityManager.save.mockResolvedValue(confirmed);

      await service.updateStatus(1, { status: OrderStatus.CONFIRMED });
      expect(mailService.sendOrderConfirmedEmail).toHaveBeenCalledWith(
        'juan@test.com',
        'Juan',
        1,
      );
    });

    it('should send delivered email when status is DELIVERED', async () => {
      const order = mockOrder({ status: OrderStatus.DISPATCHED });
      const delivered = {
        ...mockOrder({ status: OrderStatus.DELIVERED }),
        user: { email: 'juan@test.com', profile: { name: 'Juan' } },
      };
      mockEntityManager.findOne.mockResolvedValue(order);
      mockEntityManager.save.mockResolvedValue(delivered);

      await service.updateStatus(1, { status: OrderStatus.DELIVERED });
      expect(mailService.sendOrderDeliveredEmail).toHaveBeenCalledWith(
        'juan@test.com',
        'Juan',
        1,
      );
    });
  });

  // ==========================
  // releaseStockForOrder
  // ==========================

  describe('releaseStockForOrder', () => {
    it('should do nothing if order not found', async () => {
      mockEntityManager.findOne.mockResolvedValue(null);
      await service.releaseStockForOrder(999);
      expect(stockService.releaseReservation).not.toHaveBeenCalled();
    });

    it('should do nothing if order is in non-cancellable status', async () => {
      mockEntityManager.findOne.mockResolvedValue(
        mockOrder({ status: OrderStatus.DISPATCHED }),
      );
      await service.releaseStockForOrder(1);
      expect(stockService.releaseReservation).not.toHaveBeenCalled();
    });

    it('should set CANCELLED and release stock for a PENDING order', async () => {
      mockEntityManager.findOne.mockResolvedValue(
        mockOrder({ status: OrderStatus.PENDING }),
      );
      mockEntityManager.save.mockResolvedValue(undefined);
      stockService.releaseReservation.mockResolvedValue(undefined);
      await service.releaseStockForOrder(1);
      expect(mockEntityManager.save).toHaveBeenCalledWith(
        OrderEntity,
        expect.objectContaining({ status: OrderStatus.CANCELLED }),
      );
      expect(stockService.releaseReservation).toHaveBeenCalled();
    });

    it('should set CANCELLED and release stock for a CONFIRMED order', async () => {
      mockEntityManager.findOne.mockResolvedValue(
        mockOrder({ status: OrderStatus.CONFIRMED }),
      );
      mockEntityManager.save.mockResolvedValue(undefined);
      stockService.releaseReservation.mockResolvedValue(undefined);
      await service.releaseStockForOrder(1);
      expect(mockEntityManager.save).toHaveBeenCalledWith(
        OrderEntity,
        expect.objectContaining({ status: OrderStatus.CANCELLED }),
      );
      expect(stockService.releaseReservation).toHaveBeenCalled();
    });

    it('should revert coupon usage when cancelling an order with a coupon', async () => {
      const coupon = { id: 5, code: 'PROMO10', usageCount: 3 };
      const orderWithCoupon = mockOrder({
        status: OrderStatus.PENDING,
        couponId: 5,
        coupon,
      });

      // 1. findOne(OrderEntity) lock check → orderWithCoupon
      // 2. findOne(OrderEntity) full load with relations → orderWithCoupon
      // 3. findOne(CouponEntity) con lock dentro de handleCancellation → coupon
      mockEntityManager.findOne
        .mockResolvedValueOnce(orderWithCoupon)
        .mockResolvedValueOnce(orderWithCoupon)
        .mockResolvedValueOnce(coupon);
      mockEntityManager.save.mockResolvedValue(undefined);
      mockEntityManager.softDelete.mockResolvedValue(undefined);
      stockService.releaseReservation.mockResolvedValue(undefined);

      await service.releaseStockForOrder(1);

      expect(stockService.releaseReservation).toHaveBeenCalled();
      expect(mockEntityManager.save).toHaveBeenCalledWith(
        CouponEntity,
        expect.objectContaining({ usageCount: 2 }),
      );
      expect(mockEntityManager.softDelete).toHaveBeenCalledWith(
        CouponUsageEntity,
        expect.objectContaining({ couponId: 5, orderId: 1 }),
      );
    });

    it('should use provided manager directly when manager is given', async () => {
      mockEntityManager.findOne.mockResolvedValue(
        mockOrder({ status: OrderStatus.PENDING }),
      );
      mockEntityManager.save.mockResolvedValue(undefined);
      stockService.releaseReservation.mockResolvedValue(undefined);
      await service.releaseStockForOrder(1, mockEntityManager as any);
      expect(mockEntityManager.findOne).toHaveBeenCalled();
      expect(mockEntityManager.save).toHaveBeenCalledWith(
        OrderEntity,
        expect.objectContaining({ status: OrderStatus.CANCELLED }),
      );
      expect(stockService.releaseReservation).toHaveBeenCalled();
    });
  });
});
