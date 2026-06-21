import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { StockItemsService } from './stock-item.service';
import { StockItemEntity } from '../entities/stock-item.entity';
import { StockMovementEntity } from '../../stock-movement/entities/stock-movement.entity';
import { StockWriteOffEntity } from '../../stock-writeoff/entities/stock-writeoff.entity';
import { ComboItemEntity } from '../../../products/combos/entities/combo-item.entity';
import { StockWriteOffReason } from '../../stock-writeoff/enums/stock-writeoff-reason.enum';
import { MailService } from '../../../mail/services/mail.service';

describe('StockItemsService', () => {
  let service: StockItemsService;
  let stockRepo: any;
  let comboItemRepo: any;
  let managerStockRepo: any;
  let managerMovementRepo: any;
  let mockManager: any;
  let mockDataSource: any;

  const mockStockItem = (overrides = {}): StockItemEntity =>
    ({
      id: 1,
      productId: 1,
      locationId: 1,
      quantityCurrent: 20,
      quantityReserved: 5,
      stockMin: 5,
      stockCritical: 2,
      deletedAt: null,
      movements: [],
      location: { id: 1, name: 'Depósito Central' },
      product: { id: 1, name: 'CAFÉ TOSTADO' },
      createdAt: new Date(),
      updatedAt: new Date(),
      get quantityAvailable() {
        return this.quantityCurrent - this.quantityReserved;
      },
      ...overrides,
    }) as unknown as StockItemEntity;

  beforeEach(async () => {
    managerStockRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };
    managerMovementRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    mockManager = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      getRepository: jest
        .fn()
        .mockImplementation((Entity: any) =>
          Entity === StockItemEntity ? managerStockRepo : managerMovementRepo,
        ),
    };

    mockDataSource = {
      transaction: jest.fn().mockImplementation((fn: any) => fn(mockManager)),
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue({ id: 1, name: 'Mock Entity' }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockItemsService,
        {
          provide: getRepositoryToken(StockItemEntity),
          useValue: {
            findAndCount: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(StockMovementEntity),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(StockWriteOffEntity),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(ComboItemEntity),
          useValue: { find: jest.fn() },
        },
        { provide: DataSource, useValue: mockDataSource },
        { provide: MailService, useValue: { sendStockAlertEmail: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('admin@test.com') },
        },
      ],
    }).compile();

    service = module.get<StockItemsService>(StockItemsService);
    stockRepo = module.get(getRepositoryToken(StockItemEntity));
    comboItemRepo = module.get(getRepositoryToken(ComboItemEntity));
  });

  afterEach(() => jest.clearAllMocks());

  // ==========================
  // findAll
  // ==========================

  describe('findAll', () => {
    it('returns paginated stock items', async () => {
      stockRepo.findAndCount.mockResolvedValue([[mockStockItem()], 1]);
      const result = await service.findAll();
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // ==========================
  // findById
  // ==========================

  describe('findById', () => {
    it('returns stock item with movements', async () => {
      stockRepo.findOne.mockResolvedValue(mockStockItem());
      const result = await service.findById(1);
      expect(result.id).toBe(1);
    });

    it('throws NotFoundException when not found', async () => {
      stockRepo.findOne.mockResolvedValue(null);
      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // findByProduct
  // ==========================

  describe('findByProduct', () => {
    it('returns stock item with highest availability', async () => {
      stockRepo.find.mockResolvedValue([
        mockStockItem({ id: 1, quantityCurrent: 10, quantityReserved: 5 }), // available = 5
        mockStockItem({ id: 2, quantityCurrent: 50, quantityReserved: 2 }), // available = 48
      ]);
      const result = await service.findByProduct(1);
      expect(result.quantityAvailable).toBe(48);
    });

    it('throws NotFoundException when no stock found', async () => {
      stockRepo.find.mockResolvedValue([]);
      await expect(service.findByProduct(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==========================
  // findByCombo
  // ==========================

  describe('findByCombo', () => {
    it('calculates min available combos across products', async () => {
      comboItemRepo.find.mockResolvedValue([
        { productId: 1, quantity: 3 }, // 9 / 3 = 3
        { productId: 2, quantity: 1 }, // 10 / 1 = 10
      ]);
      stockRepo.find
        .mockResolvedValueOnce([
          mockStockItem({ quantityCurrent: 9, quantityReserved: 0 }),
        ])
        .mockResolvedValueOnce([
          mockStockItem({ quantityCurrent: 10, quantityReserved: 0 }),
        ]);
      const result = await service.findByCombo(1);
      expect(result.quantityAvailable).toBe(3);
      expect(result.inStock).toBe(true);
    });

    it('returns inStock: false when no combo items', async () => {
      comboItemRepo.find.mockResolvedValue([]);
      const result = await service.findByCombo(1);
      expect(result.inStock).toBe(false);
      expect(result.quantityAvailable).toBe(0);
    });
  });

  // ==========================
  // create
  // ==========================

  describe('create', () => {
    const dto = {
      productId: 1,
      locationId: 1,
      stockMin: 5,
      stockCritical: 2,
    };

    it('creates a new stock item', async () => {
      const item = mockStockItem();
      stockRepo.findOne
        .mockResolvedValueOnce(null) // conflict check → no existing item
        .mockResolvedValueOnce(item); // reload with relations
      stockRepo.create.mockReturnValue(item);
      stockRepo.save.mockResolvedValue(item);
      const result = await service.create(dto);
      expect(result.id).toBe(1);
    });

    it('throws NotFoundException when product not found', async () => {
      mockDataSource.getRepository
        .mockReturnValueOnce({
          findOne: jest.fn().mockResolvedValue(null), // product not found
        })
        .mockReturnValueOnce({
          findOne: jest.fn().mockResolvedValue({ id: 1 }), // location found
        });
      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when location not found', async () => {
      mockDataSource.getRepository
        .mockReturnValueOnce({
          findOne: jest.fn().mockResolvedValue({ id: 1 }), // product found
        })
        .mockReturnValueOnce({
          findOne: jest.fn().mockResolvedValue(null), // location not found
        });
      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when already exists', async () => {
      stockRepo.findOne.mockResolvedValue(mockStockItem());
      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException when stockCritical >= stockMin', async () => {
      stockRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create({ ...dto, stockCritical: 5, stockMin: 5 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================
  // addStock
  // ==========================

  describe('addStock', () => {
    it('adds stock and creates movement', async () => {
      const item = mockStockItem();
      mockManager.findOne.mockResolvedValue(item);
      mockManager.save.mockResolvedValue(item);
      mockManager.create.mockReturnValue({});
      stockRepo.findOne.mockResolvedValue(mockStockItem());

      await service.addStock(1, 1, 10);
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockManager.save).toHaveBeenCalled();
    });

    it('throws BadRequestException for quantity <= 0', async () => {
      await expect(service.addStock(1, 1, 0)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when stock item not found', async () => {
      mockManager.findOne.mockResolvedValue(null);
      await expect(service.addStock(1, 1, 10)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==========================
  // writeOff
  // ==========================

  describe('writeOff', () => {
    it('writes off available stock and creates movement', async () => {
      const item = mockStockItem(); // available = 15
      mockManager.findOne.mockResolvedValue(item);
      mockManager.save.mockResolvedValue(item);
      mockManager.create.mockReturnValue({});
      stockRepo.findOne.mockResolvedValue(mockStockItem());

      await service.writeOff(1, 5);
      expect(mockManager.save).toHaveBeenCalled();
    });

    it('throws BadRequestException for quantity <= 0', async () => {
      await expect(service.writeOff(1, 0)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when available stock is insufficient', async () => {
      mockManager.findOne.mockResolvedValue(
        mockStockItem({ quantityCurrent: 20, quantityReserved: 18 }),
      ); // available = 2
      await expect(service.writeOff(1, 5)).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when stock item not found', async () => {
      mockManager.findOne.mockResolvedValue(null);
      await expect(service.writeOff(999, 5)).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // writeOffDamage
  // ==========================

  describe('writeOffDamage', () => {
    const dto = {
      stockItemId: 1,
      quantity: 3,
      reason: StockWriteOffReason.DAMAGED,
      description: 'broken glass',
      attachments: null,
    };

    it('creates damage write-off with movement record', async () => {
      const item = mockStockItem(); // available = 15
      mockManager.findOne.mockResolvedValue(item);
      mockManager.save.mockResolvedValue({});
      mockManager.create.mockReturnValue({});
      stockRepo.findOne.mockResolvedValue(mockStockItem());

      await service.writeOffDamage(dto as any, 99);
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('throws BadRequestException for quantity <= 0', async () => {
      await expect(
        service.writeOffDamage({ ...dto, quantity: 0 } as any, 99),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when available stock is insufficient', async () => {
      mockManager.findOne.mockResolvedValue(
        mockStockItem({ quantityCurrent: 2, quantityReserved: 0 }),
      ); // available = 2
      await expect(
        service.writeOffDamage({ ...dto, quantity: 5 } as any, 99),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================
  // updateThresholds
  // ==========================

  describe('updateThresholds', () => {
    it('updates stock thresholds', async () => {
      const item = mockStockItem();
      stockRepo.findOne.mockResolvedValue(item);
      stockRepo.save.mockResolvedValue(
        mockStockItem({ stockMin: 10, stockCritical: 3 }),
      );
      const result = await service.updateThresholds(1, {
        stockMin: 10,
        stockCritical: 3,
      });
      expect(stockRepo.save).toHaveBeenCalled();
      expect(result.id).toBe(1);
    });

    it('throws BadRequestException when stockCritical >= stockMin', async () => {
      stockRepo.findOne.mockResolvedValue(mockStockItem());
      await expect(
        service.updateThresholds(1, { stockMin: 5, stockCritical: 5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when not found', async () => {
      stockRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateThresholds(999, { stockMin: 5, stockCritical: 2 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // reserveStock
  // ==========================

  describe('reserveStock', () => {
    it('reserves stock inside a transaction', async () => {
      const item = mockStockItem(); // available = 15
      managerStockRepo.findOne.mockResolvedValue(item);
      managerStockRepo.save.mockResolvedValue({ ...item, quantityReserved: 8 });
      await service.reserveStock(1, 1, 3);
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(managerStockRepo.save).toHaveBeenCalled();
    });

    it('throws BadRequestException when available stock is insufficient', async () => {
      managerStockRepo.findOne.mockResolvedValue(
        mockStockItem({ quantityCurrent: 5, quantityReserved: 4 }),
      ); // available = 1
      await expect(service.reserveStock(1, 1, 3)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when stock item not found', async () => {
      managerStockRepo.findOne.mockResolvedValue(null);
      await expect(service.reserveStock(1, 1, 3)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==========================
  // dispatchStock
  // ==========================

  describe('dispatchStock', () => {
    it('dispatches stock and creates movement', async () => {
      const item = mockStockItem({ quantityReserved: 10, quantityCurrent: 20 });
      managerStockRepo.findOne.mockResolvedValue(item);
      managerStockRepo.save.mockResolvedValue(item);
      managerMovementRepo.create.mockReturnValue({});
      managerMovementRepo.save.mockResolvedValue({});

      await service.dispatchStock(1, 1, 5, 10);
      expect(managerStockRepo.save).toHaveBeenCalled();
      expect(managerMovementRepo.save).toHaveBeenCalled();
    });

    it('throws BadRequestException when reserved < quantity', async () => {
      managerStockRepo.findOne.mockResolvedValue(
        mockStockItem({ quantityReserved: 2, quantityCurrent: 20 }),
      );
      await expect(service.dispatchStock(1, 1, 5, 10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when stock item not found', async () => {
      managerStockRepo.findOne.mockResolvedValue(null);
      await expect(service.dispatchStock(1, 1, 5, 10)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==========================
  // releaseReservation
  // ==========================

  describe('releaseReservation', () => {
    it('releases reservation and creates movement', async () => {
      const item = mockStockItem({ quantityReserved: 10 });
      managerStockRepo.findOne.mockResolvedValue(item);
      managerStockRepo.save.mockResolvedValue(item);
      managerMovementRepo.create.mockReturnValue({});
      managerMovementRepo.save.mockResolvedValue({});

      await service.releaseReservation(1, 1, 5, 10);
      expect(managerStockRepo.save).toHaveBeenCalled();
    });

    it('throws BadRequestException when reserved < quantity', async () => {
      managerStockRepo.findOne.mockResolvedValue(
        mockStockItem({ quantityReserved: 2 }),
      );
      await expect(service.releaseReservation(1, 1, 5, 10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when stock item not found', async () => {
      managerStockRepo.findOne.mockResolvedValue(null);
      await expect(service.releaseReservation(1, 1, 5, 10)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
