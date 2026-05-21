import { Global, Module } from '@nestjs/common';
import { ShopCacheService } from './shop-cache.service';

@Global()
@Module({
  providers: [ShopCacheService],
  exports: [ShopCacheService],
})
export class AppCacheModule {}
