import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AnalyticsService } from './analytics.service';
import { OrderEntity } from '../orders/entities/order.entity';
import { OrderItemEntity } from '../orders/entities/order-item.entity';
import { StockItemEntity } from '../stocks/stock-item/entities/stock-item.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let orderRepo: any;
  let orderItemRepo: any;
  let stockItemRepo: any;

  const buildMockQB = () => {
    const qb: any = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
      getRawOne: jest.fn().mockResolvedValue({ v: '0' }),
    };
    qb.clone = jest.fn().mockReturnValue(qb);
    return qb;
  };

  const mockRepo = () => ({
    createQueryBuilder: jest.fn(() => buildMockQB()),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(OrderEntity), useFactory: mockRepo },
        { provide: getRepositoryToken(OrderItemEntity), useFactory: mockRepo },
        { provide: getRepositoryToken(StockItemEntity), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    orderRepo = module.get(getRepositoryToken(OrderEntity));
    orderItemRepo = module.get(getRepositoryToken(OrderItemEntity));
    stockItemRepo = module.get(getRepositoryToken(StockItemEntity));
  });

  afterEach(() => jest.clearAllMocks());

  describe('getOrdersSummary', () => {
    it('should return zeroed summary when no orders exist', async () => {
      const qb = buildMockQB();
      qb.getRawMany.mockResolvedValue([]);
      qb.getRawOne.mockResolvedValue({ v: '0' });
      orderRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getOrdersSummary();

      expect(result.total).toBe(0);
      expect(result.totalRevenue).toBe(0);
      expect(result.revenueToday).toBe(0);
      expect(result.revenueThisMonth).toBe(0);
      expect(result.byStatus).toEqual({
        pending: 0,
        confirmed: 0,
        dispatched: 0,
        delivered: 0,
        cancelled: 0,
      });
    });

    it('should aggregate counts and revenue from raw rows', async () => {
      const qb = buildMockQB();
      qb.getRawMany.mockResolvedValue([
        { status: OrderStatus.PENDING, count: '5' },
        { status: OrderStatus.DELIVERED, count: '10' },
        { status: OrderStatus.CANCELLED, count: '2' },
      ]);
      qb.getRawOne
        .mockResolvedValueOnce({ v: '45000' })
        .mockResolvedValueOnce({ v: '1500' })
        .mockResolvedValueOnce({ v: '12000' });
      orderRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getOrdersSummary();

      expect(result.total).toBe(17);
      expect(result.byStatus.pending).toBe(5);
      expect(result.byStatus.delivered).toBe(10);
      expect(result.byStatus.cancelled).toBe(2);
      expect(result.byStatus.confirmed).toBe(0);
      expect(result.totalRevenue).toBe(45000);
      expect(result.revenueToday).toBe(1500);
      expect(result.revenueThisMonth).toBe(12000);
    });
  });

  describe('getTopProducts', () => {
    it('should return empty array when no delivered orders', async () => {
      const result = await service.getTopProducts();
      expect(result).toEqual([]);
    });

    it('should map raw rows to typed objects with numeric fields', async () => {
      const qb = buildMockQB();
      qb.getRawMany.mockResolvedValue([
        { productId: '3', name: 'Milanesa', sku: 'MIL-001', totalSold: '42' },
        { productId: '7', name: 'Pizza', sku: 'PIZ-002', totalSold: '18' },
      ]);
      orderItemRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getTopProducts();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        productId: 3,
        name: 'Milanesa',
        sku: 'MIL-001',
        totalSold: 42,
      });
      expect(result[1]).toEqual({
        productId: 7,
        name: 'Pizza',
        sku: 'PIZ-002',
        totalSold: 18,
      });
    });
  });

  describe('getCriticalStock', () => {
    it('should return empty array when nothing is critical', async () => {
      const result = await service.getCriticalStock();
      expect(result).toEqual([]);
    });

    it('should map raw rows and compute quantityAvailable', async () => {
      const qb = buildMockQB();
      qb.getRawMany.mockResolvedValue([
        {
          id: '5',
          productId: '2',
          productName: 'Harina',
          sku: 'HAR-001',
          locationId: '1',
          locationName: 'Depósito A',
          quantityCurrent: '3',
          quantityReserved: '1',
          stockCritical: '5',
          stockMin: '10',
        },
      ]);
      stockItemRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getCriticalStock();

      expect(result).toHaveLength(1);
      expect(result[0].quantityAvailable).toBe(2); // 3 - 1
      expect(result[0].stockCritical).toBe(5);
      expect(result[0].productName).toBe('Harina');
    });
  });
});
