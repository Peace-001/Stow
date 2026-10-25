import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CacheService } from '../cache.service';
import { CACHE_KEY_METADATA, CACHE_TTL_METADATA } from '../decorators/cache-key.decorator';

/**
 * Interceptor to automatically cache HTTP responses
 * Uses metadata from @CacheKey and @CacheTTL decorators
 */
@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  constructor(
    private readonly cacheService: CacheService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const cacheKey = this.reflector.get<string>(
      CACHE_KEY_METADATA,
      context.getHandler(),
    );
    const cacheTTL = this.reflector.get<number>(
      CACHE_TTL_METADATA,
      context.getHandler(),
    );

    // If no cache key is defined, skip caching
    if (!cacheKey) {
      return next.handle();
    }

    // Build the actual cache key with request parameters
    const request = context.switchToHttp().getRequest();
    const actualKey = this.buildCacheKey(cacheKey, request);

    // Try to get from cache
    const cachedResponse = await this.cacheService.get(actualKey);
    if (cachedResponse) {
      return of(cachedResponse);
    }

    // If not in cache, execute the handler and cache the result
    return next.handle().pipe(
      tap(async (response) => {
        await this.cacheService.set(actualKey, response, cacheTTL);
      }),
    );
  }

  /**
   * Build cache key by replacing placeholders with actual values
   * @param keyPattern - Cache key pattern with placeholders
   * @param request - HTTP request object
   */
  private buildCacheKey(keyPattern: string, request: any): string {
    let key = keyPattern;

    // Replace :userId placeholder
    if (request.user?.id) {
      key = key.replace(':userId', request.user.id);
    }

    // Replace :param placeholders from route params
    Object.keys(request.params || {}).forEach((param) => {
      key = key.replace(`:${param}`, request.params[param]);
    });

    // Add query string to key if present
    if (Object.keys(request.query || {}).length > 0) {
      const queryString = new URLSearchParams(request.query).toString();
      key = `${key}?${queryString}`;
    }

    return key;
  }
}
