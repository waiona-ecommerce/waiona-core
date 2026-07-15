import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
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
import { StockOperationType } from '../../stock-movement/enums/stock-operation-type.enum';
import { StockFlow } from '../../stock-movement/enums/stock-flow.enum';
import { StockReferenceType } from '../../stock-movement/enums/stock-reference.enum';
import { MailService } from '../../../mail/services/mail.service';

describe('StockItemsService', () => {
  let service: StockItemsService;
  let stockRepo: any;
  let comboItemRepo: any;
  let managerStockRepo: any;
  let managerMovementRepo: any;
  let mockManager: any;
  let mockDataSource: any;
  let mailService: any;

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
    mailService = module.get(MailService);
  });

  afterEach(() => jest.clearAllMocks());

  // ==========================
  // findAll
  // ==========================

  describe('findAll', () => {
    it('queries with relations, order and skip/take, and returns mapped data with pagination metadata', async () => {
      const item = mockStockItem();
      stockRepo.findAndCount.mockResolvedValue([[item], 25]);

      const result = await service.findAll(2, 10);

      expect(stockRepo.findAndCount).toHaveBeenCalledWith({
        relations: ['location', 'product'],
        order: { id: 'ASC' },
        skip: 10,
        take: 10,
      });
      expect(result.data[0]).toEqual(
        expect.objectContaining({
          id: item.id,
          productId: item.productId,
          productName: item.product.name,
          locationId: item.locationId,
          locationName: item.location.name,
        }),
      );
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(3);
      expect(result.hasNextPage).toBe(true);
    });

    it('returns an empty paginated result when there are no stock items', async () => {
      stockRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll();

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.hasNextPage).toBe(false);
    });

    it.each([
      [1, 20, 0],
      [2, 10, 10],
      [5, 7, 28],
    ])(
      'calculates skip from page=%i and limit=%i as %i',
      async (page, limit, expectedSkip) => {
        stockRepo.findAndCount.mockResolvedValue([[mockStockItem()], 1]);

        await service.findAll(page, limit);

        expect(stockRepo.findAndCount).toHaveBeenCalledWith(
          expect.objectContaining({ skip: expectedSkip, take: limit }),
        );
      },
    );
  });

  // ==========================
  // findById
  // ==========================

  describe('findById', () => {
    it('queries with relations and movements ordered by most recent, and maps the result', async () => {
      const movement = {
        id: 1,
        stockItemId: 1,
        operationType: StockOperationType.ENTRY,
        stockFlow: StockFlow.INBOUND,
        quantity: 10,
        referenceType: StockReferenceType.MANUAL,
        referenceId: undefined,
        createdAt: new Date(),
      };
      const item = mockStockItem({ movements: [movement] });
      stockRepo.findOne.mockResolvedValue(item);

      const result = await service.findById(1);

      expect(stockRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['location', 'product', 'movements'],
        order: { movements: { createdAt: 'DESC' } },
      });
      expect(result.id).toBe(1);
      expect(result.productName).toBe(item.product.name);
      expect(result.locationName).toBe(item.location.name);
      expect(result.movements).toHaveLength(1);
      expect(result.movements[0]).toEqual(
        expect.objectContaining({ id: 1, quantity: 10 }),
      );
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
    it('returns the stock item for that product', async () => {
      const item = mockStockItem({
        quantityCurrent: 10,
        quantityReserved: 5,
      });
      stockRepo.findOne.mockResolvedValue(item);

      const result = await service.findByProduct(1);

      expect(stockRepo.findOne).toHaveBeenCalledWith({
        where: { productId: 1 },
        relations: ['location'],
      });
      expect(result.quantityAvailable).toBe(5);
    });

    it('throws NotFoundException when no stock found', async () => {
      stockRepo.findOne.mockResolvedValue(null);
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
      stockRepo.find.mockResolvedValue([
        mockStockItem({
          productId: 1,
          quantityCurrent: 9,
          quantityReserved: 0,
        }),
        mockStockItem({
          productId: 2,
          quantityCurrent: 10,
          quantityReserved: 0,
        }),
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

    it('converts stockMin/stockCritical to combo-units using the MAX across components', async () => {
      comboItemRepo.find.mockResolvedValue([
        { productId: 1, quantity: 2 }, // avail 20 → possible 10; stockMin 10/2=5, stockCritical 4/2=2
        { productId: 2, quantity: 1 }, // avail 30 → possible 30; stockMin 6/1=6, stockCritical 3/1=3
      ]);
      stockRepo.find.mockResolvedValue([
        mockStockItem({
          productId: 1,
          quantityCurrent: 20,
          quantityReserved: 0,
          stockMin: 10,
          stockCritical: 4,
        }),
        mockStockItem({
          productId: 2,
          quantityCurrent: 30,
          quantityReserved: 0,
          stockMin: 6,
          stockCritical: 3,
        }),
      ]);
      const result = await service.findByCombo(1);
      expect(result.quantityAvailable).toBe(10); // min(10, 30)
      expect(result.stockMin).toBe(6); // max(5, 6)
      expect(result.stockCritical).toBe(3); // max(2, 3)
    });

    it('returns inStock: false when a component has no stock item', async () => {
      comboItemRepo.find.mockResolvedValue([
        { productId: 1, quantity: 1 },
        { productId: 2, quantity: 1 }, // sin stock item para este producto
      ]);
      stockRepo.find.mockResolvedValue([
        mockStockItem({
          productId: 1,
          quantityCurrent: 50,
          quantityReserved: 0,
        }),
      ]);
      const result = await service.findByCombo(1);
      expect(result.quantityAvailable).toBe(0);
      expect(result.inStock).toBe(false);
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

    it('throws BadRequestException when stockCritical is negative', async () => {
      stockRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create({ ...dto, stockCritical: -1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when save fails with a duplicate key race condition', async () => {
      stockRepo.findOne.mockResolvedValueOnce(null); // conflict check passes
      stockRepo.create.mockReturnValue(mockStockItem());
      stockRepo.save.mockRejectedValue(
        new QueryFailedError('INSERT', undefined, new Error('duplicate key')),
      );
      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('re-throws unknown errors from save without wrapping them', async () => {
      stockRepo.findOne.mockResolvedValueOnce(null);
      stockRepo.create.mockReturnValue(mockStockItem());
      const unexpectedError = new Error('connection lost');
      stockRepo.save.mockRejectedValue(unexpectedError);
      await expect(service.create(dto)).rejects.toThrow(unexpectedError);
    });
  });

  // ==========================
  // addStock
  // ==========================

  describe('addStock', () => {
    it('adds stock and creates movement', async () => {
      const item = mockStockItem({ quantityCurrent: 20 });
      mockManager.findOne.mockResolvedValue(item);
      mockManager.save.mockResolvedValue(item);
      mockManager.create.mockReturnValue({});
      stockRepo.findOne.mockResolvedValue(mockStockItem());

      await service.addStock(1, 1, 10);

      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(item.quantityCurrent).toBe(30); // 20 + 10, mutado en memoria antes del save
      expect(mockManager.save).toHaveBeenCalledWith(
        StockItemEntity,
        expect.objectContaining({ quantityCurrent: 30 }),
      );
      expect(mockManager.create).toHaveBeenCalledWith(
        StockMovementEntity,
        expect.objectContaining({
          stockItemId: item.id,
          operationType: StockOperationType.ENTRY,
          stockFlow: StockFlow.INBOUND,
          quantity: 10,
          referenceType: StockReferenceType.MANUAL,
        }),
      );
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
      const item = mockStockItem({ quantityCurrent: 20, quantityReserved: 5 }); // available = 15
      mockManager.findOne.mockResolvedValue(item);
      mockManager.save.mockResolvedValueOnce(item); // save(StockItemEntity, stockItem)
      mockManager.save.mockResolvedValueOnce({ id: 555 }); // save(StockMovementEntity, movement) → savedMovement
      mockManager.create.mockReturnValue({});
      stockRepo.findOne.mockResolvedValue(mockStockItem());

      await service.writeOffDamage(dto as any, 99);

      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(item.quantityCurrent).toBe(17); // 20 - 3
      expect(mockManager.create).toHaveBeenCalledWith(
        StockMovementEntity,
        expect.objectContaining({
          operationType: StockOperationType.DAMAGE,
          stockFlow: StockFlow.OUTBOUND,
          quantity: dto.quantity,
          referenceType: StockReferenceType.DAMAGE_REPORT,
        }),
      );
      expect(mockManager.create).toHaveBeenCalledWith(
        StockWriteOffEntity,
        expect.objectContaining({
          stockItemId: dto.stockItemId,
          movementId: 555,
          quantity: dto.quantity,
          reason: dto.reason,
          description: dto.description,
          reportedBy: 99,
        }),
      );
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

    it('throws NotFoundException when stock item not found', async () => {
      mockManager.findOne.mockResolvedValue(null);
      await expect(service.writeOffDamage(dto as any, 99)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('allows write-off when quantity equals exactly the available stock', async () => {
      const item = mockStockItem({ quantityCurrent: 10, quantityReserved: 5 }); // available = 5
      mockManager.findOne.mockResolvedValue(item);
      mockManager.save.mockResolvedValue(item);
      mockManager.create.mockReturnValue({});
      stockRepo.findOne.mockResolvedValue(mockStockItem());

      await expect(
        service.writeOffDamage({ ...dto, quantity: 5 } as any, 99),
      ).resolves.toBeDefined();
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

    it('throws BadRequestException when stockCritical is negative', async () => {
      stockRepo.findOne.mockResolvedValue(mockStockItem());
      await expect(
        service.updateThresholds(1, { stockMin: 5, stockCritical: -1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when not found', async () => {
      stockRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateThresholds(999, { stockMin: 5, stockCritical: 2 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('keeps the existing stockCritical when only stockMin is provided', async () => {
      const item = mockStockItem({ stockMin: 5, stockCritical: 2 });
      stockRepo.findOne.mockResolvedValue(item);
      stockRepo.save.mockImplementation((i: any) => Promise.resolve(i));
      const result = await service.updateThresholds(1, { stockMin: 8 });
      expect(result.stockMin).toBe(8);
      expect(result.stockCritical).toBe(2);
    });

    it('keeps the existing stockMin when only stockCritical is provided', async () => {
      const item = mockStockItem({ stockMin: 5, stockCritical: 2 });
      stockRepo.findOne.mockResolvedValue(item);
      stockRepo.save.mockImplementation((i: any) => Promise.resolve(i));
      const result = await service.updateThresholds(1, { stockCritical: 3 });
      expect(result.stockMin).toBe(5);
      expect(result.stockCritical).toBe(3);
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

    it('throws BadRequestException when current stock is insufficient', async () => {
      managerStockRepo.findOne.mockResolvedValue(
        mockStockItem({ quantityReserved: 10, quantityCurrent: 3 }),
      );
      await expect(service.dispatchStock(1, 1, 5, 10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('sends a low stock alert when quantityAvailable drops to or below stockCritical', async () => {
      const item = mockStockItem({
        quantityCurrent: 10,
        quantityReserved: 10,
        stockCritical: 5,
      }); // tras despachar 5: current=5, reserved=5, available=0 <= stockCritical(5)
      managerStockRepo.findOne.mockResolvedValue(item);
      managerStockRepo.save.mockResolvedValue(item);
      managerMovementRepo.create.mockReturnValue({});
      managerMovementRepo.save.mockResolvedValue({});

      await service.dispatchStock(1, 1, 5, 10);
      await new Promise((resolve) => setImmediate(resolve)); // flush el "void this.sendLowStockAlert(...)" fire-and-forget

      expect(mailService.sendStockAlertEmail).toHaveBeenCalled();
    });

    it('does not send a low stock alert when quantityAvailable stays above stockCritical', async () => {
      const item = mockStockItem({
        quantityCurrent: 20,
        quantityReserved: 10,
        stockCritical: 2,
      }); // tras despachar 5: available = 10 > 2
      managerStockRepo.findOne.mockResolvedValue(item);
      managerStockRepo.save.mockResolvedValue(item);
      managerMovementRepo.create.mockReturnValue({});
      managerMovementRepo.save.mockResolvedValue({});

      await service.dispatchStock(1, 1, 5, 10);
      await new Promise((resolve) => setImmediate(resolve));

      expect(mailService.sendStockAlertEmail).not.toHaveBeenCalled();
    });

    it('does not fail the dispatch when the low stock alert email fails', async () => {
      const item = mockStockItem({
        quantityCurrent: 10,
        quantityReserved: 10,
        stockCritical: 5,
      });
      managerStockRepo.findOne.mockResolvedValue(item);
      managerStockRepo.save.mockResolvedValue(item);
      managerMovementRepo.create.mockReturnValue({});
      managerMovementRepo.save.mockResolvedValue({});
      mailService.sendStockAlertEmail.mockRejectedValue(new Error('smtp down'));

      await expect(service.dispatchStock(1, 1, 5, 10)).resolves.toBeUndefined();
      await new Promise((resolve) => setImmediate(resolve));

      expect(mailService.sendStockAlertEmail).toHaveBeenCalled();
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
