import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';

import { StockWriteOffService } from './stock-writeoff.service';
import { StockWriteOffEntity } from '../entities/stock-writeoff.entity';
import { StockWriteOffReason } from '../enums/stock-writeoff-reason.enum';

describe('StockWriteOffService', () => {
  let service: StockWriteOffService;
  let repo: any;

  const mockRepo = () => ({
    findAndCount: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  });

  const mockWriteOff = (overrides = {}): StockWriteOffEntity =>
    ({
      id: 1,
      stockItemId: 1,
      movementId: 10,
      quantity: 3,
      reason: StockWriteOffReason.DAMAGED,
      description: null,
      attachments: null,
      reportedBy: 99,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as unknown as StockWriteOffEntity;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockWriteOffService,
        {
          provide: getRepositoryToken(StockWriteOffEntity),
          useFactory: mockRepo,
        },
      ],
    }).compile();
    service = module.get<StockWriteOffService>(StockWriteOffService);
    repo = module.get(getRepositoryToken(StockWriteOffEntity));
  });

  afterEach(() => jest.clearAllMocks());

  // ==========================
  // findAll
  // ==========================

  describe('findAll', () => {
    it('returns paginated write-offs', async () => {
      repo.findAndCount.mockResolvedValue([[mockWriteOff()], 1]);
      const result = await service.findAll();
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // ==========================
  // findById
  // ==========================

  describe('findById', () => {
    it('returns a write-off by id', async () => {
      repo.findOne.mockResolvedValue(mockWriteOff());
      const result = await service.findById(1);
      expect(result.id).toBe(1);
      expect(result.reason).toBe(StockWriteOffReason.DAMAGED);
    });

    it('throws NotFoundException when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // findByStockItemId
  // ==========================

  describe('findByStockItemId', () => {
    it('returns write-offs for a stock item', async () => {
      repo.find.mockResolvedValue([mockWriteOff(), mockWriteOff({ id: 2 })]);
      const result = await service.findByStockItemId(1);
      expect(result).toHaveLength(2);
    });

    it('returns empty array when none found', async () => {
      repo.find.mockResolvedValue([]);
      const result = await service.findByStockItemId(99);
      expect(result).toEqual([]);
    });
  });

  // ==========================
  // update
  // ==========================

  describe('update', () => {
    it('updates reason and description', async () => {
      const writeOff = mockWriteOff();
      repo.findOne.mockResolvedValue(writeOff);
      repo.save.mockResolvedValue(
        mockWriteOff({
          reason: StockWriteOffReason.EXPIRED,
          description: 'vencido',
        }),
      );
      const result = await service.update(1, {
        reason: StockWriteOffReason.EXPIRED,
        description: 'vencido',
      });
      expect(result.reason).toBe(StockWriteOffReason.EXPIRED);
    });

    it('throws NotFoundException when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update(999, {})).rejects.toThrow(NotFoundException);
    });
  });
});
