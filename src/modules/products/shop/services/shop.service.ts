import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, In, FindOptionsWhere } from 'typeorm';

import { ProductEntity } from '../../product/entities/product.entity';
import { ComboEntity } from '../../combos/entities/combo.entity';
import { CategoryEntity } from '../../categories/entities/category.entity';
import { CategoryTreeResponseDto } from '../../categories/dto/category-tree-response.dto';

import { SearchShopDto } from '../dto/search-shop.dto';
import { ShopPaginatedResponseDto } from '../dto/shop-paginated-response.dto';
import { ShopItemResponseDto } from '../dto/shop-response.dto';
import {
  ShopDetailResponseDto,
  ComboItemShopDto,
} from '../dto/shop-detail-response.dto';

import { CalculationService } from '../../../pricing/calculation/services/calculation.service';
import { StockItemsService } from '../../../stocks/stock-item/services/stock-item.service';
import { PriceBreakdownDto } from '../../../pricing/calculation/dto/price-breakdown.dto';
import { StockItemEntity } from '../../../stocks/stock-item/entities/stock-item.entity';

@Injectable()
export class ShopService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,

    @InjectRepository(ComboEntity)
    private readonly comboRepository: Repository<ComboEntity>,

    @InjectRepository(CategoryEntity)
    private readonly categoryRepository: Repository<CategoryEntity>,

    private readonly calculationService: CalculationService,
    private readonly stockItemsService: StockItemsService,
  ) {}

  // ==========================
  // CATEGORIES
  // ==========================

  async getCategories(): Promise<CategoryTreeResponseDto[]> {
    const all = await this.categoryRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });

    for (const cat of all) {
      cat.children = [];
    }

    const map = new Map(all.map((cat) => [cat.id, cat]));
    const roots: CategoryEntity[] = [];

    for (const cat of all) {
      if (cat.parentId != null) {
        const parent = map.get(cat.parentId);
        if (parent) {
          parent.children!.push(cat);
        }
        // padre inactivo o ausente → no mostrar en el shop
      } else {
        roots.push(cat);
      }
    }

    return roots.map((root) => new CategoryTreeResponseDto(root));
  }

  // ==========================
  // SEARCH (LISTADO)
  // ==========================

  async search(dto: SearchShopDto): Promise<ShopPaginatedResponseDto> {
    const {
      search,
      type,
      page = 1,
      limit = 20,
      minPrice,
      maxPrice,
      categoryId,
    } = dto;

    if (
      minPrice !== undefined &&
      maxPrice !== undefined &&
      minPrice > maxPrice
    ) {
      throw new BadRequestException('minPrice no puede ser mayor que maxPrice');
    }

    const skip = (page - 1) * limit;

    // Recolectar IDs de la categoría y todos sus descendientes activos
    let categoryIds: number[] | undefined;
    if (categoryId) {
      const allCategories = await this.categoryRepository.find({
        where: { isActive: true },
        select: ['id', 'parentId'],
      });
      if (!allCategories.some((c) => c.id === categoryId)) {
        throw new NotFoundException(
          `Categoría con id ${categoryId} no encontrada`,
        );
      }
      categoryIds = this.collectDescendantIds(categoryId, allCategories);
    }

    type Candidate =
      | { kind: 'product'; entity: ProductEntity }
      | { kind: 'combo'; entity: ComboEntity };

    const candidates: Candidate[] = [];

    if (!type || type === 'product') {
      const where: FindOptionsWhere<ProductEntity> = { isActive: true };
      if (search) where.name = ILike(`%${search}%`);
      if (categoryIds) where.categoryId = In(categoryIds);
      const products = await this.productRepository.find({
        where,
        relations: ['images', 'category'],
        order: { name: 'ASC' },
      });
      candidates.push(
        ...products.map((entity) => ({ kind: 'product' as const, entity })),
      );
    }

    if (!type || type === 'combo') {
      const where: FindOptionsWhere<ComboEntity> = { isActive: true };
      if (search) where.name = ILike(`%${search}%`);
      if (categoryIds) where.categoryId = In(categoryIds);
      const combos = await this.comboRepository.find({
        where,
        relations: ['images', 'category'],
        order: { name: 'ASC' },
      });
      candidates.push(
        ...combos.map((entity) => ({ kind: 'combo' as const, entity })),
      );
    }

    candidates.sort((a, b) => a.entity.name.localeCompare(b.entity.name));

    // Calcular precios para todos los candidatos para obtener total y paginación exactos
    const allItems = (
      await Promise.all(
        candidates.map((c) =>
          c.kind === 'product'
            ? this.buildProductListItem(c.entity, minPrice, maxPrice)
            : this.buildComboListItem(c.entity, minPrice, maxPrice),
        ),
      )
    ).filter((i): i is ShopItemResponseDto => i !== null);

    const total = allItems.length;
    const totalPages = Math.ceil(total / limit);

    return {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      data: allItems.slice(skip, skip + limit),
    };
  }

  // ==========================
  // DETAIL (CLICK)
  // ==========================

  async findById(
    id: number,
    type: 'product' | 'combo',
  ): Promise<ShopDetailResponseDto> {
    if (!type) {
      throw new BadRequestException(
        'El parámetro type es requerido (product | combo)',
      );
    }

    let result: ShopDetailResponseDto;
    if (type === 'product') result = await this.buildProductDetail(id);
    else if (type === 'combo') result = await this.buildComboDetail(id);
    else throw new BadRequestException('Tipo inválido');

    return result;
  }

  // ==========================
  // PRIVATE — PRODUCT LIST ITEM
  // ==========================

  private async buildProductListItem(
    product: ProductEntity,
    minPrice?: number,
    maxPrice?: number,
  ): Promise<ShopItemResponseDto | null> {
    const [priceData, stock] = await Promise.all([
      this.safeCalculateProduct(product.id),
      this.safeGetStockByProduct(product.id),
    ]);

    if (!priceData) return null;
    if (minPrice !== undefined && priceData.finalPrice < minPrice) return null;
    if (maxPrice !== undefined && priceData.finalPrice > maxPrice) return null;

    const image = product.images?.sort((a, b) => a.position - b.position)[0]
      ?.url;

    return {
      id: product.id,
      name: product.name,
      type: 'product',
      originalPrice: priceData.fullPrice,
      finalPrice: priceData.finalPrice,
      discountAmount: priceData.discount,
      hasDiscount: priceData.discount > 0,
      inStock: stock ? stock.quantityAvailable > 0 : false,
      quantityAvailable: stock?.quantityAvailable ?? 0,
      image,
      category: product.category?.name,
    };
  }

  // ==========================
  // PRIVATE — COMBO LIST ITEM
  // ==========================

  private async buildComboListItem(
    combo: ComboEntity,
    minPrice?: number,
    maxPrice?: number,
  ): Promise<ShopItemResponseDto | null> {
    const [priceData, comboStock] = await Promise.all([
      this.safeCalculateCombo(combo.id),
      this.safeGetStockByCombo(combo.id),
    ]);

    if (!priceData) return null;
    if (minPrice !== undefined && priceData.finalPrice < minPrice) return null;
    if (maxPrice !== undefined && priceData.finalPrice > maxPrice) return null;
    const image = combo.images?.sort((a, b) => a.position - b.position)[0]?.url;

    return {
      id: combo.id,
      name: combo.name,
      type: 'combo',
      originalPrice: priceData.fullPrice,
      finalPrice: priceData.finalPrice,
      discountAmount: priceData.discount,
      hasDiscount: priceData.discount > 0,
      inStock: comboStock?.inStock ?? false,
      quantityAvailable: comboStock?.quantityAvailable ?? 0,
      image,
      category: combo.category?.name,
    };
  }

  // ==========================
  // PRIVATE — PRODUCT DETAIL
  // ==========================

  private async buildProductDetail(id: number): Promise<ShopDetailResponseDto> {
    const product = await this.productRepository.findOne({
      where: { id, isActive: true },
      relations: ['images', 'category'],
    });

    if (!product) throw new NotFoundException('Producto no encontrado');

    const priceData = await this.safeCalculateProduct(id);
    if (!priceData)
      throw new NotFoundException('El producto no tiene precio configurado');

    const stock = await this.safeGetStockByProduct(id);

    const images =
      product.images
        ?.sort((a, b) => a.position - b.position)
        .map((img) => img.url) ?? [];

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      type: 'product',
      originalPrice: priceData.fullPrice,
      finalPrice: priceData.finalPrice,
      discountAmount: priceData.discount,
      priceAfterDiscount: priceData.priceAfterDiscount,
      taxes: priceData.taxes,
      hasDiscount: priceData.discount > 0,
      inStock: stock ? stock.quantityAvailable > 0 : false,
      quantityAvailable: stock?.quantityAvailable ?? 0,
      stockStatus: this.resolveStockStatus(stock),
      category: product.category?.name,
      images,
    };
  }

  // ==========================
  // PRIVATE — COMBO DETAIL
  // ==========================

  private async buildComboDetail(id: number): Promise<ShopDetailResponseDto> {
    const combo = await this.comboRepository.findOne({
      where: { id, isActive: true },
      relations: ['images', 'items', 'items.product', 'category'],
    });

    if (!combo) throw new NotFoundException('Combo no encontrado');

    const priceData = await this.safeCalculateCombo(id);
    if (!priceData)
      throw new NotFoundException('El combo no tiene precio configurado');

    const comboStock = await this.safeGetStockByCombo(id);
    const images =
      combo.images
        ?.sort((a, b) => a.position - b.position)
        .map((img) => img.url) ?? [];

    const items: ComboItemShopDto[] =
      combo.items?.map((item) => ({
        productId: item.productId,
        productName: item.product?.name ?? '',
        quantity: item.quantity,
      })) ?? [];

    return {
      id: combo.id,
      name: combo.name,
      description: combo.description,
      type: 'combo',
      originalPrice: priceData.fullPrice,
      finalPrice: priceData.finalPrice,
      discountAmount: priceData.discount,
      priceAfterDiscount: priceData.priceAfterDiscount,
      taxes: priceData.taxes,
      hasDiscount: priceData.discount > 0,
      inStock: comboStock?.inStock ?? false,
      quantityAvailable: comboStock?.quantityAvailable ?? 0,
      stockStatus: comboStock
        ? this.resolveStockStatusFromValues(
            comboStock.quantityAvailable,
            comboStock.stockCritical,
            comboStock.stockMin,
          )
        : 'out_of_stock',
      category: combo.category?.name,
      images,
      items,
    };
  }

  // ==========================
  // PRIVATE — SAFE WRAPPERS
  // ==========================

  private async safeCalculateProduct(
    productId: number,
  ): Promise<PriceBreakdownDto | null> {
    try {
      return await this.calculationService.calculateProduct({ productId });
    } catch {
      return null;
    }
  }

  private async safeCalculateCombo(
    comboId: number,
  ): Promise<PriceBreakdownDto | null> {
    try {
      return await this.calculationService.calculateCombo({ comboId });
    } catch {
      return null;
    }
  }

  private async safeGetStockByProduct(
    productId: number,
  ): Promise<StockItemEntity | null> {
    try {
      return await this.stockItemsService.findByProduct(productId);
    } catch {
      return null;
    }
  }

  private async safeGetStockByCombo(comboId: number): Promise<{
    quantityAvailable: number;
    inStock: boolean;
    stockMin: number;
    stockCritical: number;
  } | null> {
    try {
      return await this.stockItemsService.findByCombo(comboId);
    } catch {
      return null;
    }
  }

  // ==========================
  // PRIVATE — STOCK STATUS
  // ==========================

  private resolveStockStatusFromValues(
    quantityAvailable: number,
    stockCritical: number,
    stockMin: number,
  ): 'available' | 'low' | 'critical' | 'out_of_stock' {
    if (quantityAvailable <= 0) return 'out_of_stock';
    if (quantityAvailable <= stockCritical) return 'critical';
    if (quantityAvailable <= stockMin) return 'low';
    return 'available';
  }

  private resolveStockStatus(
    stock: StockItemEntity | null,
  ): 'available' | 'low' | 'critical' | 'out_of_stock' {
    if (!stock) return 'out_of_stock';
    return this.resolveStockStatusFromValues(
      stock.quantityAvailable,
      stock.stockCritical,
      stock.stockMin,
    );
  }

  private collectDescendantIds(
    rootId: number,
    allCategories: { id: number; parentId?: number | null }[],
  ): number[] {
    const ids = [rootId];
    const queue = [rootId];
    while (queue.length) {
      const parentId = queue.shift()!;
      for (const cat of allCategories) {
        if (cat.parentId === parentId) {
          ids.push(cat.id);
          queue.push(cat.id);
        }
      }
    }
    return ids;
  }
}
