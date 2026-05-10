import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { StockItemsService } from '../../../stocks/stock-item/services/stock-item.service';
import { StockItemEntity } from '../../../stocks/stock-item/entities/stock-item.entity';
import { StockMovementEntity } from '../../../stocks/stock-movement/entities/stock-movement.entity';
import { StockWriteOffEntity } from '../../../stocks/stock-writeoff/entities/stock-writeoff.entity';
import { ComboItemEntity } from 'src/modules/products/combos/entities/combo-item.entity';

describe('StockItemsService', () => {
  let service: StockItemsService;
  let stockRepo: any;
  let movementRepo: any;
  let writeOffRepo: any;
  let comboItemRepo: any;

  const mockStockRepo    = () => ({ find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn() });
  const mockMovementRepo = () => ({ create: jest.fn(), save: jest.fn() });
  const mockWriteOffRepo = () => ({ create: jest.fn(), save: jest.fn() });
  const mockComboRepo    = () => ({ find: jest.fn() });

  const mockStockItem = (overrides = {}): StockItemEntity =>
    ({ id: 1, productId: 1, locationId: 1, quantityCurrent: 20, quantityReserved: 5,
       stockMin: 5, stockCritical: 2, stockMax: 100, isDeleted: false,
       get quantityAvailable() { return this.quantityCurrent - this.quantityReserved; },
       createdAt: new Date(), updatedAt: new Date(), ...overrides }) as unknown as StockItemEntity;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        StockItemsService,
        { provide: getRepositoryToken(StockItemEntity),    useFactory: mockStockRepo    },
        { provide: getRepositoryToken(StockMovementEntity), useFactory: mockMovementRepo },
        { provide: getRepositoryToken(StockWriteOffEntity), useFactory: mockWriteOffRepo },
        { provide: getRepositoryToken(ComboItemEntity),    useFactory: mockComboRepo    },
      ],
    }).compile();

    service      = module.get<StockItemsService>(StockItemsService);
    stockRepo    = module.get(getRepositoryToken(StockItemEntity));
    movementRepo = module.get(getRepositoryToken(StockMovementEntity));
    writeOffRepo = module.get(getRepositoryToken(StockWriteOffEntity));
    comboItemRepo = module.get(getRepositoryToken(ComboItemEntity));
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('should return all stock items', async () => {
      stockRepo.find.mockResolvedValue([mockStockItem()]);
      expect(await service.findAll()).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('should return stock item with movements', async () => {
      stockRepo.findOne.mockResolvedValue(mockStockItem());
      expect((await service.findById(1)).id).toBe(1);
    });

    it('should throw NotFoundException', async () => {
      stockRepo.findOne.mockResolvedValue(null);
      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByProduct', () => {
    it('should return stock item with highest availability', async () => {
      stockRepo.find.mockResolvedValue([mockStockItem(), mockStockItem({ id: 2, quantityCurrent: 50, quantityReserved: 2 })]);
      const result = await service.findByProduct(1);
      expect(result.quantityAvailable).toBe(48); // 50-2
    });

    it('should throw NotFoundException if no stock', async () => {
      stockRepo.find.mockResolvedValue([]);
      await expect(service.findByProduct(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByCombo', () => {
    it('should calculate min available combos', async () => {
      comboItemRepo.find.mockResolvedValue([
        { productId: 1, quantity: 3 },
        { productId: 2, quantity: 1 },
      ]);
      stockRepo.find
        .mockResolvedValueOnce([mockStockItem({ quantityCurrent: 9, quantityReserved: 0 })])  // prod 1: 9/3 = 3
        .mockResolvedValueOnce([mockStockItem({ quantityCurrent: 10, quantityReserved: 0 })]); // prod 2: 10/1 = 10
      const result = await service.findByCombo(1);
      expect(result.quantityAvailable).toBe(3);
      expect(result.inStock).toBe(true);
    });

    it('should return inStock: false if no combo items', async () => {
      comboItemRepo.find.mockResolvedValue([]);
      const result = await service.findByCombo(1);
      expect(result.inStock).toBe(false);
    });
  });

  describe('addStock', () => {
    it('should add stock and create movement', async () => {
      const item = mockStockItem();
      stockRepo.findOne.mockResolvedValue(item);
      stockRepo.save.mockResolvedValue({ ...item, quantityCurrent: 30 });
      movementRepo.create.mockReturnValue({});
      movementRepo.save.mockResolvedValue({});
      await service.addStock({ stockItemId: 1, quantity: 10 } as any);
      expect(stockRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException', async () => {
      stockRepo.findOne.mockResolvedValue(null);
      await expect(service.addStock({ stockItemId: 999, quantity: 10 } as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('writeOff', () => {
    it('should throw BadRequestException if insufficient available stock', async () => {
      stockRepo.findOne.mockResolvedValue(mockStockItem({ quantityCurrent: 20, quantityReserved: 18 }));
      // quantityAvailable = 2, trying to write off 5
      await expect(service.writeOff({ stockItemId: 1, quantity: 5 } as any)).rejects.toThrow(BadRequestException);
    });

    it('should write off and create movement', async () => {
      const item = mockStockItem();
      stockRepo.findOne.mockResolvedValue(item);
      stockRepo.save.mockResolvedValue({ ...item, quantityCurrent: 15 });
      movementRepo.create.mockReturnValue({});
      movementRepo.save.mockResolvedValue({});
      writeOffRepo.create.mockReturnValue({});
      writeOffRepo.save.mockResolvedValue({});
      await service.writeOff({ stockItemId: 1, quantity: 5 } as any);
      expect(stockRepo.save).toHaveBeenCalled();
    });
  });

  describe('reserveStock', () => {
    it('should reserve stock', async () => {
      const item = mockStockItem();
      stockRepo.findOne.mockResolvedValue(item);
      stockRepo.save.mockResolvedValue({ ...item, quantityReserved: 8 });
      movementRepo.create.mockReturnValue({});
      movementRepo.save.mockResolvedValue({});
      await service.reserveStock(1, 1, 3);
      expect(stockRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if insufficient available stock', async () => {
      stockRepo.findOne.mockResolvedValue(mockStockItem({ quantityCurrent: 5, quantityReserved: 4 }));
      await expect(service.reserveStock(1, 1, 3)).rejects.toThrow(BadRequestException);
    });
  });

  describe('dispatchStock', () => {
    it('should dispatch stock', async () => {
      const item = mockStockItem();
      stockRepo.findOne.mockResolvedValue(item);
      stockRepo.save.mockResolvedValue(item);
      movementRepo.create.mockReturnValue({});
      movementRepo.save.mockResolvedValue({});
      await service.dispatchStock(1, 1, 3, 1);
      expect(stockRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if quantityReserved < quantity', async () => {
      stockRepo.findOne.mockResolvedValue(mockStockItem({ quantityReserved: 2 }));
      await expect(service.dispatchStock(1, 1, 5, 1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('releaseReservation', () => {
    it('should release reservation', async () => {
      const item = mockStockItem();
      stockRepo.findOne.mockResolvedValue(item);
      stockRepo.save.mockResolvedValue(item);
      movementRepo.create.mockReturnValue({});
      movementRepo.save.mockResolvedValue({});
      await service.releaseReservation(1, 1, 3, 1);
      expect(stockRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if quantityReserved < quantity', async () => {
      stockRepo.findOne.mockResolvedValue(mockStockItem({ quantityReserved: 1 }));
      await expect(service.releaseReservation(1, 1, 5, 1)).rejects.toThrow(BadRequestException);
    });
  });
});