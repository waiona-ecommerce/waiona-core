import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CalculationService } from '../../calculation/services/calculation.service';
import { ProductPricingEntity } from '../../entities/product-pricing.entity';
import { ComboPricingEntity } from '../../entities/combo-pricing.entity';
import { ProductTaxEntity } from '../../../taxation/product-taxes/entities/product-taxes.entity';
import { TaxEntity } from '../../../taxation/taxes/entities/tax.entity';
import { DiscountProductTargetEntity } from '../../../discounts/discount-product-target/entities/discount-product-target.entity';
import { DiscountComboTargetEntity } from '../../../discounts/discount-combo-target/entities/discount-combo-target.entity';
import { ComboItemEntity } from '../../../products/combos/entities/combo-item.entity';

describe('CalculationService', () => {
  let service: CalculationService;

  const mockProductPricingRepo = () => ({
    findOne: jest.fn(),
    find: jest.fn(),
  });
  const mockComboPricingRepo = () => ({ findOne: jest.fn() });
  const mockProductTaxRepo = () => ({ find: jest.fn() });
  const mockTaxRepo = () => ({ find: jest.fn() });
  const mockDiscountProductRepo = () => ({ findOne: jest.fn() });
  const mockDiscountComboRepo = () => ({ findOne: jest.fn() });
  const mockComboItemRepo = () => ({ find: jest.fn() });

  const mockMargin = { id: 1, value: 20 };

  const mockProductPricing = (overrides = {}) => ({
    id: 1,
    productId: 1,
    currency: 'ARS',
    unitPrice: 500,
    margin: mockMargin,
    deletedAt: null,
    ...overrides,
  });

  const mockComboPricing = (overrides = {}) => ({
    id: 1,
    comboId: 1,
    currency: 'ARS',
    unitPrice: 1200,
    margin: mockMargin,
    deletedAt: null,
    ...overrides,
  });

  const mockGlobalTax = (overrides = {}) => ({
    id: 1,
    value: 21,
    isGlobal: true,
    ...overrides,
  });

  const mockSpecificTax = (overrides = {}) => ({
    id: 2,
    value: 3,
    isGlobal: false,
    ...overrides,
  });

  let productPricingRepo: any;
  let comboPricingRepo: any;
  let productTaxRepo: any;
  let taxRepo: any;
  let discountProductRepo: any;
  let discountComboRepo: any;
  let comboItemRepo: any;

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
        { provide: getRepositoryToken(TaxEntity), useFactory: mockTaxRepo },
        {
          provide: getRepositoryToken(DiscountProductTargetEntity),
          useFactory: mockDiscountProductRepo,
        },
        {
          provide: getRepositoryToken(DiscountComboTargetEntity),
          useFactory: mockDiscountComboRepo,
        },
        {
          provide: getRepositoryToken(ComboItemEntity),
          useFactory: mockComboItemRepo,
        },
      ],
    }).compile();

    service = module.get<CalculationService>(CalculationService);
    productPricingRepo = module.get(getRepositoryToken(ProductPricingEntity));
    comboPricingRepo = module.get(getRepositoryToken(ComboPricingEntity));
    productTaxRepo = module.get(getRepositoryToken(ProductTaxEntity));
    taxRepo = module.get(getRepositoryToken(TaxEntity));
    discountProductRepo = module.get(
      getRepositoryToken(DiscountProductTargetEntity),
    );
    discountComboRepo = module.get(
      getRepositoryToken(DiscountComboTargetEntity),
    );
    comboItemRepo = module.get(getRepositoryToken(ComboItemEntity));
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

    it('should throw InternalServerErrorException if margin value is NaN', async () => {
      productPricingRepo.findOne.mockResolvedValue(
        mockProductPricing({ margin: { id: 1, value: NaN } }),
      );
      discountProductRepo.findOne.mockResolvedValue(null);
      productTaxRepo.find.mockResolvedValue([]);
      taxRepo.find.mockResolvedValue([]);

      await expect(service.calculateProduct({ productId: 1 })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ==========================
  // calculateCombo — prorrateo
  // ==========================

  describe('calculateCombo', () => {
    it('should apply only global taxes when combo has no items', async () => {
      comboPricingRepo.findOne.mockResolvedValue(mockComboPricing());
      discountComboRepo.findOne.mockResolvedValue(null);
      taxRepo.find.mockResolvedValue([mockGlobalTax()]);
      comboItemRepo.find.mockResolvedValue([]);

      const result = await service.calculateCombo({ comboId: 1 });

      // margen 20% sobre 1200 = 240 → priceAfterMargin = 1440
      // IVA 21% sobre 1440 = 302.4 → finalPrice = 1742.4
      expect(result.unitPrice).toBe(1200);
      expect(result.taxes).toBeCloseTo(302.4, 1);
      expect(result.finalPrice).toBeCloseTo(1742.4, 1);
    });

    it('should prorate specific taxes across combo items by reference price', async () => {
      // Combo $1000, items: Café $800 (1 ud) + Pan $400 (1 ud) = ref $1200
      // Proporción: Café 66.67%, Pan 33.33%
      // IIBB 3% Café: $20, IIBB 5% Pan: $16.67
      comboPricingRepo.findOne.mockResolvedValue(
        mockComboPricing({ unitPrice: 1000, margin: null }),
      );
      discountComboRepo.findOne.mockResolvedValue(null);
      taxRepo.find.mockResolvedValue([]); // sin globales

      comboItemRepo.find.mockResolvedValue([
        { productId: 1, quantity: 1 },
        { productId: 2, quantity: 1 },
      ]);

      // Una sola query con In() para pricings
      productPricingRepo.find.mockResolvedValue([
        { productId: 1, unitPrice: 800 },
        { productId: 2, unitPrice: 400 },
      ]);

      // Una sola query con In() para taxes
      productTaxRepo.find.mockResolvedValue([
        { productId: 1, tax: mockSpecificTax({ id: 10, value: 3 }) }, // IIBB Café 3%
        { productId: 2, tax: mockSpecificTax({ id: 11, value: 5 }) }, // IIBB Pan 5%
      ]);

      const result = await service.calculateCombo({ comboId: 1 });

      // Café: 1000 * (800/1200) = 666.67 → 3% = 20
      // Pan:  1000 * (400/1200) = 333.33 → 5% = 16.67
      expect(result.taxes).toBeCloseTo(36.67, 1);
    });

    it('should apply global tax on full price AND specific via proration without double counting', async () => {
      comboPricingRepo.findOne.mockResolvedValue(
        mockComboPricing({ unitPrice: 1000, margin: null }),
      );
      discountComboRepo.findOne.mockResolvedValue(null);
      taxRepo.find.mockResolvedValue([mockGlobalTax({ id: 1, value: 21 })]);

      comboItemRepo.find.mockResolvedValue([
        { productId: 1, quantity: 1 },
        { productId: 2, quantity: 1 },
      ]);

      productPricingRepo.find.mockResolvedValue([
        { productId: 1, unitPrice: 800 },
        { productId: 2, unitPrice: 400 },
      ]);

      // IIBB Café 3% (id=2, no es global id=1), Pan sin específico
      productTaxRepo.find.mockResolvedValue([
        { productId: 1, tax: mockSpecificTax({ id: 2, value: 3 }) },
      ]);

      const result = await service.calculateCombo({ comboId: 1 });

      // IVA 21% sobre 1000 = 210 | IIBB 3% sobre 666.67 = 20 → total 230
      expect(result.taxes).toBeCloseTo(230, 0);
    });

    it('should handle quantity > 1 in proration', async () => {
      // 2 Cafés ($800 c/u) + 1 Pan ($400)
      // Ref: Café 2*800=1600, Pan 1*400=400 → total 2000 → Café 80%
      comboPricingRepo.findOne.mockResolvedValue(
        mockComboPricing({ unitPrice: 1000, margin: null }),
      );
      discountComboRepo.findOne.mockResolvedValue(null);
      taxRepo.find.mockResolvedValue([]);

      comboItemRepo.find.mockResolvedValue([
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 1 },
      ]);

      productPricingRepo.find.mockResolvedValue([
        { productId: 1, unitPrice: 800 },
        { productId: 2, unitPrice: 400 },
      ]);

      productTaxRepo.find.mockResolvedValue([
        { productId: 1, tax: mockSpecificTax({ id: 10, value: 10 }) }, // 10% Café
      ]);

      const result = await service.calculateCombo({ comboId: 1 });

      // Café: 1000 * 80% = 800 → 10% = 80
      expect(result.taxes).toBeCloseTo(80, 1);
    });

    it('should throw NotFoundException if a combo item has no pricing configured', async () => {
      comboPricingRepo.findOne.mockResolvedValue(
        mockComboPricing({ unitPrice: 1000, margin: null }),
      );
      discountComboRepo.findOne.mockResolvedValue(null);
      taxRepo.find.mockResolvedValue([mockGlobalTax({ value: 21 })]);

      comboItemRepo.find.mockResolvedValue([{ productId: 99, quantity: 1 }]);
      productPricingRepo.find.mockResolvedValue([]); // productId 99 sin pricing
      productTaxRepo.find.mockResolvedValue([]);

      await expect(service.calculateCombo({ comboId: 1 })).rejects.toThrow(
        NotFoundException,
      );
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
        marginValue: 20,
        taxes: [{ value: 21 }],
        couponValue: 10,
      });

      expect(result.unitPrice).toBe(500);
      expect(result.discount).toBeGreaterThan(0);
      expect(result.finalPrice).toBeGreaterThan(0);
      expect(result.fullPrice).toBeGreaterThanOrEqual(result.finalPrice);
    });
  });
});
