import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { Observable, from, switchMap } from 'rxjs';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Request } from 'express';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const PROCESSING_SENTINEL = '__processing__';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const idempotencyKey = request.headers['idempotency-key'] as
      | string
      | undefined;

    if (!idempotencyKey) return next.handle();

    const userId = (request as any).user?.sub;
    const cacheKey = `idempotency:${userId ?? 'anon'}:${idempotencyKey}`;

    return from(this.cache.get<string | object>(cacheKey)).pipe(
      switchMap((cached) => {
        if (cached === PROCESSING_SENTINEL) {
          throw new ConflictException('Request is already being processed');
        }

        if (cached !== undefined && cached !== null) {
          return from(Promise.resolve(cached));
        }

        return from(
          this.cache.set(cacheKey, PROCESSING_SENTINEL, IDEMPOTENCY_TTL_MS),
        ).pipe(
          switchMap(() =>
            next
              .handle()
              .pipe(
                switchMap((result) =>
                  from(
                    this.cache.set(cacheKey, result, IDEMPOTENCY_TTL_MS),
                  ).pipe(switchMap(() => from(Promise.resolve(result)))),
                ),
              ),
          ),
        );
      }),
    );
  }
}
