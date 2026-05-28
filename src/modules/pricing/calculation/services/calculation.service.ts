import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProductPricingEntity } from '../../entities/product-pricing.entity';
import { ComboPricingEntity } from '../../entities/combo-pricing.entity';
import { ProductTaxEntity } from 'src/modules/taxation/product-taxes/entities/product-taxes.entity';
import { TaxEntity } from 'src/modules/taxation/taxes/entities/tax.entity';
import { ComboItemEntity } from 'src/modules/products/combos/entities/combo-item.entity';
import { DiscountProductTargetEntity } from 'src/modules/discounts/discount-product-target/entities/discount-product-target.entity';
import { DiscountComboTargetEntity } from 'src/modules/discounts/discount-combo-target/entities/discount-combo-target.entity';

import { CalculatePreviewDto } from '../dto/calculate-preview.dto';
import { CalculateProductDto } from '../dto/calculate-product.dto';
import { CalculateComboDto } from '../dto/calculate-combo.dto';
import { PriceBreakdownDto } from '../dto/price-breakdown.dto';

@Injectable()
export class CalculationService {
  constructor(
    @InjectRepository(ProductPricingEntity)
    private productPricingRepo: Repository<ProductPricingEntity>,

    @InjectRepository(ComboPricingEntity)
    private comboPricingRepo: Repository<ComboPricingEntity>,

    @InjectRepository(ProductTaxEntity)
    private productTaxRepo: Repository<ProductTaxEntity>,

    @InjectRepository(TaxEntity)
    private taxRepo: Repository<TaxEntity>,

    @InjectRepository(ComboItemEntity)
    private comboItemRepo: Repository<ComboItemEntity>,

    @InjectRepository(DiscountProductTargetEntity)
    private discountProductRepo: Repository<DiscountProductTargetEntity>,

    @InjectRepository(DiscountComboTargetEntity)
    private discountComboRepo: Repository<DiscountComboTargetEntity>,
  ) {}

  // ==========================
  // PREVIEW — sin DB
  // ==========================

  /**
   * Calcula el precio final con valores manuales.
   * No toca la DB. Útil para probar combinaciones antes de cargarlas.
   */
  preview(dto: CalculatePreviewDto): PriceBreakdownDto {
    const unitPrice = dto.unitPrice;

    // 1. Descuento sobre unitPrice (siempre porcentaje)
    const discount = this.applyValue(unitPrice, dto.discountValue, true);
    const priceAfterDiscount = unitPrice - discount;

    // 2. Margen sobre priceAfterDiscount (siempre porcentaje)
    const margin = this.applyValue(priceAfterDiscount, dto.marginValue, true);
    const priceAfterMargin = priceAfterDiscount + margin;

    // 3. Impuestos sobre priceAfterMargin
    const taxes = (dto.taxes ?? []).reduce((acc, tax) => {
      return (
        acc + this.applyValue(priceAfterMargin, tax.value, tax.isPercentage)
      );
    }, 0);
    const finalPrice = priceAfterMargin + taxes;

    // 4. fullPrice — precio sin descuento (margen e impuestos recalculados sobre unitPrice)
    const marginFull = this.applyValue(unitPrice, dto.marginValue, true);
    const priceAfterMarginFull = unitPrice + marginFull;
    const taxesFull = (dto.taxes ?? []).reduce((acc, tax) => {
      return (
        acc + this.applyValue(priceAfterMarginFull, tax.value, tax.isPercentage)
      );
    }, 0);
    const fullPrice = priceAfterMarginFull + taxesFull;

    // 5. Cupón sobre finalPrice (nivel orden)
    const coupon = this.applyValue(
      finalPrice,
      dto.couponValue,
      dto.couponIsPercentage,
    );
    const orderTotal = finalPrice - coupon;

    return this.buildBreakdown(
      unitPrice,
      discount,
      priceAfterDiscount,
      margin,
      priceAfterMargin,
      taxes,
      finalPrice,
      fullPrice,
      coupon,
      orderTotal,
    );
  }

  // ==========================
  // CALCULATE PRODUCT — desde DB
  // ==========================

  /**
   * Calcula el precio final de un producto real.
   * Busca pricing, margen, impuestos y descuento vigente en la DB.
   */
  async calculateProduct(dto: CalculateProductDto): Promise<PriceBreakdownDto> {
    const now = new Date();

    // 1. Obtener pricing del producto
    const pricing = await this.productPricingRepo.findOne({
      where: { productId: dto.productId },
      relations: ['margin'],
    });
    if (!pricing) throw new NotFoundException('Product pricing not found');

    const unitPrice = Number(pricing.unitPrice);

    // 2. Descuento vigente del producto
    const discountTarget = await this.discountProductRepo.findOne({
      where: { productId: dto.productId },
      relations: ['discount'],
    });

    const activeDiscount =
      discountTarget?.discount &&
      this.isActive(
        discountTarget.discount.startsAt,
        discountTarget.discount.endsAt,
        now,
      )
        ? discountTarget.discount
        : null;

    const discount = activeDiscount
      ? this.applyValue(unitPrice, activeDiscount.value, true)
      : 0;
    const priceAfterDiscount = unitPrice - discount;

    // 3. Margen (siempre porcentaje)
    const margin = pricing.margin
      ? this.applyValue(priceAfterDiscount, Number(pricing.margin.value), true)
      : 0;
    const priceAfterMargin = priceAfterDiscount + margin;

    // 4. Impuestos del producto + globales
    const taxEntities = await this.fetchTaxesForProduct(dto.productId);
    const taxes = this.sumTaxes(taxEntities, priceAfterMargin);
    const finalPrice = priceAfterMargin + taxes;

    // 4b. fullPrice — precio sin descuento (margen e impuestos sobre unitPrice)
    const marginFull = pricing.margin
      ? this.applyValue(unitPrice, Number(pricing.margin.value), true)
      : 0;
    const priceAfterMarginFull = unitPrice + marginFull;
    const taxesFull = this.sumTaxes(taxEntities, priceAfterMarginFull);
    const fullPrice = priceAfterMarginFull + taxesFull;

    return this.buildBreakdown(
      unitPrice,
      discount,
      priceAfterDiscount,
      margin,
      priceAfterMargin,
      taxes,
      finalPrice,
      fullPrice,
      0,
      finalPrice,
    );
  }

  // ==========================
  // CALCULATE COMBO — desde DB
  // ==========================

  /**
   * Calcula el precio final de un combo real.
   * Busca pricing, margen, impuestos y descuento vigente en la DB.
   */
  async calculateCombo(dto: CalculateComboDto): Promise<PriceBreakdownDto> {
    const now = new Date();

    // 1. Obtener pricing del combo
    const pricing = await this.comboPricingRepo.findOne({
      where: { comboId: dto.comboId },
      relations: ['margin'],
    });
    if (!pricing) throw new NotFoundException('Combo pricing not found');

    const unitPrice = Number(pricing.unitPrice);

    // 2. Descuento vigente del combo
    const discountTarget = await this.discountComboRepo.findOne({
      where: { comboId: dto.comboId },
      relations: ['discount'],
    });

    const activeDiscount =
      discountTarget?.discount &&
      this.isActive(
        discountTarget.discount.startsAt,
        discountTarget.discount.endsAt,
        now,
      )
        ? discountTarget.discount
        : null;

    const discount = activeDiscount
      ? this.applyValue(unitPrice, activeDiscount.value, true)
      : 0;
    const priceAfterDiscount = unitPrice - discount;

    // 3. Margen (siempre porcentaje)
    const margin = pricing.margin
      ? this.applyValue(priceAfterDiscount, Number(pricing.margin.value), true)
      : 0;
    const priceAfterMargin = priceAfterDiscount + margin;

    // 4. Impuestos via prorrateo (globales + específicos de cada producto)
    const taxes = await this.sumTaxesWithProration(
      dto.comboId,
      priceAfterMargin,
    );
    const finalPrice = priceAfterMargin + taxes;

    // 4b. fullPrice — precio sin descuento (margen e impuestos sobre unitPrice)
    const marginFull = pricing.margin
      ? this.applyValue(unitPrice, Number(pricing.margin.value), true)
      : 0;
    const priceAfterMarginFull = unitPrice + marginFull;
    const taxesFull = await this.sumTaxesWithProration(
      dto.comboId,
      priceAfterMarginFull,
    );
    const fullPrice = priceAfterMarginFull + taxesFull;

    return this.buildBreakdown(
      unitPrice,
      discount,
      priceAfterDiscount,
      margin,
      priceAfterMargin,
      taxes,
      finalPrice,
      fullPrice,
      0,
      finalPrice,
    );
  }

  // ==========================
  // HELPERS PRIVADOS
  // ==========================

  /**
   * Aplica un valor (% o fijo) sobre un precio base.
   * Si no hay valor devuelve 0.
   */
  private applyValue(
    base: number,
    value?: number,
    isPercentage?: boolean,
  ): number {
    if (!value) return 0;
    return isPercentage ? base * (value / 100) : value;
  }

  /**
   * Verifica si un descuento/cupón está vigente según sus fechas.
   */
  private isActive(
    startsAt?: Date | null,
    endsAt?: Date | null,
    now = new Date(),
  ): boolean {
    if (startsAt && now < startsAt) return false;
    if (endsAt && now > endsAt) return false;
    return true;
  }

  private async fetchTaxesForProduct(productId: number): Promise<TaxEntity[]> {
    const [productTaxes, globalTaxes] = await Promise.all([
      this.productTaxRepo.find({ where: { productId }, relations: ['tax'] }),
      this.taxRepo.find({ where: { isGlobal: true } }),
    ]);
    const seen = new Set<number>();
    const allTaxes: TaxEntity[] = [];
    for (const pt of productTaxes) {
      seen.add(pt.tax.id);
      allTaxes.push(pt.tax);
    }
    for (const t of globalTaxes) {
      if (!seen.has(t.id)) allTaxes.push(t);
    }
    return allTaxes;
  }

  private async sumTaxesWithProration(
    comboId: number,
    comboPrice: number,
  ): Promise<number> {
    // 1. Taxes globales sobre el precio total del combo
    const globalTaxes = await this.taxRepo.find({ where: { isGlobal: true } });
    const globalTaxIds = new Set(globalTaxes.map((t) => t.id));
    const globalAmount = this.sumTaxes(globalTaxes, comboPrice);

    // 2. Items del combo con su pricing de referencia
    const items = await this.comboItemRepo.find({ where: { comboId } });
    if (!items.length) return globalAmount;

    const itemsWithRef = await Promise.all(
      items.map(async (item) => {
        const pricing = await this.productPricingRepo.findOne({
          where: { productId: item.productId },
        });
        return {
          productId: item.productId,
          refPrice: pricing ? Number(pricing.unitPrice) * item.quantity : 0,
        };
      }),
    );

    const totalRef = itemsWithRef.reduce((acc, i) => acc + i.refPrice, 0);
    if (!totalRef) return globalAmount;

    // 3. Taxes específicos de cada producto aplicados sobre su base prorrateada
    let specificAmount = 0;
    for (const item of itemsWithRef) {
      if (!item.refPrice) continue;

      const proratedBase = comboPrice * (item.refPrice / totalRef);

      const productTaxes = await this.productTaxRepo.find({
        where: { productId: item.productId },
        relations: ['tax'],
      });

      for (const pt of productTaxes) {
        if (!globalTaxIds.has(pt.tax.id)) {
          specificAmount += this.applyValue(
            proratedBase,
            Number(pt.tax.value),
            pt.tax.isPercentage,
          );
        }
      }
    }

    return globalAmount + specificAmount;
  }

  private sumTaxes(taxes: TaxEntity[], base: number): number {
    return taxes.reduce(
      (acc, tax) =>
        acc + this.applyValue(base, Number(tax.value), tax.isPercentage),
      0,
    );
  }

  /**
   * Construye el objeto de respuesta con todos los valores redondeados a 2 decimales.
   */
  private buildBreakdown(
    unitPrice: number,
    discount: number,
    priceAfterDiscount: number,
    margin: number,
    priceAfterMargin: number,
    taxes: number,
    finalPrice: number,
    fullPrice: number,
    coupon: number,
    orderTotal: number,
  ): PriceBreakdownDto {
    const r = (n: number) => Math.round(n * 100) / 100;
    return {
      unitPrice: r(unitPrice),
      discount: r(discount),
      priceAfterDiscount: r(priceAfterDiscount),
      margin: r(margin),
      priceAfterMargin: r(priceAfterMargin),
      taxes: r(taxes),
      finalPrice: r(finalPrice),
      fullPrice: r(fullPrice),
      coupon: r(coupon),
      orderTotal: r(orderTotal),
    };
  }
}
