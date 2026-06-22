import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CategoryEntity } from './categories/entities/category.entity';
import { ProductEntity } from './product/entities/product.entity';
import { ComboEntity } from './combos/entities/combo.entity';
import { ComboItemEntity } from './combos/entities/combo-item.entity';
import { ProductPricingEntity } from '../pricing/entities/product-pricing.entity';
import { ProductImageEntity } from './product-images/entities/product-image.entity';
import { ComboImageEntity } from './combo-images/entities/combo-image.entity';
import { StockItemEntity } from '../stocks/stock-item/entities/stock-item.entity';
import { ProductTaxEntity } from '../taxation/product-taxes/entities/product-taxes.entity';
import { DiscountProductTargetEntity } from '../discounts/discount-product-target/entities/discount-product-target.entity';
import { CouponProductTargetEntity } from '../coupons/coupon-product-target/entities/coupon-product-target.entity';
import { ComboPricingEntity } from '../pricing/entities/combo-pricing.entity';
import { DiscountComboTargetEntity } from '../discounts/discount-combo-target/entities/discount-combo-target.entity';
import { CouponComboTargetEntity } from '../coupons/coupon-combo-target/entities/coupon-combo-target.entity';
import { OrderItemEntity } from '../orders/entities/order-item.entity';

import { CategoryService } from './categories/services/category.service';
import { ProductService } from './product/services/product.service';
import { ComboService } from './combos/services/combo.service';
import { ProductImageService } from './product-images/services/product-image.service';
import { ComboImageService } from './combo-images/services/combo-image.service';

import { CategoryController } from './categories/controllers/category.controller';
import { ProductController } from './product/controllers/product.controller';
import { ComboController } from './combos/controllers/combo.controller';
import { ProductImageController } from './product-images/controllers/product-image.controller';
import { ComboImageController } from './combo-images/controllers/combo-image.controller';
import { ShopModule } from './shop/shop.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CategoryEntity,
      ProductEntity,
      ComboEntity,
      ComboItemEntity,
      ProductImageEntity,
      ComboImageEntity,
      ProductPricingEntity,
      StockItemEntity,
      ProductTaxEntity,
      DiscountProductTargetEntity,
      CouponProductTargetEntity,
      ComboPricingEntity,
      DiscountComboTargetEntity,
      CouponComboTargetEntity,
      OrderItemEntity,
    ]),
    ShopModule,
  ],
  providers: [
    CategoryService,
    ProductService,
    ComboService,
    ProductImageService,
    ComboImageService,
  ],
  controllers: [
    CategoryController,
    ProductController,
    ComboController,
    ProductImageController,
    ComboImageController,
  ],
  exports: [
    CategoryService,
    ProductService,
    ComboService,
    ProductImageService,
    ComboImageService,
  ],
})
export class ProductsModule {}
