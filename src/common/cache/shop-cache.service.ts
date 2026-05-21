import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

const VERSION_KEY = 'shop:__version__';
const SHOP_TTL_MS = 60_000;
// Version key TTL: 1 year — effectively permanent
const VERSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;

@Injectable()
export class ShopCacheService {
  private readonly cache: Cache;

  constructor(@Inject(CACHE_MANAGER) cache: object) {
    this.cache = cache as Cache;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const v = await this.getVersion();
    return this.cache.get<T>(`shop:v${v}:${key}`);
  }

  async set<T>(key: string, value: T): Promise<void> {
    const v = await this.getVersion();
    await this.cache.set(`shop:v${v}:${key}`, value, SHOP_TTL_MS);
  }

  // Invalidates all shop cache by bumping the version.
  // Old versioned keys become orphans and expire via their TTL.
  async invalidate(): Promise<void> {
    const current = (await this.cache.get<number>(VERSION_KEY)) ?? 0;
    await this.cache.set(VERSION_KEY, current + 1, VERSION_TTL_MS);
  }

  private async getVersion(): Promise<number> {
    return (await this.cache.get<number>(VERSION_KEY)) ?? 0;
  }
}
