import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';

import { StockMovementService } from './stock-movement.service';
import { StockMovementEntity } from '../entities/stock-movement.entity';
import { StockOperationType } from '../enums/stock-operation-type.enum';
import { StockFlow } from '../enums/stock-flow.enum';
import { StockReferenceType } from '../enums/stock-reference.enum';

describe('StockMovementService', () => {
  let service: StockMovementService;
  let repo: any;

  const mockRepo = () => ({
    findAndCount: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  });

  const mockMovement = (overrides = {}): StockMovementEntity =>
    ({
      id: 1,
      stockItemId: 1,
      operationType: StockOperationType.ENTRY,
      stockFlow: StockFlow.INBOUND,
      quantity: 10,
      referenceType: StockReferenceType.MANUAL,
      referenceId: null,
      createdAt: new Date(),
      ...overrides,
    }) as unknown as StockMovementEntity;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockMovementService,
        {
          provide: getRepositoryToken(StockMovementEntity),
          useFactory: mockRepo,
        },
      ],
    }).compile();
    service = module.get<StockMovementService>(StockMovementService);
    repo = module.get(getRepositoryToken(StockMovementEntity));
  });

  afterEach(() => jest.clearAllMocks());

  // ==========================
  // findAll
  // ==========================

  describe('findAll', () => {
    it('returns paginated movements', async () => {
      repo.findAndCount.mockResolvedValue([[mockMovement()], 1]);
      const result = await service.findAll();
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // ==========================
  // findById
  // ==========================

  describe('findById', () => {
    it('returns a movement by id', async () => {
      repo.findOne.mockResolvedValue(mockMovement());
      const result = await service.findById(1);
      expect(result.id).toBe(1);
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
    it('returns movements for a stock item', async () => {
      repo.find.mockResolvedValue([mockMovement(), mockMovement({ id: 2 })]);
      const result = await service.findByStockItemId(1);
      expect(result).toHaveLength(2);
    });

    it('returns empty array when no movements found', async () => {
      repo.find.mockResolvedValue([]);
      const result = await service.findByStockItemId(99);
      expect(result).toEqual([]);
    });
  });
});
