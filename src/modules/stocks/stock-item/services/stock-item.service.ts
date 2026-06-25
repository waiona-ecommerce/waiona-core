import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  EntityManager,
  DataSource,
  QueryFailedError,
  In,
} from 'typeorm';

import { StockItemEntity } from '../entities/stock-item.entity';
import { StockMovementEntity } from '../../stock-movement/entities/stock-movement.entity';
import { StockWriteOffEntity } from '../../stock-writeoff/entities/stock-writeoff.entity';
import { StockLocationEntity } from '../../stock-locations/entities/stock-locations.entity';
import { ComboItemEntity } from '../../../products/combos/entities/combo-item.entity';
import { ProductEntity } from '../../../products/product/entities/product.entity';

import { CreateStockItemDto } from '../dto/create-stock-item.dto';
import { UpdateStockThresholdsDto } from '../dto/update-stock-thresholds.dto';
import { CreateStockWriteOffDto } from '../../stock-writeoff/dto/create-stock-writeoff.dto';

import { StockItemResponseDto } from '../dto/stock-item-response.dto';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';
import { StockItemWithMovementsResponseDto } from '../dto/stock-item-with-movements-response.dto';

import { StockOperationType } from '../../stock-movement/enums/stock-operation-type.enum';
import { StockFlow } from '../../stock-movement/enums/stock-flow.enum';
import { StockReferenceType } from '../../stock-movement/enums/stock-reference.enum';
import { MailService } from '../../../mail/services/mail.service';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../../../env.model';

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
    private readonly mailService: MailService,
    private readonly configService: ConfigService<Env>,
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
      throw new NotFoundException(
        `No se encontró stock para el producto ${productId}`,
      );
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

  async findByCombo(comboId: number): Promise<{
    quantityAvailable: number;
    inStock: boolean;
    stockMin: number;
    stockCritical: number;
  }> {
    const items = await this.comboItemRepository.find({
      where: { comboId },
    });

    if (!items.length) {
      return {
        quantityAvailable: 0,
        inStock: false,
        stockMin: 0,
        stockCritical: 0,
      };
    }

    const productIds = items.map((i) => i.productId);
    const allStockItems = await this.stockItemRepository.find({
      where: { productId: In(productIds) },
    });

    const byProduct = new Map<number, StockItemEntity[]>();
    for (const s of allStockItems) {
      if (!byProduct.has(s.productId)) byProduct.set(s.productId, []);
      byProduct.get(s.productId)!.push(s);
    }

    let minAvailable = Infinity;
    // Umbral más restrictivo en combo-units: el combo es "low/critical"
    // si CUALQUIER componente lo es → se toma el MAX de los umbrales por componente
    let maxThresholdMin = 0;
    let maxThresholdCritical = 0;

    for (const item of items) {
      const stockItems = byProduct.get(item.productId) ?? [];

      // Mejor ubicación para este componente (consistente con reserveStock)
      let bestPossible = 0;
      let bestStockItem: StockItemEntity | undefined;
      for (const s of stockItems) {
        const possible = Math.floor(s.quantityAvailable / item.quantity);
        if (possible > bestPossible) {
          bestPossible = possible;
          bestStockItem = s;
        }
      }

      if (bestPossible < minAvailable) minAvailable = bestPossible;

      // Convertir umbrales a combo-units usando la misma ubicación
      if (bestStockItem) {
        const thresholdMin = Math.floor(bestStockItem.stockMin / item.quantity);
        const thresholdCritical = Math.floor(
          bestStockItem.stockCritical / item.quantity,
        );
        if (thresholdMin > maxThresholdMin) maxThresholdMin = thresholdMin;
        if (thresholdCritical > maxThresholdCritical)
          maxThresholdCritical = thresholdCritical;
      }
    }

    const quantityAvailable = minAvailable === Infinity ? 0 : minAvailable;

    return {
      quantityAvailable,
      inStock: quantityAvailable > 0,
      stockMin: maxThresholdMin,
      stockCritical: maxThresholdCritical,
    };
  }

  // ==========================
  // CREATE
  // ==========================

  async create(dto: CreateStockItemDto): Promise<StockItemResponseDto> {
    const productRepo = this.dataSource.getRepository(ProductEntity);
    const locationRepo = this.dataSource.getRepository(StockLocationEntity);

    const [product, location] = await Promise.all([
      productRepo.findOne({ where: { id: dto.productId } }),
      locationRepo.findOne({ where: { id: dto.locationId } }),
    ]);

    if (!product) {
      throw new NotFoundException(
        `Producto con id ${dto.productId} no encontrado`,
      );
    }
    if (!location) {
      throw new NotFoundException(
        `Ubicación con id ${dto.locationId} no encontrada`,
      );
    }

    this.validateThresholds(dto.stockMin, dto.stockCritical);

    const existing = await this.stockItemRepository.findOne({
      where: { productId: dto.productId, locationId: dto.locationId },
    });

    if (existing) {
      throw new ConflictException(
        'Ya existe un stock para este producto en esta ubicación',
      );
    }

    const stockItem = this.stockItemRepository.create({
      productId: dto.productId,
      locationId: dto.locationId,
      quantityCurrent: 0,
      quantityReserved: 0,
      stockMin: dto.stockMin,
      stockCritical: dto.stockCritical,
    });

    let saved: StockItemEntity;
    try {
      saved = await this.stockItemRepository.save(stockItem);
    } catch (err) {
      if (err instanceof QueryFailedError) {
        throw new ConflictException(
          'Ya existe un stock para este producto en esta ubicación',
        );
      }
      throw err;
    }

    const withRelations = await this.stockItemRepository.findOne({
      where: { id: saved.id },
      relations: ['location', 'product'],
    });

    return new StockItemResponseDto(withRelations!);
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
      throw new BadRequestException('La cantidad debe ser mayor a 0');
    }

    const stockItemId = await this.dataSource.transaction(async (manager) => {
      const stockItem = await manager.findOne(StockItemEntity, {
        where: { productId, locationId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!stockItem) {
        throw new NotFoundException(
          'No existe stock para este producto en esta ubicación',
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
      return stockItem.id;
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
    reportedBy: number,
  ): Promise<StockItemWithMovementsResponseDto> {
    if (dto.quantity <= 0) {
      throw new BadRequestException('La cantidad debe ser mayor a 0');
    }

    await this.dataSource.transaction(async (manager) => {
      const stockItem = await manager.findOne(StockItemEntity, {
        where: { id: dto.stockItemId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!stockItem) {
        throw new NotFoundException(
          `Stock con id ${dto.stockItemId} no encontrado`,
        );
      }

      if (stockItem.quantityAvailable < dto.quantity) {
        throw new BadRequestException(
          `Stock disponible insuficiente — solo ${stockItem.quantityAvailable} disponibles (${stockItem.quantityCurrent} en depósito, ${stockItem.quantityReserved} reservados)`,
        );
      }

      stockItem.quantityCurrent -= dto.quantity;
      await manager.save(StockItemEntity, stockItem);

      const movement = manager.create(StockMovementEntity, {
        stockItemId: stockItem.id,
        operationType: StockOperationType.DAMAGE,
        stockFlow: StockFlow.OUTBOUND,
        quantity: dto.quantity,
        referenceType: StockReferenceType.DAMAGE_REPORT,
      });
      const savedMovement = await manager.save(StockMovementEntity, movement);

      const writeOff = manager.create(StockWriteOffEntity, {
        stockItemId: dto.stockItemId,
        movementId: savedMovement.id,
        quantity: dto.quantity,
        reason: dto.reason,
        description: dto.description ?? null,
        attachments: dto.attachments ?? null,
        reportedBy,
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
      throw new NotFoundException(`Stock con id ${id} no encontrado`);
    }

    const stockMin = dto.stockMin ?? stockItem.stockMin;
    const stockCritical = dto.stockCritical ?? stockItem.stockCritical;

    this.validateThresholds(stockMin, stockCritical);

    stockItem.stockMin = stockMin;
    stockItem.stockCritical = stockCritical;

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
    const execute = async (mgr: EntityManager): Promise<void> => {
      const stockRepo = mgr.getRepository(StockItemEntity);

      const stockItem = await stockRepo.findOne({
        where: { productId, locationId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!stockItem)
        throw new NotFoundException(
          `Stock no encontrado para el producto ${productId}`,
        );

      if (stockItem.quantityCurrent - stockItem.quantityReserved < quantity) {
        throw new BadRequestException(
          `Stock disponible insuficiente para el producto ${productId}`,
        );
      }

      stockItem.quantityReserved += quantity;
      await stockRepo.save(stockItem);
    };

    if (manager) await execute(manager);
    else await this.dataSource.transaction(execute);
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
    let alertThreshold: {
      quantityAvailable: number;
      stockCritical: number;
    } | null = null;

    const execute = async (mgr: EntityManager): Promise<void> => {
      const stockRepo = mgr.getRepository(StockItemEntity);
      const movementRepo = mgr.getRepository(StockMovementEntity);

      const stockItem = await stockRepo.findOne({
        where: { productId, locationId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!stockItem)
        throw new NotFoundException(
          `Stock no encontrado para el producto ${productId}`,
        );

      if (stockItem.quantityReserved < quantity) {
        throw new BadRequestException(
          `No se pueden despachar ${quantity} unidades — solo ${stockItem.quantityReserved} reservadas para el producto ${productId}`,
        );
      }

      if (stockItem.quantityCurrent < quantity) {
        throw new BadRequestException(
          `No se pueden despachar ${quantity} unidades — solo ${stockItem.quantityCurrent} en depósito para el producto ${productId}`,
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

      const quantityAvailable =
        stockItem.quantityCurrent - stockItem.quantityReserved;
      if (quantityAvailable <= stockItem.stockCritical) {
        alertThreshold = {
          quantityAvailable,
          stockCritical: stockItem.stockCritical,
        };
      }
    };

    if (manager) await execute(manager);
    else await this.dataSource.transaction(execute);

    if (alertThreshold) {
      void this.sendLowStockAlert(productId, locationId, alertThreshold);
    }
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
          `Stock no encontrado para el producto ${productId}`,
        );

      if (stockItem.quantityReserved < quantity) {
        throw new BadRequestException(
          `No se pueden liberar ${quantity} unidades — solo ${stockItem.quantityReserved} reservadas para el producto ${productId}`,
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

  private async sendLowStockAlert(
    productId: number,
    locationId: number,
    alert: { quantityAvailable: number; stockCritical: number },
  ): Promise<void> {
    try {
      const productRepo = this.dataSource.getRepository(ProductEntity);
      const locationRepo = this.dataSource.getRepository(StockLocationEntity);

      const [product, location] = await Promise.all([
        productRepo.findOne({ where: { id: productId } }),
        locationRepo.findOne({ where: { id: locationId } }),
      ]);

      await this.mailService.sendStockAlertEmail({
        productName: product?.name ?? `#${productId}`,
        locationName: location?.name ?? `#${locationId}`,
        quantityAvailable: alert.quantityAvailable,
        threshold: alert.stockCritical,
        adminEmail: this.configService.get('SUPERADMIN_EMAIL', {
          infer: true,
        })!,
      });
    } catch {
      // swallow — alert failure must not affect order dispatch
    }
  }

  private async findEntity(id: number): Promise<StockItemEntity> {
    const stockItem = await this.stockItemRepository.findOne({
      where: { id },
      relations: ['location', 'product', 'movements'],
      order: {
        movements: { createdAt: 'DESC' },
      },
    });

    if (!stockItem) {
      throw new NotFoundException(`Stock con id ${id} no encontrado`);
    }

    return stockItem;
  }

  private validateThresholds(stockMin: number, stockCritical: number): void {
    if (stockCritical < 0) {
      throw new BadRequestException('stockCritical no puede ser negativo');
    }

    if (stockCritical >= stockMin) {
      throw new BadRequestException(
        'stockCritical debe ser menor que stockMin',
      );
    }
  }
}
