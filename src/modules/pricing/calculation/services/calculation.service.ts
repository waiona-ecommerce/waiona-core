import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProductPricingEntity } from '../../entities/product-pricing.entity';
import { ComboPricingEntity } from '../../entities/combo-pricing.entity';
import { ProductTaxEntity } from 'src/modules/taxation/product-taxes/entities/product-taxes.entity';
import { ComboTaxEntity } from 'src/modules/taxation/combo-taxes/entities/combo-taxes.entity';
import { TaxEntity } from 'src/modules/taxation/taxes/entities/tax.entity';
import { DiscountProductTargetEntity } from 'src/modules/discounts/discount-product-target/entities/discount-product-target.entity';
import { DiscountComboTargetEntity } from 'src/modules/discounts/discount-combo-target/entities/discount-combo-target.entity';
import { CouponEntity } from 'src/modules/coupons/coupon/entities/coupon.entity';
import { CouponProductTargetEntity } from 'src/modules/coupons/coupon-product-target/entities/coupon-product-target.entity';
import { CouponComboTargetEntity } from 'src/modules/coupons/coupon-combo-target/entities/coupon-combo-target.entity';

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

    @InjectRepository(ComboTaxEntity)
    private comboTaxRepo: Repository<ComboTaxEntity>,

    @InjectRepository(TaxEntity)
    private taxRepo: Repository<TaxEntity>,

    @InjectRepository(DiscountProductTargetEntity)
    private discountProductRepo: Repository<DiscountProductTargetEntity>,

    @InjectRepository(DiscountComboTargetEntity)
    private discountComboRepo: Repository<DiscountComboTargetEntity>,

    @InjectRepository(CouponEntity)
    private couponRepo: Repository<CouponEntity>,

    @InjectRepository(CouponProductTargetEntity)
    private couponProductTargetRepo: Repository<CouponProductTargetEntity>,

    @InjectRepository(CouponComboTargetEntity)
    private couponComboTargetRepo: Repository<CouponComboTargetEntity>,
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

    // 1. Descuento sobre unitPrice
    const discount = this.applyValue(unitPrice, dto.discountValue, dto.discountIsPercentage);
    const priceAfterDiscount = unitPrice - discount;

    // 2. Margen sobre priceAfterDiscount
    const margin = this.applyValue(priceAfterDiscount, dto.marginValue, dto.marginIsPercentage);
    const priceAfterMargin = priceAfterDiscount + margin;

    // 3. Impuestos sobre priceAfterMargin
    const taxes = (dto.taxes ?? []).reduce((acc, tax) => {
      return acc + this.applyValue(priceAfterMargin, tax.value, tax.isPercentage);
    }, 0);
    const finalPrice = priceAfterMargin + taxes;

    // 4. fullPrice — precio sin descuento (margen e impuestos recalculados sobre unitPrice)
    const marginFull = this.applyValue(unitPrice, dto.marginValue, dto.marginIsPercentage);
    const priceAfterMarginFull = unitPrice + marginFull;
    const taxesFull = (dto.taxes ?? []).reduce((acc, tax) => {
      return acc + this.applyValue(priceAfterMarginFull, tax.value, tax.isPercentage);
    }, 0);
    const fullPrice = priceAfterMarginFull + taxesFull;

    // 5. Cupón sobre finalPrice (nivel orden)
    const coupon = this.applyValue(finalPrice, dto.couponValue, dto.couponIsPercentage);
    const orderTotal = finalPrice - coupon;

    return this.buildBreakdown(unitPrice, discount, priceAfterDiscount, margin, priceAfterMargin, taxes, finalPrice, fullPrice, coupon, orderTotal);
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

    const activeDiscount = discountTarget?.discount && this.isActive(discountTarget.discount.startsAt, discountTarget.discount.endsAt, now)
      ? discountTarget.discount
      : null;

    const discount = activeDiscount
      ? this.applyValue(unitPrice, activeDiscount.value, activeDiscount.isPercentage)
      : 0;
    const priceAfterDiscount = unitPrice - discount;

    // 3. Margen
    const margin = pricing.margin
      ? this.applyValue(priceAfterDiscount, Number(pricing.margin.value), pricing.margin.isPercentage)
      : 0;
    const priceAfterMargin = priceAfterDiscount + margin;

    // 4. Impuestos del producto + globales
    const taxes = await this.calculateTaxesForProduct(dto.productId, priceAfterMargin);
    const finalPrice = priceAfterMargin + taxes;

    // 4b. fullPrice — precio sin descuento (margen e impuestos sobre unitPrice)
    const marginFull = pricing.margin
      ? this.applyValue(unitPrice, Number(pricing.margin.value), pricing.margin.isPercentage)
      : 0;
    const priceAfterMarginFull = unitPrice + marginFull;
    const taxesFull = await this.calculateTaxesForProduct(dto.productId, priceAfterMarginFull);
    const fullPrice = priceAfterMarginFull + taxesFull;

    // 5. Cupón (nivel orden)
    const coupon = dto.couponCode
      ? await this.applyCoupon(dto.couponCode, finalPrice, now, { productId: dto.productId })
      : 0;
    const orderTotal = finalPrice - coupon;

    return this.buildBreakdown(unitPrice, discount, priceAfterDiscount, margin, priceAfterMargin, taxes, finalPrice, fullPrice, coupon, orderTotal);
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

    const activeDiscount = discountTarget?.discount && this.isActive(discountTarget.discount.startsAt, discountTarget.discount.endsAt, now)
      ? discountTarget.discount
      : null;

    const discount = activeDiscount
      ? this.applyValue(unitPrice, activeDiscount.value, activeDiscount.isPercentage)
      : 0;
    const priceAfterDiscount = unitPrice - discount;

    // 3. Margen
    const margin = pricing.margin
      ? this.applyValue(priceAfterDiscount, Number(pricing.margin.value), pricing.margin.isPercentage)
      : 0;
    const priceAfterMargin = priceAfterDiscount + margin;

    // 4. Impuestos del combo + globales
    const taxes = await this.calculateTaxesForCombo(dto.comboId, priceAfterMargin);
    const finalPrice = priceAfterMargin + taxes;

    // 4b. fullPrice — precio sin descuento (margen e impuestos sobre unitPrice)
    const marginFull = pricing.margin
      ? this.applyValue(unitPrice, Number(pricing.margin.value), pricing.margin.isPercentage)
      : 0;
    const priceAfterMarginFull = unitPrice + marginFull;
    const taxesFull = await this.calculateTaxesForCombo(dto.comboId, priceAfterMarginFull);
    const fullPrice = priceAfterMarginFull + taxesFull;

    // 5. Cupón
    const coupon = dto.couponCode
      ? await this.applyCoupon(dto.couponCode, finalPrice, now, { comboId: dto.comboId })
      : 0;
    const orderTotal = finalPrice - coupon;

    return this.buildBreakdown(unitPrice, discount, priceAfterDiscount, margin, priceAfterMargin, taxes, finalPrice, fullPrice, coupon, orderTotal);
  }

  // ==========================
  // COUPON — nivel orden (público)
  // ==========================

  async computeOrderCouponDiscount(
    couponCode: string,
    items: Array<{ productId?: number; comboId?: number; subtotal: number }>,
  ): Promise<number> {
    const now = new Date();

    const coupon = await this.couponRepo.findOne({ where: { code: couponCode } });
    if (!coupon) return 0;
    if (!this.isActive(coupon.startsAt, coupon.endsAt, now)) return 0;
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) return 0;

    if (coupon.isGlobal) {
      const total = items.reduce((sum, i) => sum + i.subtotal, 0);
      return this.applyValue(total, coupon.value, coupon.isPercentage);
    }

    let eligibleSubtotal = 0;
    for (const item of items) {
      if (item.productId) {
        const target = await this.couponProductTargetRepo.findOne({
          where: { couponId: coupon.id, productId: item.productId },
        });
        if (target) eligibleSubtotal += item.subtotal;
      }
      if (item.comboId) {
        const target = await this.couponComboTargetRepo.findOne({
          where: { couponId: coupon.id, comboId: item.comboId },
        });
        if (target) eligibleSubtotal += item.subtotal;
      }
    }

    if (eligibleSubtotal === 0) return 0;
    return this.applyValue(eligibleSubtotal, coupon.value, coupon.isPercentage);
  }

  // ==========================
  // HELPERS PRIVADOS
  // ==========================

  /**
   * Aplica un valor (% o fijo) sobre un precio base.
   * Si no hay valor devuelve 0.
   */
  private applyValue(base: number, value?: number, isPercentage?: boolean): number {
    if (!value) return 0;
    return isPercentage ? base * (value / 100) : value;
  }

  /**
   * Verifica si un descuento/cupón está vigente según sus fechas.
   */
  private isActive(startsAt?: Date | null, endsAt?: Date | null, now = new Date()): boolean {
    if (startsAt && now < startsAt) return false;
    if (endsAt && now > endsAt) return false;
    return true;
  }

  /**
   * Calcula el total de impuestos para un producto.
   * Suma impuestos propios + globales, sobre el precio base recibido.
   */
  private async calculateTaxesForProduct(productId: number, base: number): Promise<number> {
    const [productTaxes, globalTaxes] = await Promise.all([
      this.productTaxRepo.find({
        where: { productId },
        relations: ['tax'],
      }),
      this.taxRepo.find({
        where: { isGlobal: true },
      }),
    ]);

    const seen = new Set<number>();
    const allTaxes: TaxEntity[] = [];
    for (const pt of productTaxes) { seen.add(pt.tax.id); allTaxes.push(pt.tax); }
    for (const t of globalTaxes)   { if (!seen.has(t.id)) allTaxes.push(t); }

    return allTaxes.reduce((acc, tax) => {
      return acc + this.applyValue(base, Number(tax.value), tax.isPercentage);
    }, 0);
  }

  /**
   * Calcula el total de impuestos para un combo.
   * Suma impuestos propios + globales.
   */
  private async calculateTaxesForCombo(comboId: number, base: number): Promise<number> {
    const [comboTaxes, globalTaxes] = await Promise.all([
      this.comboTaxRepo.find({
        where: { comboId },
        relations: ['tax'],
      }),
      this.taxRepo.find({
        where: { isGlobal: true },
      }),
    ]);

    const seen = new Set<number>();
    const allTaxes: TaxEntity[] = [];
    for (const ct of comboTaxes) { seen.add(ct.tax.id); allTaxes.push(ct.tax); }
    for (const t of globalTaxes)  { if (!seen.has(t.id)) allTaxes.push(t); }

    return allTaxes.reduce((acc, tax) => {
      return acc + this.applyValue(base, Number(tax.value), tax.isPercentage);
    }, 0);
  }

  /**
   * Aplica un cupón sobre el precio final.
   * Verifica que esté vigente y tenga usos disponibles.
   */
  private async applyCoupon(
    code: string,
    base: number,
    now: Date,
    context?: { productId?: number; comboId?: number },
  ): Promise<number> {

    const coupon = await this.couponRepo.findOne({
      where: { code },
    });

    if (!coupon) return 0;
    if (!this.isActive(coupon.startsAt, coupon.endsAt, now)) return 0;
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) return 0;

    // 🔥 si el cupón no es global, verificar que aplica al producto/combo
    if (!coupon.isGlobal && context) {

      if (context.productId) {
        const target = await this.couponProductTargetRepo.findOne({
          where: { couponId: coupon.id, productId: context.productId },
        });
        if (!target) return 0; // cupón no aplica a este producto
      }

      if (context.comboId) {
        const target = await this.couponComboTargetRepo.findOne({
          where: { couponId: coupon.id, comboId: context.comboId },
        });
        if (!target) return 0; // cupón no aplica a este combo
      }
    }

    return this.applyValue(base, coupon.value, coupon.isPercentage);
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