import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CategoryEntity } from './categories/entities/category.entity';
import { ProductEntity } from './product/entities/product.entity';
import { ComboEntity } from './combos/entities/combo.entity';
import { ComboItemEntity } from './combos/entities/combo-item.entity';

import { CategoryService } from './categories/services/category.service';
import { ProductService } from './product/services/product.service';
import { ComboService } from './combos/services/combo.service';

import { CategoryController } from './categories/controllers/category.controller';
import { ProductController } from './product/controllers/product.controller';
import { ComboController } from './combos/controllers/combo.controller';
import { ProductImageEntity } from './product-images/entities/product-image.entity';
import { ProductImageService } from './product-images/services/product-image.service';
import { ProductImageController } from './product-images/controllers/product-image.controller';
import { ComboImageEntity } from './combo-images/entities/combo-image.entity';
import { ComboImageService } from './combo-images/services/combo-image.service';
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