import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, DataSource } from 'typeorm';

import { StockItemEntity } from '../entities/stock-item.entity';
import { StockMovementEntity } from '../../stock-movement/entities/stock-movement.entity';
import { StockWriteOffEntity } from '../../stock-writeoff/entities/stock-writeoff.entity';
import { ComboItemEntity } from 'src/modules/products/combos/entities/combo-item.entity';

import { CreateStockItemDto } from '../dto/create-stock-item.dto';
import { UpdateStockThresholdsDto } from '../dto/update-stock-thresholds.dto';
import { CreateStockWriteOffDto } from '../../stock-writeoff/dto/create-stock-writeoff.dto';

import { StockItemResponseDto } from '../dto/stock-item-response.dto';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { StockItemWithMovementsResponseDto } from '../dto/stock-item-with-movements-response.dto';

import { StockOperationType } from '../../stock-movement/enums/stock-operation-type.enum';
import { StockFlow } from '../../stock-movement/enums/stock-flow.enum';
import { StockReferenceType } from '../../stock-movement/enums/stock-reference.enum';

@Injectable()
export class StockItemsService {
  constructor(
    @InjectRepository(StockItemEntity)
    private readonly stockItemRepository: Repository<StockItemEntity>,

    @InjectRepository(StockMovementEntity)
    private readonly stockMovementRepository: Repository<StockMovementEntity>,

    @InjectRepository(StockWriteOffEntity)
    private readonly stockWriteOffRepository: Repository<StockWriteOffEntity>,

    @InjectRepository(ComboItemEntity)
    private readonly comboItemRepository: Repository<ComboItemEntity>,

    private readonly dataSource: DataSource,
  ) {}

  // ==========================
  // GET ALL
  // ==========================

  async findAll(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<StockItemResponseDto>> {
    const [stockItems, total] = await this.stockItemRepository.findAndCount({
      relations: ['location', 'product'],
      order: { id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return new PaginatedResponseDto(
      stockItems.map((item) => new StockItemResponseDto(item)),
      total,
      page,
      limit,
    );
  }

  // ==========================
  // GET BY ID (WITH MOVEMENTS)
  // ==========================

  async findById(id: number): Promise<StockItemWithMovementsResponseDto> {
    const stockItem = await this.findEntity(id);
    return new StockItemWithMovementsResponseDto(stockItem);
  }

  // ==========================
  // GET BY PRODUCT
  // Devuelve el StockItem con mayor quantityAvailable entre todas las ubicaciones.
  // Usado por ShopService para mostrar disponibilidad al cliente.
  // ==========================

  async findByProduct(productId: number): Promise<StockItemEntity> {
    const items = await this.stockItemRepository.find({
      where: { productId },
      relations: ['location'],
    });

    if (!items.length) {
      throw new NotFoundException(`No stock found for product ${productId}`);
    }

    // devuelve la ubicación con mayor stock disponible
    return items.reduce((best, current) =>
      current.quantityAvailable > best.quantityAvailable ? current : best,
    );
  }

  // ==========================
  // GET STOCK BY COMBO
  // Calcula cuántos combos se pueden armar en base al stock
  // de cada producto que lo compone.
  // Fórmula: min(floor(quantityAvailable / quantity)) para cada item.
  // ==========================

  async findByCombo(
    comboId: number,
  ): Promise<{ quantityAvailable: number; inStock: boolean }> {
    const items = await this.comboItemRepository.find({
      where: { comboId },
    });

    if (!items.length) {
      return { quantityAvailable: 0, inStock: false };
    }

    let minAvailable = Infinity;

    for (const item of items) {
      const stockItems = await this.stockItemRepository.find({
        where: { productId: item.productId },
      });

      // máximo stock disponible en una sola ubicación
      // (consistente con reserveStock, que elige la mejor ubicación — no mezcla ubicaciones)
      const bestAvailable = stockItems.reduce(
        (best, s) => (s.quantityAvailable > best ? s.quantityAvailable : best),
        0,
      );

      // cuántos combos puedo armar con este producto
      const possible = Math.floor(bestAvailable / item.quantity);

      if (possible < minAvailable) {
        minAvailable = possible;
      }
    }

    const quantityAvailable = minAvailable === Infinity ? 0 : minAvailable;

    return {
      quantityAvailable,
      inStock: quantityAvailable > 0,
    };
  }

  // ==========================
  // CREATE
  // ==========================

  async create(dto: CreateStockItemDto): Promise<StockItemResponseDto> {
    const existing = await this.stockItemRepository.findOne({
      where: {
        productId: dto.productId,
        locationId: dto.locationId,
      },
    });

    if (existing) {
      throw new ConflictException(
        'StockItem already exists for this product and location',
      );
    }

    this.validateThresholds(dto.stockMin, dto.stockCritical, dto.stockMax);

    const stockItem = this.stockItemRepository.create({
      productId: dto.productId,
      locationId: dto.locationId,
      quantityCurrent: 0,
      quantityReserved: 0,
      stockMin: dto.stockMin,
      stockCritical: dto.stockCritical,
      stockMax: dto.stockMax ?? null,
    });

    const saved = await this.stockItemRepository.save(stockItem);

    return new StockItemResponseDto(saved);
  }

  // ==========================
  // ADD STOCK
  // ==========================

  async addStock(
    productId: number,
    locationId: number,
    quantity: number,
  ): Promise<StockItemWithMovementsResponseDto> {
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than 0');
    }

    let stockItemId: number;

    await this.dataSource.transaction(async (manager) => {
      const stockItem = await manager.findOne(StockItemEntity, {
        where: { productId, locationId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!stockItem) {
        throw new NotFoundException(
          'StockItem does not exist for this product and location',
        );
      }

      stockItem.quantityCurrent += quantity;
      await manager.save(StockItemEntity, stockItem);

      const movement = manager.create(StockMovementEntity, {
        stockItemId: stockItem.id,
        operationType: StockOperationType.ENTRY,
        stockFlow: StockFlow.INBOUND,
        quantity,
        referenceType: StockReferenceType.MANUAL,
      });

      await manager.save(StockMovementEntity, movement);
      stockItemId = stockItem.id;
    });

    return new StockItemWithMovementsResponseDto(
      await this.findEntity(stockItemId!),
    );
  }

  // ==========================
  // WRITE OFF SIMPLE
  // ==========================

  async writeOff(
    stockItemId: number,
    quantity: number,
  ): Promise<StockItemWithMovementsResponseDto> {
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than 0');
    }

    await this.dataSource.transaction(async (manager) => {
      const stockItem = await manager.findOne(StockItemEntity, {
        where: { id: stockItemId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!stockItem) {
        throw new NotFoundException(
          `StockItem with id ${stockItemId} not found`,
        );
      }

      if (stockItem.quantityAvailable < quantity) {
        throw new BadRequestException(
          `Insufficient available stock — only ${stockItem.quantityAvailable} available (${stockItem.quantityCurrent} current, ${stockItem.quantityReserved} reserved)`,
        );
      }

      stockItem.quantityCurrent -= quantity;
      await manager.save(StockItemEntity, stockItem);

      const movement = manager.create(StockMovementEntity, {
        stockItemId: stockItem.id,
        operationType: StockOperationType.ADJUSTMENT,
        stockFlow: StockFlow.OUTBOUND,
        quantity,
        referenceType: StockReferenceType.MANUAL,
      });
      await manager.save(StockMovementEntity, movement);
    });

    return new StockItemWithMovementsResponseDto(
      await this.findEntity(stockItemId),
    );
  }

  // ==========================
  // WRITE OFF DAMAGE
  // ==========================

  async writeOffDamage(
    dto: CreateStockWriteOffDto,
  ): Promise<StockItemWithMovementsResponseDto> {
    if (dto.quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than 0');
    }

    await this.dataSource.transaction(async (manager) => {
      const stockItem = await manager.findOne(StockItemEntity, {
        where: { id: dto.stockItemId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!stockItem) {
        throw new NotFoundException(
          `StockItem with id ${dto.stockItemId} not found`,
        );
      }

      if (stockItem.quantityAvailable < dto.quantity) {
        throw new BadRequestException(
          `Insufficient available stock — only ${stockItem.quantityAvailable} available (${stockItem.quantityCurrent} current, ${stockItem.quantityReserved} reserved)`,
        );
      }

      stockItem.quantityCurrent -= dto.quantity;
      await manager.save(StockItemEntity, stockItem);

      const movement = manager.create(StockMovementEntity, {
        stockItemId: stockItem.id,
        operationType: StockOperationType.DAMAGE,
        stockFlow: StockFlow.OUTBOUND,
        quantity: dto.quantity,
        referenceType: StockReferenceType.MANUAL,
      });
      const savedMovement = await manager.save(StockMovementEntity, movement);

      const writeOff = manager.create(StockWriteOffEntity, {
        stockItemId: dto.stockItemId,
        movementId: savedMovement.id,
        quantity: dto.quantity,
        reason: dto.reason,
        description: dto.description ?? null,
        attachments: dto.attachments ?? null,
        reportedBy: dto.reportedBy,
      });
      await manager.save(StockWriteOffEntity, writeOff);
    });

    return new StockItemWithMovementsResponseDto(
      await this.findEntity(dto.stockItemId),
    );
  }

  // ==========================
  // UPDATE THRESHOLDS
  // ==========================

  async updateThresholds(
    id: number,
    dto: UpdateStockThresholdsDto,
  ): Promise<StockItemResponseDto> {
    const stockItem = await this.stockItemRepository.findOne({
      where: { id },
      relations: ['location', 'product'],
    });

    if (!stockItem) {
      throw new NotFoundException(`StockItem with id ${id} not found`);
    }

    const stockMin = dto.stockMin ?? stockItem.stockMin;
    const stockCritical = dto.stockCritical ?? stockItem.stockCritical;
    const stockMax =
      dto.stockMax !== undefined ? dto.stockMax : stockItem.stockMax;

    this.validateThresholds(stockMin, stockCritical, stockMax);

    stockItem.stockMin = stockMin;
    stockItem.stockCritical = stockCritical;
    stockItem.stockMax = stockMax ?? null;

    const saved = await this.stockItemRepository.save(stockItem);

    return new StockItemResponseDto(saved);
  }

  // ==========================
  // RESERVE STOCK (al crear orden)
  // ==========================

  async reserveStock(
    productId: number,
    locationId: number,
    quantity: number,
    manager?: EntityManager,
  ): Promise<void> {
    const repo =
      manager?.getRepository(StockItemEntity) ?? this.stockItemRepository;

    const stockItem = await repo.findOne({
      where: { productId, locationId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!stockItem)
      throw new NotFoundException(
        `StockItem not found for product ${productId}`,
      );

    if (stockItem.quantityCurrent - stockItem.quantityReserved < quantity) {
      throw new BadRequestException(
        `Insufficient available stock for product ${productId}`,
      );
    }

    stockItem.quantityReserved += quantity;
    await repo.save(stockItem);
  }

  // ==========================
  // DISPATCH STOCK (admin despacha)
  // ==========================

  async dispatchStock(
    productId: number,
    locationId: number,
    quantity: number,
    orderId: number,
    manager?: EntityManager,
  ): Promise<void> {
    const execute = async (mgr: EntityManager): Promise<void> => {
      const stockRepo = mgr.getRepository(StockItemEntity);
      const movementRepo = mgr.getRepository(StockMovementEntity);

      const stockItem = await stockRepo.findOne({
        where: { productId, locationId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!stockItem)
        throw new NotFoundException(
          `StockItem not found for product ${productId}`,
        );

      if (stockItem.quantityReserved < quantity) {
        throw new BadRequestException(
          `Cannot dispatch ${quantity} units — only ${stockItem.quantityReserved} reserved for product ${productId}`,
        );
      }

      if (stockItem.quantityCurrent < quantity) {
        throw new BadRequestException(
          `Cannot dispatch ${quantity} units — only ${stockItem.quantityCurrent} in stock for product ${productId}`,
        );
      }

      stockItem.quantityCurrent -= quantity;
      stockItem.quantityReserved -= quantity;
      await stockRepo.save(stockItem);

      await movementRepo.save(
        movementRepo.create({
          stockItemId: stockItem.id,
          operationType: StockOperationType.EXIT,
          stockFlow: StockFlow.OUTBOUND,
          quantity,
          referenceType: StockReferenceType.ORDER,
          referenceId: orderId,
        }),
      );
    };

    if (manager) await execute(manager);
    else await this.dataSource.transaction(execute);
  }

  // ==========================
  // RELEASE RESERVATION (admin cancela)
  // ==========================

  async releaseReservation(
    productId: number,
    locationId: number,
    quantity: number,
    orderId: number,
    manager?: EntityManager,
  ): Promise<void> {
    const execute = async (mgr: EntityManager): Promise<void> => {
      const stockRepo = mgr.getRepository(StockItemEntity);
      const movementRepo = mgr.getRepository(StockMovementEntity);

      const stockItem = await stockRepo.findOne({
        where: { productId, locationId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!stockItem)
        throw new NotFoundException(
          `StockItem not found for product ${productId}`,
        );

      if (stockItem.quantityReserved < quantity) {
        throw new BadRequestException(
          `Cannot release ${quantity} units — only ${stockItem.quantityReserved} reserved for product ${productId}`,
        );
      }

      stockItem.quantityReserved -= quantity;
      await stockRepo.save(stockItem);

      await movementRepo.save(
        movementRepo.create({
          stockItemId: stockItem.id,
          operationType: StockOperationType.RETURN,
          stockFlow: StockFlow.INBOUND,
          quantity,
          referenceType: StockReferenceType.ORDER,
          referenceId: orderId,
        }),
      );
    };

    if (manager) await execute(manager);
    else await this.dataSource.transaction(execute);
  }

  // ==========================
  // PRIVATE HELPERS
  // ==========================

  private async findEntity(id: number): Promise<StockItemEntity> {
    const stockItem = await this.stockItemRepository.findOne({
      where: { id },
      relations: ['location', 'product', 'movements'],
      order: {
        movements: { createdAt: 'DESC' },
      },
    });

    if (!stockItem) {
      throw new NotFoundException(`StockItem with id ${id} not found`);
    }

    return stockItem;
  }

  private validateThresholds(
    stockMin: number,
    stockCritical: number,
    stockMax?: number | null,
  ): void {
    if (stockMin < 0 || stockCritical < 0) {
      throw new BadRequestException(
        'stockMin and stockCritical must be non-negative',
      );
    }
    if (stockMax != null && stockMax < 0) {
      throw new BadRequestException('stockMax must be non-negative');
    }

    if (stockCritical >= stockMin) {
      throw new BadRequestException('stockCritical must be less than stockMin');
    }

    if (stockMax != null && stockMax <= stockMin) {
      throw new BadRequestException('stockMax must be greater than stockMin');
    }
  }
}
