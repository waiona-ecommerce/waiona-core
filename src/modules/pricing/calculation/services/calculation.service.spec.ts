import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CalculationService } from '../../calculation/services/calculation.service';
import { ProductPricingEntity } from '../../entities/product-pricing.entity';
import { ComboPricingEntity } from '../../entities/combo-pricing.entity';
import { ProductTaxEntity } from 'src/modules/taxation/product-taxes/entities/product-taxes.entity';
import { ComboTaxEntity } from 'src/modules/taxation/combo-taxes/entities/combo-taxes.entity';
import { TaxEntity } from 'src/modules/taxation/taxes/entities/tax.entity';
import { DiscountProductTargetEntity } from 'src/modules/discounts/discount-product-target/entities/discount-product-target.entity';
import { DiscountComboTargetEntity } from 'src/modules/discounts/discount-combo-target/entities/discount-combo-target.entity';
import { CurrencyCode } from 'src/common/enums/currency-code.enum';

describe('CalculationService', () => {
  let service: CalculationService;

  const mockProductPricingRepo = () => ({ findOne: jest.fn() });
  const mockComboPricingRepo = () => ({ findOne: jest.fn() });
  const mockProductTaxRepo = () => ({ find: jest.fn() });
  const mockComboTaxRepo = () => ({ find: jest.fn() });
  const mockTaxRepo = () => ({ find: jest.fn() });
  const mockDiscountProductRepo = () => ({ findOne: jest.fn() });
  const mockDiscountComboRepo = () => ({ findOne: jest.fn() });

  const mockMargin = { id: 1, value: 20, isPercentage: true };

  const mockProductPricing = (overrides = {}) => ({
    id: 1,
    productId: 1,
    currency: CurrencyCode.ARS,
    unitPrice: 500,
    margin: mockMargin,
    deletedAt: null,
    ...overrides,
  });

  const mockComboPricing = (overrides = {}) => ({
    id: 1,
    comboId: 1,
    currency: CurrencyCode.ARS,
    unitPrice: 1200,
    margin: mockMargin,
    deletedAt: null,
    ...overrides,
  });

  let productPricingRepo: any;
  let comboPricingRepo: any;
  let productTaxRepo: any;
  let comboTaxRepo: any;
  let taxRepo: any;
  let discountProductRepo: any;
  let discountComboRepo: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalculationService,
        {
          provide: getRepositoryToken(ProductPricingEntity),
          useFactory: mockProductPricingRepo,
        },
        {
          provide: getRepositoryToken(ComboPricingEntity),
          useFactory: mockComboPricingRepo,
        },
        {
          provide: getRepositoryToken(ProductTaxEntity),
          useFactory: mockProductTaxRepo,
        },
        {
          provide: getRepositoryToken(ComboTaxEntity),
          useFactory: mockComboTaxRepo,
        },
        { provide: getRepositoryToken(TaxEntity), useFactory: mockTaxRepo },
        {
          provide: getRepositoryToken(DiscountProductTargetEntity),
          useFactory: mockDiscountProductRepo,
        },
        {
          provide: getRepositoryToken(DiscountComboTargetEntity),
          useFactory: mockDiscountComboRepo,
        },
      ],
    }).compile();

    service = module.get<CalculationService>(CalculationService);
    productPricingRepo = module.get(getRepositoryToken(ProductPricingEntity));
    comboPricingRepo = module.get(getRepositoryToken(ComboPricingEntity));
    productTaxRepo = module.get(getRepositoryToken(ProductTaxEntity));
    comboTaxRepo = module.get(getRepositoryToken(ComboTaxEntity));
    taxRepo = module.get(getRepositoryToken(TaxEntity));
    discountProductRepo = module.get(
      getRepositoryToken(DiscountProductTargetEntity),
    );
    discountComboRepo = module.get(
      getRepositoryToken(DiscountComboTargetEntity),
    );
  });

  afterEach(() => jest.clearAllMocks());

  // ==========================
  // calculateProduct
  // ==========================

  describe('calculateProduct', () => {
    it('should calculate product price correctly', async () => {
      productPricingRepo.findOne.mockResolvedValue(mockProductPricing());
      discountProductRepo.findOne.mockResolvedValue(null);
      productTaxRepo.find.mockResolvedValue([]);
      taxRepo.find.mockResolvedValue([]);

      const result = await service.calculateProduct({ productId: 1 });

      expect(result.unitPrice).toBe(500);
      expect(result.margin).toBeGreaterThan(0);
      expect(result.finalPrice).toBeGreaterThan(result.unitPrice);
      expect(result.fullPrice).toBeGreaterThanOrEqual(result.finalPrice);
      expect(result.coupon).toBe(0);
      expect(result.orderTotal).toBe(result.finalPrice);
    });

    it('should throw NotFoundException if product has no pricing', async () => {
      productPricingRepo.findOne.mockResolvedValue(null);
      await expect(
        service.calculateProduct({ productId: 999 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // calculateCombo
  // ==========================

  describe('calculateCombo', () => {
    it('should calculate combo price correctly', async () => {
      comboPricingRepo.findOne.mockResolvedValue(mockComboPricing());
      discountComboRepo.findOne.mockResolvedValue(null);
      comboTaxRepo.find.mockResolvedValue([]);
      taxRepo.find.mockResolvedValue([]);

      const result = await service.calculateCombo({ comboId: 1 });

      expect(result.unitPrice).toBe(1200);
      expect(result.finalPrice).toBeGreaterThan(result.unitPrice);
      expect(result.coupon).toBe(0);
      expect(result.orderTotal).toBe(result.finalPrice);
    });

    it('should throw NotFoundException if combo has no pricing', async () => {
      comboPricingRepo.findOne.mockResolvedValue(null);
      await expect(service.calculateCombo({ comboId: 999 })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==========================
  // preview
  // ==========================

  describe('preview', () => {
    it('should calculate preview without DB', () => {
      const result = service.preview({
        unitPrice: 500,
        discountValue: 10,
        discountIsPercentage: true,
        marginValue: 20,
        marginIsPercentage: true,
        taxes: [{ value: 21, isPercentage: true }],
        couponValue: 50,
        couponIsPercentage: false,
      });

      expect(result.unitPrice).toBe(500);
      expect(result.discount).toBeGreaterThan(0);
      expect(result.finalPrice).toBeGreaterThan(0);
      expect(result.fullPrice).toBeGreaterThanOrEqual(result.finalPrice);
    });
  });
});
