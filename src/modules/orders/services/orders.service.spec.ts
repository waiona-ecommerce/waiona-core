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
import { ProductEntity } from 'src/modules/products/product/entities/product.entity';
import { ComboEntity } from 'src/modules/products/combos/entities/combo.entity';
import { CouponEntity } from 'src/modules/coupons/coupon/entities/coupon.entity';
import { CouponProductTargetEntity } from 'src/modules/coupons/coupon-product-target/entities/coupon-product-target.entity';
import { CouponComboTargetEntity } from 'src/modules/coupons/coupon-combo-target/entities/coupon-combo-target.entity';
import { StockItemEntity } from 'src/modules/stocks/stock-item/entities/stock-item.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { StockItemsService } from 'src/modules/stocks/stock-item/services/stock-item.service';
import { CalculationService } from 'src/modules/pricing/calculation/services/calculation.service';
import { MailService } from 'src/modules/mail/services/mail.service';
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
  const mockCouponProductTargetRepo = () => ({ findOne: jest.fn() });
  const mockCouponComboTargetRepo = () => ({ findOne: jest.fn() });
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
    create: jest.fn(),
    save: jest.fn(),
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
  let stockItemRepo: any;
  let userRepo: any;
  let stockService: any;
  let calcService: any;
  let orderItemRepo: any;

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
          provide: getRepositoryToken(CouponProductTargetEntity),
          useFactory: mockCouponProductTargetRepo,
        },
        {
          provide: getRepositoryToken(CouponComboTargetEntity),
          useFactory: mockCouponComboTargetRepo,
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
    stockItemRepo = module.get(getRepositoryToken(StockItemEntity));
    userRepo = module.get(getRepositoryToken(UserEntity));
    stockService = module.get(StockItemsService);
    calcService = module.get(CalculationService);
    orderItemRepo = module.get(getRepositoryToken(OrderItemEntity));
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
      stockItemRepo.find.mockResolvedValue([mockStock()]); // findAvailableStockItem usa find
      calcService.calculateProduct.mockResolvedValue(mockBreakdown());
      orderItemRepo.create.mockReturnValue({});
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

    it('should throw BadRequestException if insufficient stock', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      productRepo.findOne.mockResolvedValue(mockProduct());
      // findAvailableStockItem usa find — stock con solo 1 disponible para pedido de 5
      stockItemRepo.find.mockResolvedValue([
        mockStock({ quantityCurrent: 2, quantityReserved: 1 }),
      ]);
      calcService.calculateProduct.mockResolvedValue(mockBreakdown());
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
      stockItemRepo.find.mockResolvedValue([mockStock()]);
      calcService.calculateProduct.mockResolvedValue(mockBreakdown());
      orderItemRepo.create.mockReturnValue({});
      // dentro de la transacción: findOne(CouponEntity) → cupón, findOne(CouponUsageEntity) → ya usado
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
      stockItemRepo.find
        .mockResolvedValueOnce([stockForProduct10]) // findAvailableStockItem para productId 10
        .mockResolvedValueOnce([stockForProduct11]); // findAvailableStockItem para productId 11
      calcService.calculateCombo.mockResolvedValue(mockBreakdown());

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

      // comboReservations deben haberse pasado al orderItemRepo.create
      expect(orderItemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          comboReservations: expect.arrayContaining([
            expect.objectContaining({ productId: 10, locationId: 3 }),
            expect.objectContaining({ productId: 11, locationId: 3 }),
          ]),
        }),
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
      mockEntityManager.findOne.mockResolvedValue(order);
      mockEntityManager.save.mockResolvedValue(
        mockOrder({ status: OrderStatus.DISPATCHED }),
      );
      stockService.dispatchStock.mockResolvedValue(undefined);

      await service.updateStatus(1, { status: OrderStatus.DISPATCHED });
      expect(stockService.dispatchStock).toHaveBeenCalledWith(
        mockProduct().id,
        1,
        1,
        1,
        expect.anything(),
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
      mockEntityManager.findOne.mockResolvedValue(order);
      mockEntityManager.save.mockResolvedValue(
        mockOrder({ status: OrderStatus.CANCELLED }),
      );
      stockService.releaseReservation.mockResolvedValue(undefined);

      await service.updateStatus(1, { status: OrderStatus.CANCELLED });
      expect(stockService.releaseReservation).toHaveBeenCalledWith(
        mockProduct().id,
        1,
        1,
        1,
        expect.anything(),
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
